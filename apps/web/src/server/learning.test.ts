import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { CourseStatus } from '@/generated/prisma/client';
import {
  chargedPriceColumns,
  type CoursePricing,
  coursePricingColumns,
  membershipLeadPrice,
} from '@/lib/pricing';
import { grantCourseAccess, revokeCourseAccess } from './access';
import type { Session } from './auth/session';
import { getDb } from './db';
import {
  canReadLesson,
  enroll,
  enrollLearner,
  getPlayer,
  isAccessLock,
  LearningError,
  LESSON_LOCKS,
  listMyLearning,
  saveProgress,
} from './learning';
import { testSession } from '../../test/sessions';

// Uses the seeded sample courses "kirtan-basics" (15 lessons, the first one a free preview) and
// "mastering-harmonium", both priced (tier 3).
const SLUG = 'kirtan-basics';
const SECOND_SLUG = 'mastering-harmonium';
const CREATED_PREFIX = 'learning-';
const DAY_MS = 24 * 60 * 60 * 1000;
const SECRET = 'The paid lesson text that only learners with access may read.';

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await getDb().course.deleteMany({ where: { slug: { startsWith: CREATED_PREFIX } } });
  await getDb().$disconnect();
});

async function learner(roles: Session['roles'] = []): Promise<Session> {
  const user = await getDb().user.create({
    data: {
      id: randomUUID(),
      email: `${randomUUID()}@example.org`,
      name: 'L',
      lastSignInAt: new Date(),
    },
  });
  return testSession(user, roles);
}

/** Early access ended a day ago. */
function endEarlyAccess() {
  vi.stubEnv('EARLY_ACCESS_ENDS_AT', new Date(Date.now() - DAY_MS).toISOString());
}

/** Enrolls the learner as if they had joined a month ago, during early access. */
async function joinEarly(session: Session, slug: string) {
  await enroll(session, slug);
  await getDb().enrollment.updateMany({
    where: { userId: session.userId, course: { slug } },
    data: { enrolledAt: new Date(Date.now() - 30 * DAY_MS) },
  });
}

async function courseIdOf(slug: string) {
  return (await getDb().course.findUniqueOrThrow({ where: { slug } })).id;
}

const lessonsOf = (player: Awaited<ReturnType<typeof getPlayer>>) =>
  player.sections.flatMap((s) => s.lessons);

/** A course with a free-preview text lesson and a paid one. */
async function textCourse(pricing: CoursePricing, status: CourseStatus = 'PUBLISHED') {
  const category = await getDb().category.findFirstOrThrow();
  return getDb().course.create({
    data: {
      slug: `${CREATED_PREFIX}${randomUUID()}`,
      title: 'Learning course',
      subtitle: '',
      description: '',
      level: 'BEGINNER',
      status,
      instructorName: 'T',
      categoryId: category.id,
      ...coursePricingColumns(pricing),
      sections: {
        create: {
          title: 'S',
          position: 0,
          lessons: {
            create: [
              { title: 'Preview', type: 'TEXT', position: 0, isPreview: true, body: 'Welcome.' },
              { title: 'Lesson', type: 'TEXT', position: 1, body: SECRET, mediaKey: 'media/x' },
            ],
          },
        },
      },
    },
    include: {
      sections: { include: { lessons: { include: { section: { include: { course: true } } } } } },
    },
  });
}

async function member() {
  const session = await learner();
  await getDb().membership.create({
    data: {
      payerId: session.userId,
      plan: 'MONTHLY',
      ...chargedPriceColumns({
        region: 'south-africa',
        amount: membershipLeadPrice('south-africa').amount,
      }),
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS),
    },
  });
  return session;
}

describe('lesson locks', () => {
  it('are lifted by signing in or enrolling, or else only by access', () => {
    expect(LESSON_LOCKS.filter((lock) => !isAccessLock(lock))).toEqual([
      'signed_out',
      'not_enrolled',
    ]);
    expect(LESSON_LOCKS.filter(isAccessLock)).toEqual([
      'payment_required',
      'unpriced',
      'access_ended',
    ]);
  });
});

describe('during early access', () => {
  it('lets visitors and learners who have not enrolled open only preview lessons', async () => {
    const anonymous = await getPlayer(null, SLUG);
    expect(anonymous.lesson.isPreview).toBe(true);
    expect(anonymous.lesson.unlocked).toBe(true);
    expect(anonymous.canTrackProgress).toBe(false);
    expect(anonymous.lock).toBe('signed_out');

    const locked = lessonsOf(anonymous).find((l) => !l.isPreview)!;
    const view = await getPlayer(null, SLUG, locked.id);
    expect(view.lesson.unlocked).toBe(false);
    expect(view.mediaUrl).toBeNull();

    // Signed in but not enrolled: still only the preview, until they enroll (for free).
    const visitor = await learner();
    const notEnrolled = await getPlayer(visitor, SLUG, locked.id);
    expect(notEnrolled).toMatchObject({
      enrolled: false,
      lock: 'not_enrolled',
      access: { kind: 'open', reason: 'early_access' },
      canTrackProgress: false,
    });
    expect(notEnrolled.lesson).toMatchObject({ unlocked: false, lock: 'not_enrolled' });
  });

  it('lets enrolled learners and admins open every lesson', async () => {
    const student = await learner();
    await enroll(student, SLUG);
    const player = await getPlayer(student, SLUG);
    expect(player).toMatchObject({ enrolled: true, lock: null });
    expect(lessonsOf(player).every((l) => l.unlocked)).toBe(true);

    const admin = await learner(['admin']);
    const adminView = await getPlayer(admin, SLUG);
    expect(adminView).toMatchObject({ enrolled: false, lock: null });
    expect(lessonsOf(adminView).every((l) => l.unlocked)).toBe(true);
  });

  it('cannot enroll in unknown or unpublished courses', async () => {
    const student = await learner();
    await expect(enroll(student, 'no-such-course')).rejects.toBeInstanceOf(LearningError);
    const draft = await textCourse({ kind: 'tier', tier: 2 }, 'DRAFT');
    await expect(enroll(student, draft.slug)).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('the player', () => {
  it('never returns the text or media of a locked lesson', async () => {
    endEarlyAccess();
    const course = await textCourse({ kind: 'tier', tier: 2 });
    const student = await learner();
    const preview = await getPlayer(student, course.slug);
    const paidLesson = lessonsOf(preview).find((l) => !l.isPreview)!;
    const onLocked = await getPlayer(student, course.slug, paidLesson.id);

    for (const result of [preview, onLocked]) {
      expect(JSON.stringify(result)).not.toContain(SECRET);
      expect(JSON.stringify(result)).not.toContain('media/x');
    }
    expect(onLocked.lesson).toEqual({
      id: paidLesson.id,
      title: 'Lesson',
      type: 'TEXT',
      durationSeconds: 0,
      isPreview: false,
      completed: false,
      unlocked: false,
      lock: 'payment_required',
    });
    expect(preview.lesson).toMatchObject({ unlocked: true, body: 'Welcome.' });
  });
});

describe('after early access', () => {
  it('refuses to enroll in a course that is not open, says why, and records nothing', async () => {
    endEarlyAccess();
    const student = await learner();
    await expect(enroll(student, SLUG)).rejects.toMatchObject({
      code: 'access_locked',
      lock: 'payment_required',
      message: 'Join Membership or buy this course to open every lesson.',
    });
    const unpriced = await textCourse({ kind: 'unpriced' });
    await expect(enroll(student, unpriced.slug)).rejects.toMatchObject({
      code: 'access_locked',
      lock: 'unpriced',
      message: 'This course is not on sale yet.',
    });
    expect(await getDb().enrollment.count({ where: { userId: student.userId } })).toBe(0);
  });

  it('keeps every lesson open to learners who joined during early access, with no grant', async () => {
    const student = await learner();
    await joinEarly(student, SLUG);
    endEarlyAccess();
    const player = await getPlayer(student, SLUG);
    expect(player).toMatchObject({
      lock: null,
      access: { kind: 'open', reason: 'joined_in_early_access' },
    });
    expect(lessonsOf(player).every((l) => l.unlocked)).toBe(true);
    expect(await getDb().courseAccess.count({ where: { userId: student.userId } })).toBe(0);
  });

  it('asks members to enroll, then opens every lesson', async () => {
    endEarlyAccess();
    const session = await member();
    expect(await getPlayer(session, SLUG)).toMatchObject({
      lock: 'not_enrolled',
      access: { kind: 'open', reason: 'membership' },
    });
    await enroll(session, SLUG);
    expect((await getPlayer(session, SLUG)).lock).toBeNull();
  });

  it('ends the access of learners who joined after the end once their grant is revoked', async () => {
    endEarlyAccess();
    const student = await learner();
    const grant = {
      userId: student.userId,
      courseId: await courseIdOf(SLUG),
      source: 'PURCHASE',
    } as const;
    await grantCourseAccess(getDb(), grant);
    await enroll(student, SLUG);
    expect((await getPlayer(student, SLUG)).lock).toBeNull();

    await revokeCourseAccess(getDb(), grant);
    const ended = await getPlayer(student, SLUG);
    expect(ended).toMatchObject({ enrolled: true, lock: 'access_ended', canTrackProgress: false });
    expect(lessonsOf(ended).filter((l) => l.unlocked)).toEqual([
      expect.objectContaining({ isPreview: true }),
    ]);
  });

  it('says why lessons are locked for learners without access, and opens them to staff', async () => {
    endEarlyAccess();
    const student = await learner();
    const view = await getPlayer(student, SLUG);
    expect(view).toMatchObject({ enrolled: false, lock: 'payment_required' });
    expect(view.lesson.isPreview).toBe(true);

    const admin = await learner(['admin']);
    expect((await getPlayer(admin, SLUG)).lock).toBeNull();
    expect((await getPlayer(null, SLUG)).lock).toBe('signed_out');
  });

  it('refuses to save progress once access ends, and keeps the progress made', async () => {
    endEarlyAccess();
    const student = await learner();
    const grant = {
      userId: student.userId,
      courseId: await courseIdOf(SLUG),
      source: 'GIFT',
    } as const;
    await grantCourseAccess(getDb(), grant);
    await enroll(student, SLUG);
    const lesson = (await getPlayer(student, SLUG)).lesson;
    await saveProgress(student, lesson.id, { completed: true });

    await revokeCourseAccess(getDb(), grant);
    await expect(saveProgress(student, lesson.id, { positionSeconds: 10 })).rejects.toMatchObject({
      code: 'access_locked',
      lock: 'access_ended',
      message: 'Your access to this course has ended.',
    });
    expect((await getPlayer(student, SLUG)).completedCount).toBe(1);
  });

  it('flags the courses in My Learning whose access has ended', async () => {
    const student = await learner();
    await joinEarly(student, SECOND_SLUG);
    endEarlyAccess();
    const grant = {
      userId: student.userId,
      courseId: await courseIdOf(SLUG),
      source: 'PURCHASE',
    } as const;
    await grantCourseAccess(getDb(), grant);
    await enroll(student, SLUG);
    expect((await listMyLearning(student)).map((c) => [c.slug, c.accessEnded])).toEqual([
      [SLUG, false],
      [SECOND_SLUG, false],
    ]);

    await revokeCourseAccess(getDb(), grant);
    expect((await listMyLearning(student)).map((c) => [c.slug, c.accessEnded])).toEqual([
      [SLUG, true],
      [SECOND_SLUG, false],
    ]);
  });
});

describe('reading lessons', () => {
  it('follows the player, and never reads a course that is not published', async () => {
    const student = await learner();
    const draft = await textCourse({ kind: 'free' }, 'DRAFT');
    const [preview] = draft.sections[0].lessons;
    expect(await canReadLesson(student, preview)).toBe(false);

    const live = await textCourse({ kind: 'tier', tier: 2 });
    const [livePreview, paid] = live.sections[0].lessons;
    expect(await canReadLesson(null, livePreview)).toBe(true);
    expect(await canReadLesson(student, paid)).toBe(false);
    await enroll(student, live.slug);
    expect(await canReadLesson(student, paid)).toBe(true);
  });
});

describe('enrollLearner', () => {
  it('enrolls without a session and keeps the first enrolment date', async () => {
    const student = await learner();
    const courseId = await courseIdOf(SLUG);
    const first = await enrollLearner(getDb(), student.userId, courseId);
    const again = await enrollLearner(getDb(), student.userId, courseId);
    expect(again.id).toBe(first.id);
    expect(again.enrolledAt).toEqual(first.enrolledAt);
  });
});

describe('progress', () => {
  it('saves position, resumes at the first incomplete lesson and completes the course', async () => {
    const student = await learner();
    // Not enrolled yet: progress is not tracked.
    const first = (await getPlayer(student, SLUG)).lesson;
    await expect(saveProgress(student, first.id, { completed: true })).rejects.toMatchObject({
      code: 'not_enrolled',
    });

    await enroll(student, SLUG);
    await saveProgress(student, first.id, { positionSeconds: 42.6 });
    expect((await getPlayer(student, SLUG, first.id)).resumeAt).toBe(43);

    await saveProgress(student, first.id, { completed: true });
    const next = await getPlayer(student, SLUG);
    expect(next.lesson.id).not.toBe(first.id); // resumes at the next incomplete lesson
    expect(next.completedCount).toBe(1);

    const all = lessonsOf(next);
    for (const lesson of all) await saveProgress(student, lesson.id, { completed: true });
    const [course] = await listMyLearning(student);
    expect(course).toMatchObject({
      slug: SLUG,
      percent: 100,
      completed: true,
      totalLessons: all.length,
    });

    // Un-completing a lesson reopens the course.
    await saveProgress(student, first.id, { completed: false });
    const [reopened] = await listMyLearning(student);
    expect(reopened.completed).toBe(false);
    expect(reopened.completedCount).toBe(all.length - 1);
  });

  it('keeps the original completion time and lists most recent courses first', async () => {
    const student = await learner();
    await enroll(student, SLUG);
    const lesson = (await getPlayer(student, SLUG)).lesson;
    await saveProgress(student, lesson.id, { completed: true });
    const firstTime = (
      await getDb().lessonProgress.findFirstOrThrow({ where: { userId: student.userId } })
    ).completedAt;
    await saveProgress(student, lesson.id, { completed: true });
    const again = await getDb().lessonProgress.findFirstOrThrow({
      where: { userId: student.userId },
    });
    expect(again.completedAt).toEqual(firstTime);

    await enroll(student, SECOND_SLUG);
    expect((await listMyLearning(student)).map((c) => c.slug)).toEqual([SECOND_SLUG, SLUG]);
  });
});

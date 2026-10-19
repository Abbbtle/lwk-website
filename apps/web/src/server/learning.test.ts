import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { type CoursePricing, coursePricingColumns } from '@/lib/pricing';
import type { Session } from './auth/session';
import { getDb } from './db';
import { enroll, getPlayer, LearningError, listMyLearning, saveProgress } from './learning';
import { testSession } from '../../test/sessions';

// Uses the seeded sample courses "kirtan-basics" (15 lessons, the first one a free preview) and
// "mastering-harmonium", both priced (tier 3).
const SLUG = 'kirtan-basics';
const SECOND_SLUG = 'mastering-harmonium';
const CREATED_PREFIX = 'learning-';

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

function switchPaymentsOn() {
  vi.stubEnv('PAYMENTS_ENABLED', 'true');
}

const lessonsOf = (player: Awaited<ReturnType<typeof getPlayer>>) =>
  player.sections.flatMap((s) => s.lessons);

/** A published course with one free-preview lesson and one other. */
async function publishedCourse(pricing: CoursePricing) {
  const category = await getDb().category.findFirstOrThrow();
  return getDb().course.create({
    data: {
      slug: `${CREATED_PREFIX}${randomUUID()}`,
      title: 'Learning course',
      subtitle: '',
      description: '',
      level: 'BEGINNER',
      status: 'PUBLISHED',
      instructorName: 'T',
      categoryId: category.id,
      ...coursePricingColumns(pricing),
      sections: {
        create: {
          title: 'S',
          position: 0,
          lessons: {
            create: [
              { title: 'Preview', type: 'TEXT', position: 0, isPreview: true },
              { title: 'Lesson', type: 'TEXT', position: 1 },
            ],
          },
        },
      },
    },
  });
}

async function grantsOf(session: Session) {
  return getDb().courseAccess.findMany({
    where: { userId: session.userId },
    select: { course: { select: { slug: true } }, source: true, revokedAt: true },
    orderBy: { grantedAt: 'asc' },
  });
}

async function revokeGrant(session: Session, slug: string) {
  await getDb().courseAccess.updateMany({
    where: { userId: session.userId, course: { slug } },
    data: { revokedAt: new Date() },
  });
}

describe('access', () => {
  it('visitors and non-enrolled learners can open only preview lessons', async () => {
    const anonymous = await getPlayer(null, SLUG);
    expect(anonymous.lesson.isPreview).toBe(true);
    expect(anonymous.lesson.unlocked).toBe(true);
    expect(anonymous.canTrackProgress).toBe(false);
    expect(anonymous.lock).toBe('sign_in');

    const locked = lessonsOf(anonymous).find((l) => !l.isPreview)!;
    const view = await getPlayer(null, SLUG, locked.id);
    expect(view.lesson.unlocked).toBe(false);
    expect(view.mediaUrl).toBeNull();

    // Signed in but not enrolled: still only the preview, until they enroll.
    const visitor = await learner();
    const notEnrolled = await getPlayer(visitor, SLUG, locked.id);
    expect(notEnrolled).toMatchObject({ enrolled: false, lock: 'enroll', canTrackProgress: false });
    expect(notEnrolled.lesson.unlocked).toBe(false);
  });

  it('enrolled learners and admins can open every lesson', async () => {
    const student = await learner();
    await enroll(student, SLUG);
    const player = await getPlayer(student, SLUG);
    expect(player.enrolled).toBe(true);
    expect(player.lock).toBeNull();
    expect(lessonsOf(player).every((l) => l.unlocked)).toBe(true);

    const admin = await learner(['admin']);
    const adminView = await getPlayer(admin, SLUG);
    expect(adminView.enrolled).toBe(false);
    expect(adminView.lock).toBeNull();
    expect(lessonsOf(adminView).every((l) => l.unlocked)).toBe(true);
  });

  it('cannot enroll in unknown or unpublished courses', async () => {
    const student = await learner();
    await expect(enroll(student, 'no-such-course')).rejects.toBeInstanceOf(LearningError);
  });
});

describe('early access', () => {
  it('records one early-access grant for joining a priced course while payments are off', async () => {
    const student = await learner();
    await enroll(student, SLUG);
    await enroll(student, SLUG);
    expect(await grantsOf(student)).toEqual([
      { course: { slug: SLUG }, source: 'EARLY_ACCESS', revokedAt: null },
    ]);
  });

  it('records none for a free course, and keeps a grant that is already there', async () => {
    const student = await learner();
    const free = await publishedCourse({ kind: 'free' });
    await enroll(student, free.slug);
    expect(await grantsOf(student)).toEqual([]);

    const harmonium = await getDb().course.findUniqueOrThrow({ where: { slug: SECOND_SLUG } });
    await getDb().courseAccess.create({
      data: { userId: student.userId, courseId: harmonium.id, source: 'GIFT' },
    });
    await enroll(student, SECOND_SLUG);
    expect(await grantsOf(student)).toEqual([
      { course: { slug: SECOND_SLUG }, source: 'GIFT', revokedAt: null },
    ]);
  });
});

describe('once payments are on', () => {
  it('refuses to enroll in a course that is not open, and records nothing', async () => {
    switchPaymentsOn();
    const student = await learner();
    await expect(enroll(student, SLUG)).rejects.toMatchObject({
      code: 'payment_required',
      message: 'Join Membership or buy this course to open every lesson.',
    });
    const unpriced = await publishedCourse({ kind: 'unpriced' });
    await expect(enroll(student, unpriced.slug)).rejects.toMatchObject({
      code: 'payment_required',
      message: 'This course is not on sale yet.',
    });
    expect(await getDb().enrollment.count({ where: { userId: student.userId } })).toBe(0);
    expect(await grantsOf(student)).toEqual([]);
  });

  it('enrolls members and learners in free courses, without early-access grants', async () => {
    switchPaymentsOn();
    const member = await learner();
    await getDb().membership.create({
      data: {
        payerId: member.userId,
        plan: 'MONTHLY',
        region: 'south-africa',
        currency: 'ZAR',
        amountMinorUnits: 9900,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await enroll(member, SLUG);
    expect((await getPlayer(member, SLUG)).lock).toBeNull();

    const free = await publishedCourse({ kind: 'free' });
    await enroll(member, free.slug);
    expect(await grantsOf(member)).toEqual([]);
  });

  it('keeps every lesson open to early learners, and only previews once the grant is revoked', async () => {
    const student = await learner();
    await enroll(student, SLUG);
    switchPaymentsOn();
    const open = await getPlayer(student, SLUG);
    expect(open).toMatchObject({ enrolled: true, lock: null, canTrackProgress: true });
    expect(lessonsOf(open).every((l) => l.unlocked)).toBe(true);

    await revokeGrant(student, SLUG);
    const ended = await getPlayer(student, SLUG);
    expect(ended).toMatchObject({ enrolled: true, lock: 'access_ended', canTrackProgress: false });
    expect(lessonsOf(ended).filter((l) => l.unlocked)).toEqual([
      expect.objectContaining({ isPreview: true }),
    ]);
  });

  it('says why lessons are locked for learners without access, and opens them to staff', async () => {
    switchPaymentsOn();
    const student = await learner();
    const view = await getPlayer(student, SLUG);
    expect(view).toMatchObject({ enrolled: false, lock: 'payment_required' });
    expect(view.lesson.isPreview).toBe(true);
    expect(lessonsOf(view).filter((l) => l.unlocked)).toHaveLength(1);

    const admin = await learner(['admin']);
    expect((await getPlayer(admin, SLUG)).lock).toBeNull();
    expect((await getPlayer(null, SLUG)).lock).toBe('sign_in');
  });

  it('refuses to save progress once access ends, and keeps the progress made', async () => {
    const student = await learner();
    await enroll(student, SLUG);
    const lesson = (await getPlayer(student, SLUG)).lesson;
    await saveProgress(student, lesson.id, { completed: true });

    switchPaymentsOn();
    await revokeGrant(student, SLUG);
    await expect(saveProgress(student, lesson.id, { positionSeconds: 10 })).rejects.toMatchObject({
      code: 'payment_required',
      message: 'Your access to this course has ended.',
    });
    expect((await getPlayer(student, SLUG)).completedCount).toBe(1);
  });

  it('flags the courses in My Learning whose access has ended', async () => {
    const student = await learner();
    await enroll(student, SLUG);
    await enroll(student, SECOND_SLUG);
    expect((await listMyLearning(student)).map((c) => c.accessEnded)).toEqual([false, false]);

    switchPaymentsOn();
    await revokeGrant(student, SLUG);
    expect((await listMyLearning(student)).map((c) => [c.slug, c.accessEnded])).toEqual([
      [SECOND_SLUG, false],
      [SLUG, true],
    ]);
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

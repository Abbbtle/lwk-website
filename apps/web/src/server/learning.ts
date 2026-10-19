import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import {
  type AccessDecision,
  courseAccessColumns,
  courseAccessFor,
  courseAccessForMany,
  type CourseForAccess,
  recordEarlyAccess,
} from './access';
import type { Session } from './auth/session';
import { getDb } from './db';
import { signedMediaUrl } from './media';

// Enrollment, the lesson player and progress. Whether a course is open to someone is decided in
// access.ts; learners open its lessons once enrolled, owners and admins without enrolling.

export class LearningError extends Error {
  constructor(
    /**
     * `payment_required`: the course is not open to the learner (see AccessLock): it needs a
     * purchase or a membership, has no price yet, or their access has ended. The message says which.
     */
    readonly code: 'not_found' | 'not_enrolled' | 'payment_required',
    message: string,
  ) {
    super(message);
  }
}

/** What keeps a viewer from a course's lessons (free previews always open). */
export type LessonLock =
  /** Signed out. */
  | 'sign_in'
  /** The course is open to them once they enroll. */
  | 'enroll'
  /** A priced course they have no grant or membership for. */
  | 'payment_required'
  /** A course without a price yet, once payments are on. */
  | 'unpriced'
  /** Enrolled, but their grant or membership no longer opens it. Their progress is kept. */
  | 'access_ended';

/** Locks that signing in or enrolling cannot lift: the course needs paying for or a price. */
export type AccessLock = Extract<LessonLock, 'payment_required' | 'unpriced' | 'access_ended'>;

export function isAccessLock(lock: LessonLock | null): lock is AccessLock {
  return lock === 'payment_required' || lock === 'unpriced' || lock === 'access_ended';
}

/** What to tell someone a course is closed to, as enrolling refuses it and its pages say it. */
export function accessLockMessage(lock: AccessLock): string {
  switch (lock) {
    case 'payment_required':
      return 'Join Membership or buy this course to open every lesson.';
    case 'unpriced':
      return 'This course is not on sale yet.';
    case 'access_ended':
      return 'Your access to this course has ended.';
  }
}

function lessonLock(access: AccessDecision, enrolled: boolean): LessonLock | null {
  switch (access.kind) {
    case 'manage':
      return null;
    case 'open':
      return enrolled ? null : 'enroll';
    case 'locked':
      if (access.reason === 'signed_out') return 'sign_in';
      return enrolled ? 'access_ended' : access.reason;
  }
}

// Media links for the player stay valid long enough to watch a long video.
const PLAYER_LINK_SECONDS = 3 * 60 * 60;

const playerInclude = {
  category: true,
  sections: {
    orderBy: { position: 'asc' },
    include: { lessons: { orderBy: { position: 'asc' } } },
  },
} satisfies Prisma.CourseInclude;

type PlayerCourse = Prisma.CourseGetPayload<{ include: typeof playerInclude }>;

async function publishedCourse(slug: string): Promise<PlayerCourse> {
  const course = await getDb().course.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: playerInclude,
  });
  if (!course) throw new LearningError('not_found', 'Course not found.');
  return course;
}

export async function getEnrollment(userId: string, courseId: string) {
  return getDb().enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
}

/** The viewer's enrollment in a published course, and what keeps its lessons from them. */
async function learnerState(session: Session | null, course: CourseForAccess) {
  const [enrollment, access] = await Promise.all([
    session ? getEnrollment(session.userId, course.id) : null,
    courseAccessFor(session, course),
  ]);
  return { enrollment, lock: lessonLock(access, Boolean(enrollment)) };
}

/** The learner's enrollment and what keeps the lessons locked, for a course page, by slug. */
export async function getLearnerState(session: Session, slug: string) {
  const course = await getDb().course.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: courseAccessColumns,
  });
  if (!course) throw new LearningError('not_found', 'Course not found.');
  return learnerState(session, course);
}

/**
 * Enroll in a published course that is open to the learner. While payments are off, joining a
 * course that is not free also records an early-access grant, so it stays theirs once they are on.
 */
export async function enroll(session: Session, slug: string) {
  const course = await publishedCourse(slug);
  const { lock } = await learnerState(session, course);
  if (isAccessLock(lock)) throw new LearningError('payment_required', accessLockMessage(lock));
  await getDb().$transaction(async (tx) => {
    await tx.enrollment.upsert({
      where: { userId_courseId: { userId: session.userId, courseId: course.id } },
      create: { userId: session.userId, courseId: course.id },
      update: { lastActiveAt: new Date() },
    });
    await recordEarlyAccess(tx, session.userId, course);
  });
  return course;
}

async function completedLessonIds(userId: string, lessonIds: string[]) {
  const rows = await getDb().lessonProgress.findMany({
    where: { userId, lessonId: { in: lessonIds }, completedAt: { not: null } },
    select: { lessonId: true },
  });
  return new Set(rows.map((r) => r.lessonId));
}

/**
 * Whether the viewer may read a lesson of a published course (its text, notes and media), as the
 * player decides: free previews, and every lesson once nothing keeps the course from them.
 */
export async function canReadLesson(
  session: Session | null,
  lesson: { isPreview: boolean },
  course: CourseForAccess,
): Promise<boolean> {
  if (lesson.isPreview) return true;
  return (await learnerState(session, course)).lock === null;
}

export type PlayerLesson = PlayerCourse['sections'][number]['lessons'][number] & {
  completed: boolean;
  /** Whether this viewer may open the lesson. */
  unlocked: boolean;
};

/**
 * Everything the player needs for one lesson. Without `lessonId`, picks the first lesson the
 * learner has not completed (resume). Media links are only issued for unlocked lessons.
 */
export async function getPlayer(session: Session | null, slug: string, lessonId?: string) {
  const course = await publishedCourse(slug);
  const flat = course.sections.flatMap((s) => s.lessons);
  const [{ enrollment, lock }, completed] = await Promise.all([
    learnerState(session, course),
    session
      ? completedLessonIds(
          session.userId,
          flat.map((l) => l.id),
        )
      : new Set<string>(),
  ]);
  const lessons: PlayerLesson[] = flat.map((l) => ({
    ...l,
    completed: completed.has(l.id),
    unlocked: lock === null || l.isPreview,
  }));

  const current = lessonId
    ? lessons.find((l) => l.id === lessonId)
    : (lessons.find((l) => l.unlocked && !l.completed) ?? lessons.find((l) => l.unlocked));
  if (!current) throw new LearningError('not_found', 'Lesson not found.');

  const index = lessons.indexOf(current);
  const progress =
    session && current.unlocked
      ? await getDb().lessonProgress.findUnique({
          where: { userId_lessonId: { userId: session.userId, lessonId: current.id } },
        })
      : null;

  if (enrollment) {
    // Best effort: used only to order "My Learning".
    void getDb()
      .enrollment.update({ where: { id: enrollment.id }, data: { lastActiveAt: new Date() } })
      .catch(() => {});
  }

  return {
    course,
    sections: course.sections.map((s) => ({
      id: s.id,
      title: s.title,
      lessons: lessons.filter((l) => l.sectionId === s.id),
    })),
    lesson: current,
    mediaUrl:
      current.unlocked && current.mediaKey
        ? await signedMediaUrl(current.mediaKey, PLAYER_LINK_SECONDS)
        : null,
    resumeAt: progress?.completedAt ? 0 : (progress?.lastPositionSeconds ?? 0),
    previous: lessons[index - 1] ?? null,
    next: lessons[index + 1] ?? null,
    enrolled: Boolean(enrollment),
    /** What keeps the locked lessons locked, or null when every lesson is open. */
    lock,
    canTrackProgress: Boolean(enrollment) && lock === null,
    completedCount: completed.size,
    totalLessons: lessons.length,
  };
}

/**
 * Save where the learner is and whether the lesson is done. Needs an enrollment in a course that
 * is still open to the learner. Marks the enrollment complete when every lesson in the course is
 * complete.
 */
export async function saveProgress(
  session: Session,
  lessonId: string,
  update: { positionSeconds?: number; completed?: boolean },
) {
  const lesson = await getDb().lesson.findUnique({
    where: { id: lessonId },
    include: {
      section: { include: { course: { select: { ...courseAccessColumns, status: true } } } },
    },
  });
  if (!lesson || lesson.section.course.status !== 'PUBLISHED') {
    throw new LearningError('not_found', 'Lesson not found.');
  }
  const courseId = lesson.section.course.id;
  const { enrollment, lock } = await learnerState(session, lesson.section.course);
  if (!enrollment) throw new LearningError('not_enrolled', 'Enroll to track your progress.');
  if (isAccessLock(lock)) throw new LearningError('payment_required', accessLockMessage(lock));

  const position =
    update.positionSeconds === undefined
      ? undefined
      : Math.max(0, Math.round(update.positionSeconds));
  const completedAt =
    update.completed === undefined ? undefined : update.completed ? new Date() : null;

  const existing = await getDb().lessonProgress.findUnique({
    where: { userId_lessonId: { userId: session.userId, lessonId } },
  });
  await getDb().lessonProgress.upsert({
    where: { userId_lessonId: { userId: session.userId, lessonId } },
    create: {
      userId: session.userId,
      lessonId,
      lastPositionSeconds: position ?? 0,
      completedAt: completedAt ?? null,
    },
    update: {
      ...(position !== undefined && { lastPositionSeconds: position }),
      // Keep the original completion time if already complete.
      ...(completedAt !== undefined && {
        completedAt: completedAt && existing?.completedAt ? existing.completedAt : completedAt,
      }),
    },
  });

  const [total, done] = await Promise.all([
    getDb().lesson.count({ where: { section: { courseId } } }),
    getDb().lessonProgress.count({
      where: {
        userId: session.userId,
        completedAt: { not: null },
        lesson: { section: { courseId } },
      },
    }),
  ]);
  await getDb().enrollment.update({
    where: { id: enrollment.id },
    data: {
      lastActiveAt: new Date(),
      completedAt: total > 0 && done >= total ? (enrollment.completedAt ?? new Date()) : null,
    },
  });
  return { completedCount: done, totalLessons: total };
}

/**
 * The learner's courses, most recently active first, with progress and whether their access has
 * ended (their grant or membership no longer opens the course).
 */
export async function listMyLearning(session: Session) {
  const enrollments = await getDb().enrollment.findMany({
    where: { userId: session.userId, course: { status: 'PUBLISHED' } },
    orderBy: { lastActiveAt: 'desc' },
    include: {
      course: {
        include: {
          category: true,
          sections: { include: { lessons: { select: { id: true } } } },
        },
      },
    },
  });
  const access = await courseAccessForMany(
    session,
    enrollments.map((e) => e.course),
  );
  return Promise.all(
    enrollments.map(async (e, index) => {
      const lessonIds = e.course.sections.flatMap((s) => s.lessons.map((l) => l.id));
      const done = (await completedLessonIds(session.userId, lessonIds)).size;
      return {
        slug: e.course.slug,
        title: e.course.title,
        subtitle: e.course.subtitle,
        instructor: e.course.instructorName,
        categorySlug: e.course.category.slug,
        coverUrl: e.course.coverKey ? await signedMediaUrl(e.course.coverKey) : null,
        enrolledAt: e.enrolledAt,
        lastActiveAt: e.lastActiveAt,
        completed: e.completedAt !== null,
        completedCount: done,
        totalLessons: lessonIds.length,
        percent: lessonIds.length === 0 ? 0 : Math.round((done / lessonIds.length) * 100),
        accessEnded: lessonLock(access[index], true) === 'access_ended',
      };
    }),
  );
}

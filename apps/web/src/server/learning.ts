import 'server-only';
import type { Enrollment, Prisma } from '@/generated/prisma/client';
import {
  courseAccessFor,
  courseAccessForMany,
  type CourseForAccess,
  courseAccessSelect,
  isVisible,
  type OpenAccess,
  type VisibleAccess,
} from './access';
import type { Session } from './auth/session';
import { getDb } from './db';
import { signedMediaUrl } from './media';

// Enrollment, the lesson player and progress. Whether a course is open to someone is decided in
// access.ts; learners open its lessons once enrolled, owners and admins without enrolling.

export const LESSON_LOCKS = [
  'signed_out',
  'not_enrolled',
  'payment_required',
  'unpriced',
  'access_ended',
] as const;

/**
 * What keeps a viewer from a course's lessons (free previews always open): they are signed out,
 * the course is open to them once they enroll, it needs a purchase or a membership, it has no price
 * yet, or they are enrolled but their purchase or membership no longer counts.
 */
export type LessonLock = (typeof LESSON_LOCKS)[number];

const ACCESS_LOCKS = [
  'payment_required',
  'unpriced',
  'access_ended',
] as const satisfies readonly LessonLock[];

/** Locks that signing in or enrolling cannot lift. */
export type AccessLock = (typeof ACCESS_LOCKS)[number];

export function isAccessLock(lock: LessonLock | null): lock is AccessLock {
  return ACCESS_LOCKS.some((accessLock) => accessLock === lock);
}

export class LearningError extends Error {
  constructor(
    readonly code: 'not_found' | 'not_enrolled' | 'access_locked',
    message: string,
    /** With `access_locked`: what keeps the course closed, for callers to branch on. */
    readonly lock?: AccessLock,
  ) {
    super(message);
  }
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

/** Why a course is open to someone who has not enrolled yet, as its enroll panels say it. */
export function openAccessMessage(access: OpenAccess): string {
  switch (access.reason) {
    case 'early_access':
      return 'Free during early access.';
    case 'free':
      return 'This course is free for everyone.';
    case 'joined_in_early_access':
      return 'Yours from early access.';
    case 'grant':
      return 'This course is yours.';
    case 'membership':
    case 'seat':
      return 'Included in your membership.';
  }
}

function accessLocked(lock: AccessLock): LearningError {
  return new LearningError('access_locked', accessLockMessage(lock), lock);
}

/** What keeps the viewer from the course's lessons, or null when nothing does. */
function courseLock(access: VisibleAccess, enrolled: boolean): LessonLock | null {
  switch (access.kind) {
    case 'manage':
      return null;
    case 'open':
      return enrolled ? null : 'not_enrolled';
    case 'locked':
      switch (access.reason) {
        case 'signed_out':
          return 'signed_out';
        case 'unpriced':
          return 'unpriced';
        case 'payment_required':
          return enrolled ? 'access_ended' : 'payment_required';
      }
  }
}

/** The lock on one lesson: none for a free preview, otherwise the course's. */
function lessonLock(lock: LessonLock | null, lesson: { isPreview: boolean }): LessonLock | null {
  return lesson.isPreview ? null : lock;
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
type LessonRow = PlayerCourse['sections'][number]['lessons'][number];

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

/** The viewer's place in a course they may see. */
export type LearnerState = {
  readonly enrollment: Enrollment | null;
  /** Whether and why the course is open to them. */
  readonly access: VisibleAccess;
  /** What keeps its lessons from them, or null when every lesson is open. */
  readonly lock: LessonLock | null;
};

/** The viewer's place in the course, or null when the rule says it is not published. */
async function learnerState(
  session: Session | null,
  course: CourseForAccess,
): Promise<LearnerState | null> {
  const [enrollment, access] = await Promise.all([
    session ? getEnrollment(session.userId, course.id) : null,
    courseAccessFor(session, course),
  ]);
  if (!isVisible(access)) return null;
  return { enrollment, access, lock: courseLock(access, Boolean(enrollment)) };
}

async function visibleLearnerState(
  session: Session | null,
  course: CourseForAccess,
): Promise<LearnerState> {
  const state = await learnerState(session, course);
  if (!state) throw new LearningError('not_found', 'Course not found.');
  return state;
}

/** The learner's place in a published course, for its page, by slug. */
export async function getLearnerState(session: Session, slug: string): Promise<LearnerState> {
  const course = await getDb().course.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: courseAccessSelect,
  });
  if (!course) throw new LearningError('not_found', 'Course not found.');
  return visibleLearnerState(session, course);
}

/**
 * Puts the learner in the course, or marks them active again if they are in it. It checks
 * nothing: callers settle access first (enroll below, and checkout in Phase 14b inside its
 * transaction). The enrolment date is kept, since it records who joined during early access.
 */
export async function enrollLearner(
  db: Prisma.TransactionClient,
  userId: string,
  courseId: string,
) {
  return db.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId },
    update: { lastActiveAt: new Date() },
  });
}

/** Enroll the signed-in learner in a published course that is open to them. */
export async function enroll(session: Session, slug: string): Promise<void> {
  const course = await publishedCourse(slug);
  const { lock } = await visibleLearnerState(session, course);
  if (isAccessLock(lock)) throw accessLocked(lock);
  await enrollLearner(getDb(), session.userId, course.id);
}

async function completedLessonIds(userId: string, lessonIds: string[]) {
  const rows = await getDb().lessonProgress.findMany({
    where: { userId, lessonId: { in: lessonIds }, completedAt: { not: null } },
    select: { lessonId: true },
  });
  return new Set(rows.map((r) => r.lessonId));
}

/**
 * Whether the viewer may read the lesson (its text, notes and media), as the player decides. The
 * lesson comes with its own course, so it cannot be judged by another.
 */
export async function canReadLesson(
  session: Session | null,
  lesson: { isPreview: boolean; section: { course: CourseForAccess } },
): Promise<boolean> {
  const state = await learnerState(session, lesson.section.course);
  return state !== null && lessonLock(state.lock, lesson) === null;
}

type LessonOutline = Pick<LessonRow, 'id' | 'title' | 'type' | 'durationSeconds' | 'isPreview'> & {
  readonly completed: boolean;
};

/** A lesson the viewer may open, with its text (a text lesson, or notes on a video or PDF). */
export type OpenLesson = LessonOutline & { readonly unlocked: true; readonly body: string | null };

/** A lesson kept from the viewer: only what the course outline shows, and why it is locked. */
export type LockedLesson = LessonOutline & { readonly unlocked: false; readonly lock: LessonLock };

export type PlayerLesson = OpenLesson | LockedLesson;

function playerLesson(row: LessonRow, lock: LessonLock | null, completed: boolean): PlayerLesson {
  const outline = {
    id: row.id,
    title: row.title,
    type: row.type,
    durationSeconds: row.durationSeconds,
    isPreview: row.isPreview,
    completed,
  };
  const onLesson = lessonLock(lock, row);
  return onLesson === null
    ? { ...outline, unlocked: true, body: row.body }
    : { ...outline, unlocked: false, lock: onLesson };
}

/**
 * Everything the player needs for one lesson. Without `lessonId`, picks the first lesson the
 * learner has not completed (resume). Locked lessons come without their text, and media links
 * are only issued for the current lesson when it is open.
 */
export async function getPlayer(session: Session | null, slug: string, lessonId?: string) {
  const course = await publishedCourse(slug);
  const rows = course.sections.flatMap((s) => s.lessons);
  const [{ enrollment, access, lock }, completed] = await Promise.all([
    visibleLearnerState(session, course),
    session
      ? completedLessonIds(
          session.userId,
          rows.map((l) => l.id),
        )
      : new Set<string>(),
  ]);
  const sections = course.sections.map((section) => ({
    id: section.id,
    title: section.title,
    lessons: section.lessons.map((row) => playerLesson(row, lock, completed.has(row.id))),
  }));
  const lessons = sections.flatMap((s) => s.lessons);

  const current = lessonId
    ? lessons.find((l) => l.id === lessonId)
    : (lessons.find((l) => l.unlocked && !l.completed) ?? lessons.find((l) => l.unlocked));
  if (!current) throw new LearningError('not_found', 'Lesson not found.');

  const index = lessons.indexOf(current);
  const mediaKey = current.unlocked ? rows[index].mediaKey : null;
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
    course: { id: course.id, slug: course.slug, title: course.title, category: course.category },
    sections,
    lesson: current,
    mediaUrl: mediaKey ? await signedMediaUrl(mediaKey, PLAYER_LINK_SECONDS) : null,
    resumeAt: progress?.completedAt ? 0 : (progress?.lastPositionSeconds ?? 0),
    previous: lessons[index - 1] ?? null,
    next: lessons[index + 1] ?? null,
    enrolled: Boolean(enrollment),
    /** Whether and why the course is open to the viewer, for wording the enroll panel. */
    access,
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
    include: { section: { include: { course: { select: courseAccessSelect } } } },
  });
  if (!lesson || lesson.section.course.status !== 'PUBLISHED') {
    throw new LearningError('not_found', 'Lesson not found.');
  }
  const courseId = lesson.section.course.id;
  const { enrollment, lock } = await visibleLearnerState(session, lesson.section.course);
  if (!enrollment) throw new LearningError('not_enrolled', 'Enroll to track your progress.');
  if (isAccessLock(lock)) throw accessLocked(lock);

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
 * ended (their purchase or membership no longer opens the course).
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
  const decisions = await courseAccessForMany(
    session,
    enrollments.map((e) => e.course),
  );
  return Promise.all(
    enrollments.map(async (e, index) => {
      const access = decisions[index];
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
        accessEnded: isVisible(access) && courseLock(access, true) === 'access_ended',
      };
    }),
  );
}

import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { hasRole, type Session } from './auth/session';
import { getDb } from './db';
import { signedMediaUrl } from './media';

// Enrollment, the lesson player and progress. Enrollment is free during early access.

export class LearningError extends Error {
  constructor(
    readonly code: 'not_found' | 'not_enrolled',
    message: string,
  ) {
    super(message);
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

/** Owners and admins can open a course without enrolling. */
function manages(session: Session | null, course: { instructorId: string | null }) {
  if (!session) return false;
  return hasRole(session, 'admin') || course.instructorId === session.userId;
}

export async function getEnrollment(userId: string, courseId: string) {
  return getDb().enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
}

/** Enrollment state for a course page, by slug. */
export async function getEnrollmentBySlug(userId: string, slug: string) {
  return getDb().enrollment.findFirst({ where: { userId, course: { slug } } });
}

export async function enroll(session: Session, slug: string) {
  const course = await publishedCourse(slug);
  await getDb().enrollment.upsert({
    where: { userId_courseId: { userId: session.userId, courseId: course.id } },
    create: { userId: session.userId, courseId: course.id },
    update: { lastActiveAt: new Date() },
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
  const enrollment = session ? await getEnrollment(session.userId, course.id) : null;
  const fullAccess = Boolean(enrollment) || manages(session, course);

  const flat = course.sections.flatMap((s) => s.lessons);
  const completed = session
    ? await completedLessonIds(
        session.userId,
        flat.map((l) => l.id),
      )
    : new Set<string>();
  const lessons: PlayerLesson[] = flat.map((l) => ({
    ...l,
    completed: completed.has(l.id),
    unlocked: fullAccess || l.isPreview,
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
    canTrackProgress: Boolean(enrollment),
    completedCount: completed.size,
    totalLessons: lessons.length,
  };
}

/**
 * Save where the learner is and whether the lesson is done. Marks the enrollment complete
 * when every lesson in the course is complete.
 */
export async function saveProgress(
  session: Session,
  lessonId: string,
  update: { positionSeconds?: number; completed?: boolean },
) {
  const lesson = await getDb().lesson.findUnique({
    where: { id: lessonId },
    include: { section: { include: { course: { select: { id: true, status: true } } } } },
  });
  if (!lesson || lesson.section.course.status !== 'PUBLISHED') {
    throw new LearningError('not_found', 'Lesson not found.');
  }
  const courseId = lesson.section.course.id;
  const enrollment = await getEnrollment(session.userId, courseId);
  if (!enrollment) throw new LearningError('not_enrolled', 'Enroll to track your progress.');

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

/** The learner's courses, most recently active first, with progress. */
export async function listMyLearning(userId: string) {
  const enrollments = await getDb().enrollment.findMany({
    where: { userId, course: { status: 'PUBLISHED' } },
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
  return Promise.all(
    enrollments.map(async (e) => {
      const lessonIds = e.course.sections.flatMap((s) => s.lessons.map((l) => l.id));
      const done = (await completedLessonIds(userId, lessonIds)).size;
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
      };
    }),
  );
}

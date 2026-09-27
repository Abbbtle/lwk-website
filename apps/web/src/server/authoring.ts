import 'server-only';
import type { LessonType, Prisma } from '@/generated/prisma/client';
import type { CourseDetailsInput, LessonInput, NewCourseInput } from '@/lib/forms/course';
import { hasRole, type Session } from './auth/session';
import { getDb } from './db';

// Course authoring for instructors (and admins). Every function checks that the session may
// manage the course and that the course is still editable.

export class AuthoringError extends Error {
  constructor(
    readonly code: 'not_found' | 'forbidden' | 'locked' | 'incomplete',
    message: string,
  ) {
    super(message);
  }
}

const editorInclude = {
  category: true,
  sections: {
    orderBy: { position: 'asc' },
    include: { lessons: { orderBy: { position: 'asc' } } },
  },
} satisfies Prisma.CourseInclude;

export type EditableCourse = Prisma.CourseGetPayload<{ include: typeof editorInclude }>;

function canManage(session: Session, course: { instructorId: string | null }) {
  if (hasRole(session, 'admin')) return true;
  return hasRole(session, 'instructor') && course.instructorId === session.userId;
}

/** Drafts are editable by their owner; admins may edit a course in any state. */
function assertEditable(session: Session, course: { status: string }) {
  if (course.status !== 'DRAFT' && !hasRole(session, 'admin')) {
    throw new AuthoringError(
      'locked',
      course.status === 'IN_REVIEW'
        ? 'This course is in review. Withdraw it to make changes.'
        : 'Published courses can only be changed by an admin.',
    );
  }
}

async function loadCourse(session: Session, courseId: string) {
  const course = await getDb().course.findUnique({
    where: { id: courseId },
    include: editorInclude,
  });
  // Same error whether the course is missing or not theirs, so IDs cannot be probed.
  if (!course || !canManage(session, course)) {
    throw new AuthoringError('not_found', 'Course not found.');
  }
  return course;
}

async function loadEditable(session: Session, courseId: string) {
  const course = await loadCourse(session, courseId);
  assertEditable(session, course);
  return course;
}

/** The course a section belongs to (used to refresh the right editor page). */
export async function getSectionCourseId(sectionId: string) {
  const section = await getDb().section.findUnique({
    where: { id: sectionId },
    select: { courseId: true },
  });
  return section?.courseId;
}

async function courseIdOfSection(sectionId: string) {
  const section = await getDb().section.findUnique({ where: { id: sectionId } });
  if (!section) throw new AuthoringError('not_found', 'Section not found.');
  return section.courseId;
}

async function lessonWithCourse(lessonId: string) {
  const lesson = await getDb().lesson.findUnique({
    where: { id: lessonId },
    include: { section: true },
  });
  if (!lesson) throw new AuthoringError('not_found', 'Lesson not found.');
  return lesson;
}

export function slugify(title: string) {
  return (
    title
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50)
      .replace(/-+$/, '') || 'course'
  );
}

async function uniqueSlug(title: string, exceptCourseId?: string) {
  const base = slugify(title);
  const taken = new Set(
    (
      await getDb().course.findMany({
        where: { slug: { startsWith: base }, NOT: exceptCourseId ? { id: exceptCourseId } : {} },
        select: { slug: true },
      })
    ).map((c) => c.slug),
  );
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

async function categoryId(slug: string) {
  const category = await getDb().category.findUnique({ where: { slug } });
  if (!category) throw new AuthoringError('not_found', 'Category not found.');
  return category.id;
}

// ---- Courses ----------------------------------------------------------------

export async function listOwnCourses(session: Session) {
  return getDb().course.findMany({
    where: { instructorId: session.userId },
    orderBy: { updatedAt: 'desc' },
    include: { category: true, _count: { select: { sections: true } } },
  });
}

export async function createCourse(session: Session, input: NewCourseInput) {
  if (!hasRole(session, 'instructor')) throw new AuthoringError('forbidden', 'Instructors only.');
  return getDb().course.create({
    data: {
      title: input.title,
      slug: await uniqueSlug(input.title),
      subtitle: '',
      description: '',
      outcomes: [],
      level: 'BEGINNER',
      status: 'DRAFT',
      instructorId: session.userId,
      instructorName: session.name,
      categoryId: await categoryId(input.categorySlug),
    },
  });
}

export async function getCourseForEditing(session: Session, courseId: string) {
  return loadCourse(session, courseId);
}

export async function updateCourseDetails(
  session: Session,
  courseId: string,
  input: CourseDetailsInput,
) {
  const course = await loadEditable(session, courseId);
  await getDb().course.update({
    where: { id: courseId },
    data: {
      title: input.title,
      // Keep links stable once a course has been published.
      ...(course.publishedAt === null && { slug: await uniqueSlug(input.title, courseId) }),
      subtitle: input.subtitle ?? '',
      description: input.description ?? '',
      outcomes: input.outcomes,
      level: input.level,
      instructorName: input.instructorName,
      categoryId: await categoryId(input.categorySlug),
    },
  });
}

// ---- Sections ---------------------------------------------------------------

export async function addSection(session: Session, courseId: string, title: string) {
  const course = await loadEditable(session, courseId);
  const position = (course.sections.at(-1)?.position ?? -1) + 1;
  await getDb().section.create({ data: { courseId, title, position } });
}

export async function renameSection(session: Session, sectionId: string, title: string) {
  await loadEditable(session, await courseIdOfSection(sectionId));
  await getDb().section.update({ where: { id: sectionId }, data: { title } });
}

export async function deleteSection(session: Session, sectionId: string) {
  await loadEditable(session, await courseIdOfSection(sectionId));
  await getDb().section.delete({ where: { id: sectionId } });
}

/**
 * Swap two siblings' positions. Positions are unique per parent, so one row is parked at a
 * negative position first, all inside one transaction.
 */
async function swapPositions(
  model: 'section' | 'lesson',
  a: { id: string; position: number },
  b: { id: string; position: number },
) {
  await getDb().$transaction(async (tx) => {
    const setPosition = (id: string, position: number) =>
      model === 'section'
        ? tx.section.update({ where: { id }, data: { position } })
        : tx.lesson.update({ where: { id }, data: { position } });
    await setPosition(a.id, -1 - a.position);
    await setPosition(b.id, a.position);
    await setPosition(a.id, b.position);
  });
}

export async function moveSection(session: Session, sectionId: string, direction: 'up' | 'down') {
  const course = await loadEditable(session, await courseIdOfSection(sectionId));
  const index = course.sections.findIndex((s) => s.id === sectionId);
  const other = course.sections[direction === 'up' ? index - 1 : index + 1];
  if (other) await swapPositions('section', course.sections[index], other);
}

// ---- Lessons ----------------------------------------------------------------

export async function addLesson(
  session: Session,
  sectionId: string,
  input: { title: string; type: LessonType },
) {
  const course = await loadEditable(session, await courseIdOfSection(sectionId));
  const section = course.sections.find((s) => s.id === sectionId)!;
  const position = (section.lessons.at(-1)?.position ?? -1) + 1;
  return getDb().lesson.create({
    data: { sectionId, title: input.title, type: input.type, position },
  });
}

export async function updateLesson(session: Session, lessonId: string, input: LessonInput) {
  const lesson = await lessonWithCourse(lessonId);
  await loadEditable(session, lesson.section.courseId);
  await getDb().lesson.update({
    where: { id: lessonId },
    data: {
      title: input.title,
      type: input.type,
      body: input.type === 'TEXT' ? (input.body ?? null) : null,
      isPreview: input.isPreview,
      durationSeconds: input.durationMinutes * 60,
    },
  });
}

export async function deleteLesson(session: Session, lessonId: string) {
  const lesson = await lessonWithCourse(lessonId);
  await loadEditable(session, lesson.section.courseId);
  await getDb().lesson.delete({ where: { id: lessonId } });
  return lesson;
}

export async function moveLesson(session: Session, lessonId: string, direction: 'up' | 'down') {
  const lesson = await lessonWithCourse(lessonId);
  const course = await loadEditable(session, lesson.section.courseId);
  const lessons = course.sections.find((s) => s.id === lesson.sectionId)!.lessons;
  const index = lessons.findIndex((l) => l.id === lessonId);
  const other = lessons[direction === 'up' ? index - 1 : index + 1];
  if (other) await swapPositions('lesson', lessons[index], other);
}

// ---- Review -----------------------------------------------------------------

/** What still needs doing before a course can be submitted. Empty when ready. */
export function reviewChecklist(course: EditableCourse): string[] {
  const missing: string[] = [];
  if (!course.subtitle.trim()) missing.push('Add a subtitle.');
  if (!course.description.trim()) missing.push('Add a description.');
  if (course.outcomes.length === 0) missing.push('List at least one thing learners will learn.');
  if (course.sections.length === 0) missing.push('Add at least one section.');
  for (const section of course.sections) {
    if (section.lessons.length === 0) missing.push(`Add a lesson to "${section.title}".`);
    for (const lesson of section.lessons) {
      if (lesson.type === 'TEXT' && !lesson.body?.trim()) {
        missing.push(`Write the text for "${lesson.title}".`);
      }
      if (lesson.type !== 'TEXT' && !lesson.mediaKey) {
        missing.push(
          `Upload the ${lesson.type === 'VIDEO' ? 'video' : 'PDF'} for "${lesson.title}".`,
        );
      }
    }
  }
  return missing;
}

export async function submitForReview(session: Session, courseId: string) {
  const course = await loadCourse(session, courseId);
  if (course.status !== 'DRAFT')
    throw new AuthoringError('locked', 'Only drafts can be submitted.');
  const missing = reviewChecklist(course);
  if (missing.length > 0) throw new AuthoringError('incomplete', missing.join(' '));
  await getDb().course.update({
    where: { id: courseId },
    data: { status: 'IN_REVIEW', submittedAt: new Date() },
  });
}

export async function withdrawSubmission(session: Session, courseId: string) {
  const course = await loadCourse(session, courseId);
  if (course.status !== 'IN_REVIEW')
    throw new AuthoringError('locked', 'This course is not in review.');
  await getDb().course.update({
    where: { id: courseId },
    data: { status: 'DRAFT', submittedAt: null },
  });
}

import 'server-only';
import { recordAudit } from './audit';
import { hasRole, type Session } from './auth/session';
import { AuthoringError } from './authoring';
import { getDb } from './db';
import { notify } from './notifications';

// Admin decisions on submitted courses.

function assertAdmin(session: Session) {
  if (!hasRole(session, 'admin')) throw new AuthoringError('forbidden', 'Admins only.');
}

export async function listCoursesByStatus(status: 'IN_REVIEW' | 'PUBLISHED' | 'DRAFT') {
  return getDb().course.findMany({
    where: { status },
    // Review queue: longest waiting first.
    orderBy: status === 'IN_REVIEW' ? { submittedAt: 'asc' } : { updatedAt: 'desc' },
    include: { category: true, instructor: { select: { name: true, email: true } } },
    take: 200,
  });
}

export async function countCoursesInReview() {
  return getDb().course.count({ where: { status: 'IN_REVIEW' } });
}

async function transition(
  session: Session,
  courseId: string,
  from: 'IN_REVIEW' | 'PUBLISHED',
  data: Parameters<ReturnType<typeof getDb>['course']['update']>[0]['data'],
  audit: {
    action: string;
    verb: string;
    note?: string;
    tell?: 'published' | 'returned' | 'unpublished';
  },
) {
  assertAdmin(session);
  // Conditional update: only succeeds if the course is still in the expected state.
  const { count } = await getDb().course.updateMany({
    where: { id: courseId, status: from },
    data,
  });
  if (count === 0) {
    throw new AuthoringError('locked', 'The course has changed since this page was loaded.');
  }
  const course = await getDb().course.findUnique({
    where: { id: courseId },
    select: { title: true, slug: true, instructorId: true },
  });
  if (course?.instructorId && audit.tell) {
    const messages = {
      published: { title: `"${course.title}" is published`, href: `/courses/${course.slug}` },
      returned: {
        title: `"${course.title}" needs changes before publishing`,
        href: `/instructor/courses/${courseId}`,
      },
      unpublished: {
        title: `"${course.title}" was unpublished`,
        href: `/instructor/courses/${courseId}`,
      },
    };
    await notify(course.instructorId, {
      kind: `course.${audit.tell}`,
      ...messages[audit.tell],
      body: audit.note,
    });
  }
  await recordAudit(
    { userId: session.userId, name: session.name },
    {
      action: audit.action,
      target: { type: 'course', id: courseId },
      summary: `${audit.verb} "${course?.title ?? courseId}"`,
      ...(audit.note && { details: { note: audit.note } }),
    },
  );
}

export async function publishCourse(session: Session, courseId: string) {
  const course = await getDb().course.findUnique({ where: { id: courseId } });
  await transition(
    session,
    courseId,
    'IN_REVIEW',
    { status: 'PUBLISHED', reviewNote: null, publishedAt: course?.publishedAt ?? new Date() },
    { action: 'course.published', verb: 'Published', tell: 'published' },
  );
}

export async function returnCourse(session: Session, courseId: string, note: string) {
  if (!note.trim()) throw new AuthoringError('incomplete', 'Tell the instructor what to change.');
  await transition(
    session,
    courseId,
    'IN_REVIEW',
    { status: 'DRAFT', reviewNote: note.trim(), submittedAt: null },
    {
      action: 'course.returned',
      verb: 'Returned for changes',
      note: note.trim(),
      tell: 'returned',
    },
  );
}

/** Take a live course back to draft so its instructor can change it. */
export async function unpublishCourse(session: Session, courseId: string, note?: string) {
  await transition(
    session,
    courseId,
    'PUBLISHED',
    { status: 'DRAFT', reviewNote: note?.trim() || null, submittedAt: null },
    {
      action: 'course.unpublished',
      verb: 'Unpublished',
      note: note?.trim() || undefined,
      tell: 'unpublished',
    },
  );
}

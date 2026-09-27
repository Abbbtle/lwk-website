import 'server-only';
import { hasRole, type Session } from './auth/session';
import { AuthoringError } from './authoring';
import { getDb } from './db';

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
}

export async function publishCourse(session: Session, courseId: string) {
  const course = await getDb().course.findUnique({ where: { id: courseId } });
  await transition(session, courseId, 'IN_REVIEW', {
    status: 'PUBLISHED',
    reviewNote: null,
    publishedAt: course?.publishedAt ?? new Date(),
  });
}

export async function returnCourse(session: Session, courseId: string, note: string) {
  if (!note.trim()) throw new AuthoringError('incomplete', 'Tell the instructor what to change.');
  await transition(session, courseId, 'IN_REVIEW', {
    status: 'DRAFT',
    reviewNote: note.trim(),
    submittedAt: null,
  });
}

/** Take a live course back to draft so its instructor can change it. */
export async function unpublishCourse(session: Session, courseId: string, note?: string) {
  await transition(session, courseId, 'PUBLISHED', {
    status: 'DRAFT',
    reviewNote: note?.trim() || null,
    submittedAt: null,
  });
}

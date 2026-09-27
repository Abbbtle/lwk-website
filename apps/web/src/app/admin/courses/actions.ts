'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getSession, hasRole } from '@/server/auth/session';
import { AuthoringError } from '@/server/authoring';
import { publishCourse, returnCourse, unpublishCourse } from '@/server/course-review';

const schema = z.object({
  id: z.uuid(),
  decision: z.enum(['publish', 'return', 'unpublish']),
  note: z.string().max(4000).optional(),
});

export type CourseDecisionState = { error?: string };

export async function decideCourse(
  _prev: CourseDecisionState,
  formData: FormData,
): Promise<CourseDecisionState> {
  const session = await getSession();
  if (!session || !hasRole(session, 'admin')) return { error: 'Not allowed.' };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Invalid request.' };
  const { id, decision, note = '' } = parsed.data;

  try {
    if (decision === 'publish') await publishCourse(session, id);
    else if (decision === 'return') await returnCourse(session, id, note);
    else await unpublishCourse(session, id, note);
  } catch (error) {
    if (error instanceof AuthoringError) return { error: error.message };
    throw error;
  }

  // Catalog pages, the instructor's views and the admin queue all change.
  revalidatePath('/', 'layout');
  redirect('/admin/courses');
}

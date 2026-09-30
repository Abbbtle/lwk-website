'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSession, hasRole, type Session } from '@/server/auth/session';
import { updateCourseFields } from '@/server/authoring';
import { AiToolError } from '@/server/ai/structured';
import * as ai from '@/server/ai/tools';

// Server actions for the AI tools. Each checks the session; the tools check access to the
// lesson, course, application or request, and every result is a draft for a person to review.

type Result<T> = { data: T } | { error: string };

async function attempt<T>(
  role: 'learner' | 'instructor' | 'admin' | 'support',
  work: (session: Session) => Promise<T>,
): Promise<Result<T>> {
  const session = await getSession();
  if (!session) return { error: 'Please log in again.' };
  if (role !== 'learner' && !hasRole(session, role)) return { error: 'Not allowed.' };
  try {
    return { data: await work(session) };
  } catch (error) {
    if (error instanceof AiToolError) return { error: error.message };
    const message = (error as { message?: string }).message ?? '';
    if (/not found|Only drafts|Admins only|Support staff only/i.test(message))
      return { error: message };
    console.error('AI tool action failed', error);
    return { error: 'Something went wrong. Please try again.' };
  }
}

const id = z.uuid();

export async function practiceQuiz(lessonId: string, fresh = false) {
  return attempt('learner', (session) => ai.lessonQuiz(session, id.parse(lessonId), fresh));
}

export async function suggestOutline(courseId: string, brief: ai.OutlineBrief) {
  return attempt('instructor', (session) => ai.draftOutline(session, id.parse(courseId), brief));
}

export async function addOutline(courseId: string, outline: ai.Outline) {
  const result = await attempt('instructor', (session) =>
    ai.applyOutline(session, id.parse(courseId), outline),
  );
  revalidatePath(`/instructor/courses/${courseId}`);
  return result;
}

export async function suggestCourseDetails(courseId: string) {
  return attempt('instructor', (session) => ai.suggestDetails(session, id.parse(courseId)));
}

const field = z.discriminatedUnion('name', [
  z.object({ name: z.literal('subtitle'), value: z.string().trim().min(1).max(200) }),
  z.object({ name: z.literal('description'), value: z.string().trim().min(1).max(5000) }),
  z.object({
    name: z.literal('outcomes'),
    value: z.array(z.string().trim().min(1).max(200)).min(1).max(12),
  }),
]);

export async function applyCourseSuggestion(courseId: string, suggestion: z.input<typeof field>) {
  const result = await attempt('instructor', async (session) => {
    const { name, value } = field.parse(suggestion);
    await updateCourseFields(session, id.parse(courseId), { [name]: value });
  });
  revalidatePath(`/instructor/courses/${courseId}`);
  return result;
}

export async function reviewCourseDraft(courseId: string) {
  return attempt('instructor', (session) => ai.reviewCourse(session, id.parse(courseId)));
}

export async function summariseApplicationWithAi(applicationId: string) {
  return attempt('admin', (session) => ai.summariseApplication(session, id.parse(applicationId)));
}

export async function draftReplyWithAi(ticketNumber: number) {
  return attempt('support', (session) =>
    ai.draftSupportReply(session, z.number().int().min(1).parse(ticketNumber)),
  );
}

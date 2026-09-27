'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSession } from '@/server/auth/session';
import { LearningError, saveProgress } from '@/server/learning';

const id = z.uuid();
const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);

/** Called periodically while a video plays. Failures are ignored; the next save catches up. */
export async function saveVideoPosition(lessonId: string, seconds: number) {
  const session = await getSession();
  if (!session) return;
  try {
    await saveProgress(session, id.parse(lessonId), {
      positionSeconds: z
        .number()
        .min(0)
        .max(24 * 3600)
        .parse(seconds),
    });
  } catch (error) {
    if (!(error instanceof LearningError)) console.error('Saving position failed', error);
  }
}

export async function setLessonComplete(lessonId: string, courseSlug: string, completed: boolean) {
  const session = await getSession();
  if (!session) return { error: 'Sign in to track your progress.' };
  try {
    await saveProgress(session, id.parse(lessonId), { completed: z.boolean().parse(completed) });
  } catch (error) {
    if (error instanceof LearningError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/learn/${slug.parse(courseSlug)}`, 'layout');
  revalidatePath('/my-learning');
  return {};
}

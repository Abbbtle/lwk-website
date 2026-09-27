'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getSession } from '@/server/auth/session';
import { enroll, getPlayer } from '@/server/learning';

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);

export async function enrollInCourse(courseSlug: string) {
  const parsed = slug.parse(courseSlug);
  const session = await getSession();
  if (!session) redirect(`/auth/signup?returnTo=${encodeURIComponent(`/courses/${parsed}`)}`);
  await enroll(session, parsed);
  // Go straight to the lesson to resume (one redirect instead of two).
  const { lesson } = await getPlayer(session, parsed);
  redirect(`/learn/${parsed}/${lesson.id}`);
}

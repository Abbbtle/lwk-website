'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getSession } from '@/server/auth/session';
import { enroll, getPlayer, LearningError } from '@/server/learning';

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);

export async function enrollInCourse(courseSlug: string) {
  const parsed = slug.parse(courseSlug);
  const session = await getSession();
  if (!session) redirect(`/sign-up?returnTo=${encodeURIComponent(`/courses/${parsed}`)}`);
  const enrolled = await enroll(session, parsed).then(
    () => true,
    (error) => {
      if (error instanceof LearningError && error.code === 'payment_required') return false;
      throw error;
    },
  );
  // Not open to them: the course page says why, with a link to Plans & Pricing.
  if (!enrolled) redirect(`/courses/${parsed}`);
  // Go straight to the lesson to resume (one redirect instead of two).
  const { lesson } = await getPlayer(session, parsed);
  redirect(`/learn/${parsed}/${lesson.id}`);
}

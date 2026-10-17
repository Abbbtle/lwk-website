'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSession } from '@/server/auth/session';
import { CHECKLIST_KEYS, dismissChecklist } from '@/server/onboarding';

/** Hide a getting-started checklist for good. */
export async function hideChecklist(key: string) {
  const session = await getSession();
  const parsed = z.enum(CHECKLIST_KEYS).safeParse(key);
  if (!session || !parsed.success) return;
  await dismissChecklist(session.userId, parsed.data);
  revalidatePath('/', 'layout');
}

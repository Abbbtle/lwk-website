'use server';

import { revalidatePath } from 'next/cache';
import { getSession, hasRole } from '@/server/auth/session';
import { checkAiAccess } from '@/server/ai/check';

export type CheckState = { results?: Awaited<ReturnType<typeof checkAiAccess>> };

export async function runAccessCheck(): Promise<CheckState> {
  const session = await getSession();
  if (!session || !hasRole(session, 'admin')) return {};
  const results = await checkAiAccess(session.userId);
  revalidatePath('/admin/ai');
  return { results };
}

'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/server/auth/session';
import { markRead } from '@/server/notifications';

export async function markAllRead() {
  const session = await getSession();
  if (!session) return;
  await markRead(session.userId);
  revalidatePath('/', 'layout');
}

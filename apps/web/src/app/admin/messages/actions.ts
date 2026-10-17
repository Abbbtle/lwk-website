'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSession, hasRole } from '@/server/auth/session';
import { setMessageHandled } from '@/server/contact-messages';

const schema = z.object({ id: z.uuid(), handled: z.enum(['true', 'false']) });

export async function toggleHandled(formData: FormData) {
  const session = await getSession();
  if (!session || !hasRole(session, 'admin')) return;
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await setMessageHandled(parsed.data.id, parsed.data.handled === 'true');
  revalidatePath('/admin', 'layout');
}

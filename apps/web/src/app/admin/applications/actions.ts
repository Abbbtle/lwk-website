'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getSession, hasRole } from '@/server/auth/session';
import {
  ApplicationError,
  approveApplication,
  rejectApplication,
} from '@/server/instructor-applications';

const decisionSchema = z.object({
  id: z.uuid(),
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(2000).optional(),
});

export type DecisionState = { error?: string };

export async function decideApplication(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  // Server actions are public endpoints: check the role here, not only on the page.
  const session = await getSession();
  if (!session || !hasRole(session, 'admin')) return { error: 'Not allowed.' };

  const parsed = decisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Invalid request.' };
  const { id, decision, note } = parsed.data;

  try {
    const reviewer = { userId: session.userId, name: session.name };
    if (decision === 'approve') await approveApplication(id, reviewer, note);
    else await rejectApplication(id, reviewer, note);
  } catch (error) {
    if (error instanceof ApplicationError) return { error: error.message };
    console.error('Application decision failed', error);
    return { error: 'Something went wrong. Please try again.' };
  }

  revalidatePath('/admin', 'layout');
  redirect('/admin/applications');
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSession, hasRole, ROLES } from '@/server/auth/session';
import { clientIp } from '@/server/request-info';
import {
  forceSignOut,
  resetTwoStep,
  setAccountEnabled,
  setUserRole,
  UserAdminError,
} from '@/server/user-admin';

// Server actions are public endpoints: check the role here, not only on the page.

export type AdminActionState = { error?: string; done?: string };

// Cognito user IDs look like UUIDs but do not always follow RFC 9562, so check the shape only.
const userId = z.guid();

async function run(
  targetId: string,
  work: (session: NonNullable<Awaited<ReturnType<typeof getSession>>>, ip: string) => Promise<void>,
  done: string,
): Promise<AdminActionState> {
  const session = await getSession();
  if (!session || !hasRole(session, 'admin')) return { error: 'Not allowed.' };
  const id = userId.safeParse(targetId);
  if (!id.success) return { error: 'Invalid request.' };
  try {
    await work(session, await clientIp());
  } catch (error) {
    if (error instanceof UserAdminError) return { error: error.message };
    console.error('Admin user action failed', error);
    return { error: 'Something went wrong. Please try again.' };
  }
  revalidatePath(`/admin/users/${id.data}`);
  revalidatePath('/admin/users');
  return { done };
}

export async function changeRole(
  targetId: string,
  role: string,
  grant: boolean,
): Promise<AdminActionState> {
  const parsed = z.enum(ROLES).safeParse(role);
  if (!parsed.success) return { error: 'Unknown role.' };
  return run(
    targetId,
    (session, ip) => setUserRole(session, targetId, parsed.data, grant, ip),
    grant ? 'Role given. It works for them straight away.' : 'Role removed.',
  );
}

export async function changeAccountStatus(
  targetId: string,
  enabled: boolean,
): Promise<AdminActionState> {
  return run(
    targetId,
    (session, ip) => setAccountEnabled(session, targetId, enabled, ip),
    enabled ? 'The account can sign in again.' : 'The account is disabled and signed out.',
  );
}

export async function signOutUser(targetId: string): Promise<AdminActionState> {
  return run(
    targetId,
    (session, ip) => forceSignOut(session, targetId, ip),
    'Signed out on all devices.',
  );
}

export async function resetUserTwoStep(targetId: string): Promise<AdminActionState> {
  return run(
    targetId,
    (session, ip) => resetTwoStep(session, targetId, ip),
    'Two-step verification was reset. They can log in with their password and set it up again.',
  );
}

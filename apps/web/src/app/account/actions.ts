'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { type FormState, invalid, parseForm, requiredText } from '@/lib/forms/form-state';
import { AccountError, deleteAccount, syncMfaStatus, updateProfileName } from '@/server/account';
import { clearTokenCookies } from '@/server/auth/cookies';
import { currentAccessToken, refreshSessionNow } from '@/server/auth/refresh';
import { getSession, verifyRecentSignIn } from '@/server/auth/session';
import { RATE_LIMITS, rateLimit, retryMessage } from '@/server/rate-limit';

// Server actions are public endpoints: each one checks the session itself.

const profileSchema = z.object({ name: requiredText('Name', 80) });

export async function updateName(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  const accessToken = await currentAccessToken();
  if (!session || !accessToken) return { status: 'invalid', message: 'Please log in again.' };

  const { result, values } = parseForm(profileSchema, formData);
  if (!result.success) return invalid(result.error, values);

  const limit = await rateLimit(`profile:${session.userId}`, RATE_LIMITS.profile);
  if (!limit.ok) {
    return { status: 'invalid', message: retryMessage(limit.retryAfterSeconds), values };
  }

  try {
    await updateProfileName(session, accessToken, result.data.name);
  } catch (error) {
    console.error('Profile update failed', error);
    return {
      status: 'invalid',
      message: 'Your name could not be saved. Please try again.',
      values,
    };
  }
  // New tokens carry the new name, so the header and menus show it straight away.
  await refreshSessionNow();
  revalidatePath('/', 'layout');
  return { status: 'received', message: 'Your name has been saved.', values };
}

/** Called by the security page after the browser turned two-step verification on or off. */
export async function refreshTwoStepStatus(): Promise<{ enabled?: boolean; error?: string }> {
  const session = await getSession();
  const accessToken = await currentAccessToken();
  if (!session || !accessToken) return { error: 'Please log in again.' };
  try {
    const enabled = await syncMfaStatus(session, accessToken);
    revalidatePath('/', 'layout');
    return { enabled };
  } catch (error) {
    console.error('Two-step status refresh failed', error);
    return { error: 'We could not confirm the change. Reload the page to check.' };
  }
}

/**
 * Delete the account. `freshAccessToken` comes from re-entering the password just now, which
 * proves the request is not from someone who found an unlocked device.
 */
export async function deleteMyAccount(freshAccessToken: string): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Please log in again.' };
  const token = z.string().min(20).max(8192).safeParse(freshAccessToken);
  if (!token.success || (await verifyRecentSignIn(token.data)) !== session.userId) {
    return { error: 'Please confirm your password again.' };
  }
  try {
    await deleteAccount(session, token.data);
  } catch (error) {
    if (error instanceof AccountError) return { error: error.message };
    console.error('Account deletion failed', error);
    return { error: 'Your account could not be deleted. Please try again or contact support.' };
  }
  clearTokenCookies(await cookies());
  redirect('/logged-out?deleted=1');
}

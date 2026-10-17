'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { type FormState, invalid, parseForm } from '@/lib/forms/form-state';
import { newTicketSchema, replySchema } from '@/lib/forms/support';
import { getSession } from '@/server/auth/session';
import { rateLimit, retryMessage } from '@/server/rate-limit';
import {
  createTicket,
  replyAsRequester,
  setMyTicketResolved,
  SupportError,
} from '@/server/support';

// Server actions are public endpoints: each one checks the session, and the support service
// checks that the request belongs to this person.

const number = z.coerce.number().int().min(1);

export async function createSupportRequest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getSession();
  if (!session) return { status: 'invalid', message: 'Please log in again.' };
  const { result, values } = parseForm(newTicketSchema, formData);
  if (!result.success) return invalid(result.error, values);

  const limit = await rateLimit(`support:${session.userId}`, {
    limit: 10,
    windowSeconds: 24 * 60 * 60,
  });
  if (!limit.ok) {
    return {
      status: 'invalid',
      message: `You have sent several requests today. ${retryMessage(limit.retryAfterSeconds)} You can add to an existing request instead.`,
      values,
    };
  }

  const { includeBrowser, ...input } = result.data;
  const ticket = await createTicket(session, {
    ...input,
    userAgent: includeBrowser ? ((await headers()).get('user-agent') ?? undefined) : undefined,
  });
  revalidatePath('/support');
  redirect(`/support/${ticket.number}?new=1`);
}

export async function replyToRequest(
  ticketNumber: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getSession();
  if (!session) return { status: 'invalid', message: 'Please log in again.' };
  const { result, values } = parseForm(replySchema, formData);
  if (!result.success) return invalid(result.error, values);
  try {
    await replyAsRequester(session, number.parse(ticketNumber), result.data.body);
  } catch (error) {
    if (error instanceof SupportError) return { status: 'invalid', message: error.message, values };
    throw error;
  }
  revalidatePath(`/support/${ticketNumber}`);
  return { status: 'received', message: 'Sent. We will reply as soon as we can.' };
}

export async function markResolved(ticketNumber: number, resolved: boolean) {
  const session = await getSession();
  if (!session) return;
  await setMyTicketResolved(session, number.parse(ticketNumber), resolved);
  revalidatePath(`/support/${ticketNumber}`);
  revalidatePath('/support');
}

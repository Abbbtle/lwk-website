'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { type FormState, invalid, parseForm } from '@/lib/forms/form-state';
import { staffReplySchema, ticketDetailsSchema } from '@/lib/forms/support';
import { getSession, hasRole } from '@/server/auth/session';
import { replyAsStaff, SupportError, updateTicket } from '@/server/support';

// Server actions are public endpoints: check the role here; the service checks it again.

async function staff() {
  const session = await getSession();
  if (!session || !hasRole(session, 'support')) throw new Error('Not allowed.');
  return session;
}

const number = z.coerce.number().int().min(1);

function refresh(ticketNumber: number) {
  revalidatePath(`/admin/support/${ticketNumber}`);
  revalidatePath('/admin/support');
}

export async function staffReply(
  ticketNumber: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await staff();
  const { result, values } = parseForm(staffReplySchema, formData);
  if (!result.success) return invalid(result.error, values);
  const { body, mode, resolve } = result.data;
  try {
    await replyAsStaff(session, number.parse(ticketNumber), body, {
      internal: mode === 'note',
      resolve: mode === 'reply' && resolve,
    });
  } catch (error) {
    if (error instanceof SupportError) return { status: 'invalid', message: error.message, values };
    throw error;
  }
  refresh(ticketNumber);
  return {
    status: 'received',
    message: mode === 'note' ? 'Note added.' : resolve ? 'Sent and resolved.' : 'Reply sent.',
  };
}

export async function saveTicketDetails(
  ticketNumber: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await staff();
  const { result, values } = parseForm(ticketDetailsSchema, formData);
  if (!result.success) return invalid(result.error, values);
  try {
    await updateTicket(session, number.parse(ticketNumber), result.data);
  } catch (error) {
    if (error instanceof SupportError) return { status: 'invalid', message: error.message, values };
    throw error;
  }
  refresh(ticketNumber);
  return { status: 'received', message: 'Saved.', values };
}

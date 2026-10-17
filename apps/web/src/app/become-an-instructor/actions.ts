'use server';

import { type FormState, invalid, parseForm } from '@/lib/forms/form-state';
import { instructorApplicationSchema } from '@/lib/forms/instructor-application';
import { getSession } from '@/server/auth/session';
import { ApplicationError, submitInstructorApplication } from '@/server/instructor-applications';
import { RATE_LIMITS, rateLimit, retryMessage } from '@/server/rate-limit';

export async function submitApplication(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) {
    return { status: 'invalid', message: 'Please sign in to apply.' };
  }

  const { result, values } = parseForm(instructorApplicationSchema, formData);
  if (!result.success) return invalid(result.error, values);

  const limit = await rateLimit(`application:${session.userId}`, RATE_LIMITS.instructorApplication);
  if (!limit.ok) {
    return { status: 'invalid', message: retryMessage(limit.retryAfterSeconds), values };
  }

  try {
    await submitInstructorApplication(session.userId, result.data);
  } catch (error) {
    if (error instanceof ApplicationError) return { status: 'invalid', message: error.message };
    throw error;
  }

  // No page refresh here: the form swaps itself for this confirmation; the page shows
  // "under review" on the next visit.
  return {
    status: 'received',
    message: 'Thank you! Your application has been received and will be reviewed soon.',
  };
}

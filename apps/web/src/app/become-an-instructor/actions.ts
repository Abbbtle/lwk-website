'use server';

import { revalidatePath } from 'next/cache';
import { type FormState, invalid, parseForm } from '@/lib/forms/form-state';
import { instructorApplicationSchema } from '@/lib/forms/instructor-application';
import { getSession } from '@/server/auth/session';
import { ApplicationError, submitInstructorApplication } from '@/server/instructor-applications';

export async function submitApplication(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) {
    return { status: 'invalid', message: 'Please sign in to apply.' };
  }

  const { result, values } = parseForm(instructorApplicationSchema, formData);
  if (!result.success) return invalid(result.error, values);

  try {
    await submitInstructorApplication(session.userId, result.data);
  } catch (error) {
    if (error instanceof ApplicationError) return { status: 'invalid', message: error.message };
    throw error;
  }

  revalidatePath('/become-an-instructor');
  return {
    status: 'received',
    message: 'Thank you! Your application has been received and will be reviewed soon.',
  };
}

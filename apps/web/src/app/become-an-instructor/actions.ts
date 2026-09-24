'use server';

import { type FormState, invalid, parseForm } from '@/lib/forms/form-state';
import { instructorApplicationSchema } from '@/lib/forms/instructor-application';
import { site } from '@/lib/site';

export async function submitInstructorApplication(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { result, values } = parseForm(instructorApplicationSchema, formData);
  if (!result.success) return invalid(result.error, values);

  // TODO(Phase 4): store the application for admin review.
  return {
    status: 'received',
    message: `Your application is complete. Applications are not being saved online yet, so please also email your details to ${site.supportEmail}.`,
    values,
  };
}

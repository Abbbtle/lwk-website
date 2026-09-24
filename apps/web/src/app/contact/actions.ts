'use server';

import { contactSchema } from '@/lib/forms/contact';
import { type FormState, invalid, parseForm } from '@/lib/forms/form-state';
import { site } from '@/lib/site';

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const { result, values } = parseForm(contactSchema, formData);
  if (!result.success) return invalid(result.error, values);

  // TODO(Phase 4): store the message for the admin inbox instead of asking for an email.
  return {
    status: 'received',
    message: `Thank you. Online messages are not being saved yet, so please also email ${site.supportEmail} and we will reply there.`,
    values,
  };
}

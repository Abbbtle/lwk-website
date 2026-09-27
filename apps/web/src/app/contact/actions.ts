'use server';

import { contactSchema } from '@/lib/forms/contact';
import { type FormState, invalid, parseForm } from '@/lib/forms/form-state';
import { saveContactMessage } from '@/server/contact-messages';

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const { result, values } = parseForm(contactSchema, formData);
  if (!result.success) return invalid(result.error, values);

  await saveContactMessage(result.data);
  return {
    status: 'received',
    message: 'Thank you for your message. We will reply to you by email.',
  };
}

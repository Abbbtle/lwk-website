'use server';

import { isBot } from '@/components/honeypot';
import { contactSchema } from '@/lib/forms/contact';
import { type FormState, invalid, parseForm } from '@/lib/forms/form-state';
import { saveContactMessage } from '@/server/contact-messages';
import { RATE_LIMITS, rateLimit, retryMessage } from '@/server/rate-limit';
import { clientIp } from '@/server/request-info';

const received: FormState = {
  status: 'received',
  message: 'Thank you for your message. We will reply to you by email.',
};

export async function submitContact(_prev: FormState, formData: FormData): Promise<FormState> {
  // Looks the same to a bot as a real submission, but nothing is stored.
  if (isBot(formData)) return received;

  const { result, values } = parseForm(contactSchema, formData);
  if (!result.success) return invalid(result.error, values);

  const limit = await rateLimit(`contact:${await clientIp()}`, RATE_LIMITS.contact);
  if (!limit.ok) {
    return {
      status: 'invalid',
      message: `You have sent several messages already. ${retryMessage(limit.retryAfterSeconds)}`,
      values,
    };
  }

  await saveContactMessage(result.data);
  return received;
}

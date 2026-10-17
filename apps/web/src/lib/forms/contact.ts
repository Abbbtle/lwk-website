import { z } from 'zod';
import { optionalText, requiredText } from './form-state';

export const inquiryTypes = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'support', label: 'Customer Support' },
  { value: 'partnership', label: 'Partnership Opportunities' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'other', label: 'Other' },
] as const;

export const contactSchema = z.object({
  name: requiredText('Name', 120),
  email: z.email('Enter a valid email address.').max(254),
  company: optionalText(120),
  inquiryType: z.enum(inquiryTypes.map((t) => t.value) as [string, ...string[]], {
    error: 'Choose the nature of your inquiry.',
  }),
  message: requiredText('Message', 5000),
});

export type ContactMessage = z.infer<typeof contactSchema>;

import { z } from 'zod';
import { requiredText } from './form-state';

export const ticketCategory = z.enum(
  ['ACCOUNT', 'LEARNING', 'TEACHING', 'TECHNICAL', 'FEEDBACK', 'OTHER'],
  { error: 'Choose what your request is about.' },
);

export const newTicketSchema = z.object({
  category: ticketCategory,
  subject: requiredText('Subject', 150).pipe(
    z.string().min(4, 'Write a few words about your request.'),
  ),
  body: requiredText('Message', 5000).pipe(
    z.string().min(10, 'Tell us a little more so we can help.'),
  ),
  // The page the request is about (a path on this site).
  pageUrl: z
    .string()
    .max(300)
    .optional()
    .transform((v) => (v && v.startsWith('/') && !v.startsWith('//') ? v : undefined)),
  includeBrowser: z
    .string()
    .optional()
    .transform((v) => v === 'on'),
});

export const replySchema = z.object({ body: requiredText('Reply', 5000) });

export const staffReplySchema = z.object({
  body: requiredText('Message', 5000),
  mode: z.enum(['reply', 'note']).default('reply'),
  resolve: z
    .string()
    .optional()
    .transform((v) => v === 'on'),
});

export const ticketDetailsSchema = z.object({
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  // Empty means unassigned. Staff IDs are Cognito IDs (checked by shape only).
  assigneeId: z
    .string()
    .optional()
    .transform((v) => v || null)
    .pipe(z.guid().nullable()),
});

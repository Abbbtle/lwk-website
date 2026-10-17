import { z } from 'zod';
import { fail, handleErrors, ok } from '@/server/api';
import { getSession } from '@/server/auth/session';
import { rateLimit } from '@/server/rate-limit';
import { createTicket } from '@/server/support';

const bodySchema = z.object({
  subject: z.string().trim().min(4).max(150),
  note: z.string().trim().max(2000).optional(),
  transcript: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(6000) }))
    .min(1)
    .max(20),
  path: z.string().max(300).startsWith('/').optional(),
});

// "Send this conversation to support": turns the chat into a support request, with the
// conversation included so nobody has to repeat themselves.
export const POST = handleErrors(async (request: Request) => {
  const session = await getSession();
  if (!session) return fail(401, 'unauthorized', 'Please log in to send a support request.');
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, 'bad_request', 'Invalid request.');
  const limit = await rateLimit(`support:${session.userId}`, {
    limit: 10,
    windowSeconds: 24 * 60 * 60,
  });
  if (!limit.ok) return fail(429, 'rate_limited', 'You have sent several requests today.');

  const { subject, note, transcript, path } = parsed.data;
  const conversation = transcript
    .map((turn) => `**${turn.role === 'user' ? 'Me' : 'Assistant'}:** ${turn.content}`)
    .join('\n\n');
  const ticket = await createTicket(session, {
    category: 'OTHER',
    subject,
    body: `${note ? `${note}\n\n` : ''}My conversation with the assistant:\n\n${conversation}`,
    pageUrl: path,
  });
  return ok({ number: ticket.number });
});

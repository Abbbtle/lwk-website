import { z } from 'zod';
import { fail, handleErrors, ok } from '@/server/api';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db';
import { rateLimit } from '@/server/rate-limit';
import { ipFromHeaders } from '@/server/request-info';

const bodySchema = z.object({
  helpful: z.boolean(),
  question: z.string().trim().min(1).max(2000),
  answer: z.string().trim().min(1).max(6000),
  path: z.string().max(300).optional(),
  comment: z.string().trim().max(1000).optional(),
});

// A thumbs up or down on an assistant answer. The question and answer are kept only because the
// person chose to rate them, so staff can improve the help content.
export const POST = handleErrors(async (request: Request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, 'bad_request', 'Invalid feedback.');
  const limit = await rateLimit(`assistant-feedback:${ipFromHeaders(request.headers)}`, {
    limit: 40,
    windowSeconds: 60 * 60,
  });
  if (!limit.ok) return ok({ received: true });
  const session = await getSession();
  await getDb().aiFeedback.create({
    data: { ...parsed.data, feature: 'assistant', userId: session?.userId ?? null },
  });
  return ok({ received: true });
});

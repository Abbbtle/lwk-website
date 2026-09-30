import { z } from 'zod';
import { fail, handleErrors, ok } from '@/server/api';
import { getSession } from '@/server/auth/session';
import { recordHelpFeedback } from '@/server/help-feedback';
import { rateLimit } from '@/server/rate-limit';
import { ipFromHeaders } from '@/server/request-info';

const bodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  helpful: z.boolean(),
  comment: z.string().trim().max(1000).optional(),
});

// "Was this article helpful?"
export const POST = handleErrors(async (request: Request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, 'bad_request', 'Invalid feedback.');
  const limit = await rateLimit(`help-feedback:${ipFromHeaders(request.headers)}`, {
    limit: 30,
    windowSeconds: 60 * 60,
  });
  if (!limit.ok) return fail(429, 'rate_limited', 'Thank you, we have your feedback.');
  const session = await getSession();
  await recordHelpFeedback({ ...parsed.data, userId: session?.userId });
  return ok({ received: true });
});

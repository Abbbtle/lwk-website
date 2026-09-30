import { z } from 'zod';
import { fail, handleErrors, ok } from '@/server/api';
import { getSession } from '@/server/auth/session';
import { markRead } from '@/server/notifications';

const bodySchema = z.object({ id: z.uuid().optional() });

// Mark one notification, or all of them, as read.
export const POST = handleErrors(async (request: Request) => {
  const session = await getSession();
  if (!session) return fail(401, 'unauthorized', 'Sign in required.');
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return fail(400, 'bad_request', 'Invalid request.');
  await markRead(session.userId, parsed.data.id);
  return ok({ done: true });
});

import { fail, handleErrors, ok } from '@/server/api';
import { getSession } from '@/server/auth/session';

// The signed-in user (from the session cookies), or 401.
export const GET = handleErrors(async () => {
  const session = await getSession();
  if (!session) return fail(401, 'unauthorized', 'Sign in required.');
  return ok(session);
});

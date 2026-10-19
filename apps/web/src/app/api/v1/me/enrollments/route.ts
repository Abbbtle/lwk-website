import { fail, handleErrors, ok } from '@/server/api';
import { getSession } from '@/server/auth/session';
import { listMyLearning } from '@/server/learning';

// The signed-in learner's courses with progress (and whether their access has ended), most
// recently active first.
export const GET = handleErrors(async () => {
  const session = await getSession();
  if (!session) return fail(401, 'unauthorized', 'Sign in required.');
  return ok(await listMyLearning(session));
});

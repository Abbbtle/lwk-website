import { exportAccountData } from '@/server/account';
import { fail, handleErrors } from '@/server/api';
import { getSession } from '@/server/auth/session';
import { RATE_LIMITS, rateLimit } from '@/server/rate-limit';

// "Download my data": everything stored about the signed-in user as a JSON file.
export const GET = handleErrors(async () => {
  const session = await getSession();
  if (!session) return fail(401, 'unauthorized', 'Sign in required.');
  const limit = await rateLimit(`export:${session.userId}`, RATE_LIMITS.dataExport);
  if (!limit.ok) return fail(429, 'rate_limited', 'Too many downloads. Please try again later.');

  const data = await exportAccountData(session.userId);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="living-with-krishna-data-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  });
});

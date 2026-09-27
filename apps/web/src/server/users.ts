import 'server-only';
import { getDb } from './db';

/** Create the user's row on first sign-in and keep email and name in step with Cognito. */
export async function recordSignIn(user: { id: string; email: string; name: string }) {
  const now = new Date();
  await getDb().user.upsert({
    where: { id: user.id },
    create: { ...user, lastSignInAt: now },
    update: { email: user.email, name: user.name, lastSignInAt: now },
  });
}

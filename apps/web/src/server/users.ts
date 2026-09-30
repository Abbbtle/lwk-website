import 'server-only';
import type { Role } from './auth/session';
import { getDb } from './db';

/**
 * Create the user's row on first sign-in and keep email, name, roles and two-step status in step
 * with Cognito. `mfaEnabled` is left alone when it could not be read.
 */
export async function recordSignIn(user: {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  mfaEnabled?: boolean;
}) {
  const now = new Date();
  const { id, email, name, roles, mfaEnabled } = user;
  await getDb().user.upsert({
    where: { id },
    create: { id, email, name, roles, mfaEnabled: mfaEnabled ?? false, lastSignInAt: now },
    update: {
      email,
      name,
      roles,
      ...(mfaEnabled !== undefined && { mfaEnabled }),
      lastSignInAt: now,
    },
  });
}

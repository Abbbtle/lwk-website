import type { Session } from '../src/server/auth/session';

/** A signed-in session for a test user, as the app sees it after verifying their tokens. */
export function testSession(
  user: { id: string; email: string; name: string },
  roles: Session['roles'] = [],
): Session {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    roles,
    issuedAt: Math.floor(Date.now() / 1000),
    mfaEnabled: true,
    lockedRoles: [],
  };
}

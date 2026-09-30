import 'server-only';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { getAuthConfig } from './config';
import { AUTH_COOKIES } from './cookies';

export const ROLES = ['admin', 'instructor'] as const;
export type Role = (typeof ROLES)[number];

export type Session = {
  userId: string;
  email: string;
  name: string;
  /** Cognito groups that grant extra access. Every signed-in user is a learner. */
  roles: Role[];
};

type Jwks = Parameters<ReturnType<typeof CognitoJwtVerifier.create>['cacheJwks']>[0];

/** Verifies the access and ID token pair against the user pool's signing keys. */
export function createSessionVerifier({
  userPoolId,
  clientId,
}: {
  userPoolId: string;
  clientId: string;
}) {
  const accessVerifier = CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: 'access' });
  const idVerifier = CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: 'id' });

  return {
    async verify(accessToken?: string, idToken?: string): Promise<Session | null> {
      if (!accessToken || !idToken) return null;
      try {
        const [access, id] = await Promise.all([
          accessVerifier.verify(accessToken),
          idVerifier.verify(idToken),
        ]);
        if (access.sub !== id.sub) return null;
        const groups = access['cognito:groups'] ?? [];
        return {
          userId: access.sub,
          email: String(id.email),
          name: String(id.name ?? id.email),
          roles: ROLES.filter((role) => groups.includes(role)),
        };
      } catch {
        // Expired, tampered with, or issued for another pool or client.
        return null;
      }
    },
    /** Pre-load signing keys (tests use this to avoid fetching them from Cognito). */
    cacheJwks(jwks: Jwks) {
      accessVerifier.cacheJwks(jwks);
      idVerifier.cacheJwks(jwks);
    },
  };
}

let verifier: ReturnType<typeof createSessionVerifier> | undefined;

/** Verify an access and ID token pair issued by this app's user pool and client. */
export function verifyTokens(accessToken: string, idToken: string): Promise<Session | null> {
  verifier ??= createSessionVerifier(getAuthConfig());
  return verifier.verify(accessToken, idToken);
}

/** The signed-in user for this request, or null. Verified on every request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  const accessToken = jar.get(AUTH_COOKIES.access)?.value;
  const idToken = jar.get(AUTH_COOKIES.id)?.value;
  // Visitors without tokens never need the auth settings (e.g. pages prerendered at build time).
  if (!accessToken || !idToken) return null;
  return verifyTokens(accessToken, idToken);
});

/** Admins can do everything an instructor can. */
export function hasRole(session: Session, role: Role): boolean {
  return session.roles.includes('admin') || session.roles.includes(role);
}

/** For pages that need a signed-in user: sends visitors to sign in, then back here. */
export async function requireSession(returnTo: string): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  return session;
}

/** For role-restricted pages: users without the role get a 404, so the page's existence isn't revealed. */
export async function requireRole(role: Role, returnTo: string): Promise<Session> {
  const session = await requireSession(returnTo);
  if (!hasRole(session, role)) notFound();
  return session;
}

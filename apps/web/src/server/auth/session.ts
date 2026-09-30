import 'server-only';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { getDb } from '../db';
import { getAuthConfig } from './config';
import { AUTH_COOKIES } from './cookies';

export const ROLES = ['admin', 'instructor'] as const;
export type Role = (typeof ROLES)[number];

/** What a verified token pair says about the user. */
export type TokenIdentity = {
  userId: string;
  email: string;
  name: string;
  /** Cognito groups in the token that grant extra access. */
  roles: Role[];
  /** When the access token was issued (seconds since the epoch). */
  issuedAt: number;
};

export type Session = TokenIdentity & {
  /** Two-step verification (authenticator app) is on. */
  mfaEnabled: boolean;
  /**
   * The user is an admin but has not turned on two-step verification yet. Admin tools stay
   * locked (the admin role is left out of `roles`) until they do.
   */
  adminNeedsMfa: boolean;
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
    async verify(accessToken?: string, idToken?: string): Promise<TokenIdentity | null> {
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
          issuedAt: access.iat,
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
export function verifyTokens(accessToken: string, idToken: string): Promise<TokenIdentity | null> {
  verifier ??= createSessionVerifier(getAuthConfig());
  return verifier.verify(accessToken, idToken);
}

let recentSignInVerifier: ReturnType<typeof createRecentSignInVerifier> | undefined;

/**
 * Step-up check for irreversible actions (e.g. deleting the account): the browser re-enters the
 * password, gets a fresh access token and sends it along. Returns the user ID if the token is
 * valid and the password was entered within `maxAgeSeconds`.
 */
export function createRecentSignInVerifier({
  userPoolId,
  clientId,
}: {
  userPoolId: string;
  clientId: string;
}) {
  const accessVerifier = CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: 'access' });
  return {
    async verify(accessToken: string, maxAgeSeconds: number): Promise<string | null> {
      try {
        const access = await accessVerifier.verify(accessToken);
        const authTime = Number(access.auth_time);
        if (!authTime || Date.now() / 1000 - authTime > maxAgeSeconds) return null;
        return access.sub;
      } catch {
        return null;
      }
    },
    cacheJwks(jwks: Jwks) {
      accessVerifier.cacheJwks(jwks);
    },
  };
}

export function verifyRecentSignIn(accessToken: string, maxAgeSeconds = 10 * 60) {
  recentSignInVerifier ??= createRecentSignInVerifier(getAuthConfig());
  return recentSignInVerifier.verify(accessToken, maxAgeSeconds);
}

/** The parts of the stored account that can override what a token says. */
export type AccountState = {
  roles: string[];
  rolesChangedAt: Date | null;
  sessionsValidAfter: Date | null;
  mfaEnabled: boolean;
  disabledAt: Date | null;
};

const epochSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

/**
 * Combine a verified token with the account's stored state. Returns null when the session has
 * been revoked (signed out everywhere, disabled) since the token was issued. Role changes made
 * after the token was issued apply immediately instead of at the next token refresh.
 */
export function applyAccountState(
  identity: TokenIdentity,
  account: AccountState | null,
  { requireAdminMfa }: { requireAdminMfa: boolean },
): Session | null {
  if (account?.disabledAt) return null;
  if (account?.sessionsValidAfter && identity.issuedAt < epochSeconds(account.sessionsValidAfter)) {
    return null;
  }
  const roles =
    account?.rolesChangedAt && identity.issuedAt < epochSeconds(account.rolesChangedAt)
      ? ROLES.filter((role) => account.roles.includes(role))
      : identity.roles;
  const mfaEnabled = account?.mfaEnabled ?? false;
  const adminNeedsMfa = requireAdminMfa && roles.includes('admin') && !mfaEnabled;
  return {
    ...identity,
    roles: adminNeedsMfa ? roles.filter((role) => role !== 'admin') : roles,
    mfaEnabled,
    adminNeedsMfa,
  };
}

/** Admins must use two-step verification. Only turned off for local experiments. */
export function adminMfaRequired() {
  return process.env.REQUIRE_ADMIN_MFA !== 'false';
}

/** The signed-in user for this request, or null. Verified on every request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  const accessToken = jar.get(AUTH_COOKIES.access)?.value;
  const idToken = jar.get(AUTH_COOKIES.id)?.value;
  // Visitors without tokens never need the auth settings (e.g. pages prerendered at build time).
  if (!accessToken || !idToken) return null;
  const identity = await verifyTokens(accessToken, idToken);
  if (!identity) return null;
  const account = await getDb().user.findUnique({
    where: { id: identity.userId },
    select: {
      roles: true,
      rolesChangedAt: true,
      sessionsValidAfter: true,
      mfaEnabled: true,
      disabledAt: true,
    },
  });
  return applyAccountState(identity, account, { requireAdminMfa: adminMfaRequired() });
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

/**
 * For role-restricted pages: users without the role get a 404, so the page's existence isn't
 * revealed. Admins without two-step verification are sent to set it up first.
 */
export async function requireRole(role: Role, returnTo: string): Promise<Session> {
  const session = await requireSession(returnTo);
  if (session.adminNeedsMfa && !hasRole(session, role)) {
    redirect(`/account/security?required=admin&returnTo=${encodeURIComponent(returnTo)}`);
  }
  if (!hasRole(session, role)) notFound();
  return session;
}

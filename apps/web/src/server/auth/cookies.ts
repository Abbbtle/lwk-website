// Auth cookies. Tokens only ever live in HttpOnly cookies, so page scripts cannot read them.
// Also used by src/proxy.ts, so this module must not import `server-only`.
import type { NextResponse } from 'next/server';
import { getAuthConfig } from './config';

export const AUTH_COOKIES = {
  access: 'lwk_access',
  id: 'lwk_id',
  refresh: 'lwk_refresh',
  /** PKCE verifier, state, nonce and return path for a sign-in in progress. */
  transaction: 'lwk_auth_tx',
} as const;

type ResponseCookies = NextResponse['cookies'];

const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // Matches the app client's refresh token validity.
const TRANSACTION_MAX_AGE = 10 * 60;

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: getAuthConfig().secureCookies,
    // Lax so the cookies arrive on the redirect back from the hosted sign-in page.
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export type TokenSet = {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

export function setTokenCookies(cookies: ResponseCookies, tokens: TokenSet) {
  const maxAge = tokens.expires_in ?? 900;
  cookies.set(AUTH_COOKIES.access, tokens.access_token, cookieOptions(maxAge));
  if (tokens.id_token) cookies.set(AUTH_COOKIES.id, tokens.id_token, cookieOptions(maxAge));
  // Rotation returns a new refresh token on every refresh; keep the latest.
  if (tokens.refresh_token) {
    cookies.set(AUTH_COOKIES.refresh, tokens.refresh_token, cookieOptions(REFRESH_TOKEN_MAX_AGE));
  }
}

export function clearTokenCookies(cookies: ResponseCookies) {
  for (const name of [AUTH_COOKIES.access, AUTH_COOKIES.id, AUTH_COOKIES.refresh]) {
    cookies.set(name, '', cookieOptions(0));
  }
}

export type SignInTransaction = {
  codeVerifier: string;
  state: string;
  nonce: string;
  returnTo: string;
};

export function setTransactionCookie(cookies: ResponseCookies, tx: SignInTransaction) {
  cookies.set(AUTH_COOKIES.transaction, JSON.stringify(tx), cookieOptions(TRANSACTION_MAX_AGE));
}

export function readTransaction(value: string | undefined): SignInTransaction | undefined {
  if (!value) return undefined;
  try {
    const tx = JSON.parse(value) as Partial<SignInTransaction>;
    if (tx.codeVerifier && tx.state && tx.nonce && tx.returnTo) return tx as SignInTransaction;
  } catch {
    // Malformed cookie: treat as no sign-in in progress.
  }
  return undefined;
}

/** Seconds until a JWT expires, read without verifying it (used only to decide when to refresh). */
export function secondsUntilExpiry(jwt: string | undefined): number {
  if (!jwt) return 0;
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
    return typeof payload.exp === 'number' ? payload.exp - Math.floor(Date.now() / 1000) : 0;
  } catch {
    return 0;
  }
}

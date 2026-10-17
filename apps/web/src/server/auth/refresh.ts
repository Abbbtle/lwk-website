import 'server-only';
import { cookies } from 'next/headers';
import * as oidc from 'openid-client';
import { getOidcConfig } from './config';
import { AUTH_COOKIES, setTokenCookies } from './cookies';

/** The signed-in user's access token from the session cookie (for Cognito self-service calls). */
export async function currentAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(AUTH_COOKIES.access)?.value;
}

/**
 * Fetch new tokens now (e.g. after the display name changed, so the header shows it at once).
 * Only callable where cookies can be set: server actions and route handlers. Best effort.
 */
export async function refreshSessionNow() {
  const jar = await cookies();
  const refreshToken = jar.get(AUTH_COOKIES.refresh)?.value;
  if (!refreshToken) return;
  try {
    const tokens = await oidc.refreshTokenGrant(await getOidcConfig(), refreshToken);
    setTokenCookies(jar, tokens);
  } catch (error) {
    console.error('Session refresh failed', error);
  }
}

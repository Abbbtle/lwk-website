import { type NextRequest, NextResponse } from 'next/server';
import * as oidc from 'openid-client';
import { getOidcConfig } from '@/server/auth/config';
import {
  AUTH_COOKIES,
  clearTokenCookies,
  secondsUntilExpiry,
  setTokenCookies,
} from '@/server/auth/cookies';

// Refresh at most this many seconds before the access token expires.
const REFRESH_MARGIN_SECONDS = 60;

/**
 * Keeps signed-in users signed in: when the short-lived access token is (nearly) expired and a
 * refresh token exists, fetch new tokens before the page renders. Authorization itself still
 * happens on the server for every request (src/server/auth/session.ts).
 */
export async function proxy(request: NextRequest) {
  const refreshToken = request.cookies.get(AUTH_COOKIES.refresh)?.value;
  const accessToken = request.cookies.get(AUTH_COOKIES.access)?.value;
  if (!refreshToken || secondsUntilExpiry(accessToken) > REFRESH_MARGIN_SECONDS) {
    return NextResponse.next();
  }

  try {
    const tokens = await oidc.refreshTokenGrant(await getOidcConfig(), refreshToken);
    // Update this request's cookies too, so the page rendered now sees the new tokens.
    request.cookies.set(AUTH_COOKIES.access, tokens.access_token);
    if (tokens.id_token) request.cookies.set(AUTH_COOKIES.id, tokens.id_token);
    if (tokens.refresh_token) request.cookies.set(AUTH_COOKIES.refresh, tokens.refresh_token);
    const response = NextResponse.next({ request: { headers: request.headers } });
    setTokenCookies(response.cookies, tokens);
    return response;
  } catch (error) {
    // Refresh token expired or revoked: the user is signed out.
    if (error instanceof oidc.ResponseBodyError && error.error === 'invalid_grant') {
      request.cookies.delete([AUTH_COOKIES.access, AUTH_COOKIES.id, AUTH_COOKIES.refresh]);
      const response = NextResponse.next({ request: { headers: request.headers } });
      clearTokenCookies(response.cookies);
      return response;
    }
    // Anything else (e.g. Cognito unreachable): carry on; the page treats the user as signed out.
    console.error('Token refresh failed', error);
    return NextResponse.next();
  }
}

export const config = {
  // Skip static assets and the auth routes themselves.
  matcher: ['/((?!_next/static|_next/image|auth/|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt)$).*)'],
};

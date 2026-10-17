import { type NextRequest, NextResponse } from 'next/server';
import * as oidc from 'openid-client';
import { getOidcConfig } from '@/server/auth/config';
import {
  AUTH_COOKIES,
  clearTokenCookies,
  secondsUntilExpiry,
  setTokenCookies,
  type TokenSet,
} from '@/server/auth/cookies';
import { contentSecurityPolicy, createNonce } from '@/server/security/csp';
import { checkOrigin, ORIGIN_HEADER } from '@/server/security/origin';

// Refresh at most this many seconds before the access token expires.
const REFRESH_MARGIN_SECONDS = 60;

type CookieUpdate = { tokens: TokenSet } | { signedOut: true } | undefined;

/**
 * Keeps signed-in users signed in: when the short-lived access token is (nearly) expired and a
 * refresh token exists, fetch new tokens before the page renders. Authorization itself still
 * happens on the server for every request (src/server/auth/session.ts).
 */
async function refreshTokens(request: NextRequest): Promise<CookieUpdate> {
  const refreshToken = request.cookies.get(AUTH_COOKIES.refresh)?.value;
  const accessToken = request.cookies.get(AUTH_COOKIES.access)?.value;
  if (!refreshToken || secondsUntilExpiry(accessToken) > REFRESH_MARGIN_SECONDS) return undefined;

  try {
    const tokens = await oidc.refreshTokenGrant(await getOidcConfig(), refreshToken);
    // Update this request's cookies too, so the page rendered now sees the new tokens.
    request.cookies.set(AUTH_COOKIES.access, tokens.access_token);
    if (tokens.id_token) request.cookies.set(AUTH_COOKIES.id, tokens.id_token);
    if (tokens.refresh_token) request.cookies.set(AUTH_COOKIES.refresh, tokens.refresh_token);
    return { tokens };
  } catch (error) {
    // Refresh token expired or revoked: the user is signed out.
    if (error instanceof oidc.ResponseBodyError && error.error === 'invalid_grant') {
      request.cookies.delete([AUTH_COOKIES.access, AUTH_COOKIES.id, AUTH_COOKIES.refresh]);
      return { signedOut: true };
    }
    // Anything else (e.g. Cognito unreachable): carry on; the page treats the user as signed out.
    console.error('Token refresh failed', error);
    return undefined;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const origin = await checkOrigin(pathname, request.headers);
  if (origin !== 'allowed') {
    return new NextResponse(origin === 'forbidden' ? 'Forbidden' : 'Service unavailable', {
      status: origin === 'forbidden' ? 403 : 503,
    });
  }

  // The auth routes manage the token cookies themselves.
  const cookieUpdate = pathname.startsWith('/auth/') ? undefined : await refreshTokens(request);

  const nonce = createNonce();
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  // Next.js takes the nonce from the request's policy and adds it to the scripts it renders.
  requestHeaders.set('content-security-policy', policy);
  requestHeaders.set('x-nonce', nonce);
  // The app never needs the origin secret, so it goes no further than this check.
  requestHeaders.delete(ORIGIN_HEADER);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  if (cookieUpdate && 'tokens' in cookieUpdate)
    setTokenCookies(response.cookies, cookieUpdate.tokens);
  if (cookieUpdate && 'signedOut' in cookieUpdate) clearTokenCookies(response.cookies);
  return response;
}

export const config = {
  // Everything except build assets and public images.
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt)$).*)'],
};

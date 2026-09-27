import { type NextRequest, NextResponse } from 'next/server';
import * as oidc from 'openid-client';
import { getAuthConfig, getOidcConfig } from '@/server/auth/config';
import {
  AUTH_COOKIES,
  cookieOptions,
  readTransaction,
  setTokenCookies,
} from '@/server/auth/cookies';
import { recordSignIn } from '@/server/users';

// Cognito redirects here after sign-in. Checks state, nonce and PKCE, exchanges the code for
// tokens, stores them in HttpOnly cookies and records the user.
export async function GET(request: NextRequest) {
  const { appUrl, redirectUri } = getAuthConfig();
  const tx = readTransaction(request.cookies.get(AUTH_COOKIES.transaction)?.value);

  const fail = (reason: string) => {
    const response = NextResponse.redirect(`${appUrl}/auth/error?reason=${reason}`, 303);
    response.cookies.set(AUTH_COOKIES.transaction, '', cookieOptions(0));
    return response;
  };

  // No sign-in in progress (cookie expired, or the page was reloaded after finishing).
  if (!tx) return fail('expired');

  // Build the URL from APP_URL: behind CloudFront the request host is not the public one.
  const currentUrl = new URL(`${redirectUri}${request.nextUrl.search}`);

  let tokens: Awaited<ReturnType<typeof oidc.authorizationCodeGrant>>;
  try {
    tokens = await oidc.authorizationCodeGrant(await getOidcConfig(), currentUrl, {
      pkceCodeVerifier: tx.codeVerifier,
      expectedState: tx.state,
      expectedNonce: tx.nonce,
      idTokenExpected: true,
    });
  } catch (error) {
    if (currentUrl.searchParams.get('error') === 'access_denied') return fail('cancelled');
    console.error('Sign-in callback failed', error);
    return fail('failed');
  }

  const claims = tokens.claims();
  if (!claims || typeof claims.email !== 'string') return fail('failed');
  await recordSignIn({
    id: claims.sub,
    email: claims.email,
    name: typeof claims.name === 'string' ? claims.name : claims.email,
  });

  const response = NextResponse.redirect(`${appUrl}${tx.returnTo}`, 303);
  response.headers.set('Cache-Control', 'no-store');
  setTokenCookies(response.cookies, tokens);
  response.cookies.set(AUTH_COOKIES.transaction, '', cookieOptions(0));
  return response;
}

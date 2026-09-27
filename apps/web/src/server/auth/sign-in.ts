import 'server-only';
import { NextResponse } from 'next/server';
import * as oidc from 'openid-client';
import { safeReturnTo } from '@/lib/safe-redirect';
import { getAuthConfig, getOidcConfig } from './config';
import { setTransactionCookie } from './cookies';

/**
 * Start the authorization code + PKCE flow: remember the verifier, state and nonce in a
 * short-lived HttpOnly cookie and send the browser to Cognito's hosted page.
 */
export async function startSignIn(request: Request, screen: 'login' | 'signup') {
  const { redirectUri } = getAuthConfig();
  const config = await getOidcConfig();

  const codeVerifier = oidc.randomPKCECodeVerifier();
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get('returnTo'));

  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
    code_challenge_method: 'S256',
    state,
    nonce,
  });
  // The hosted pages accept the same parameters on /signup to open the sign-up form.
  if (screen === 'signup') url.pathname = '/signup';

  const response = NextResponse.redirect(url);
  response.headers.set('Cache-Control', 'no-store');
  setTransactionCookie(response.cookies, { codeVerifier, state, nonce, returnTo });
  return response;
}

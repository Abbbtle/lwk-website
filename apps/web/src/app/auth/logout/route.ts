import { type NextRequest, NextResponse } from 'next/server';
import * as oidc from 'openid-client';
import { getAuthConfig, getOidcConfig } from '@/server/auth/config';
import { revokeSessions } from '@/server/account';
import {
  AUTH_COOKIES,
  clearTokenCookies,
  secondsUntilExpiry,
  unverifiedSubject,
} from '@/server/auth/cookies';
import { globalSignOut } from '@/server/cognito';

/** A current access token for global sign-out, refreshing it first if it has (nearly) expired. */
async function currentAccessToken(request: NextRequest) {
  const access = request.cookies.get(AUTH_COOKIES.access)?.value;
  if (access && secondsUntilExpiry(access) > 30) return access;
  const refresh = request.cookies.get(AUTH_COOKIES.refresh)?.value;
  if (!refresh) return undefined;
  const tokens = await oidc.refreshTokenGrant(await getOidcConfig(), refresh);
  return tokens.access_token;
}

// POST only, so another site cannot sign people out with a link or image.
export async function POST(request: NextRequest) {
  const { appUrl, clientId, domain } = getAuthConfig();
  const form = await request.formData().catch(() => null);
  const everywhere = form?.get('everywhere') === '1';
  let signedOutEverywhere = false;

  // "Also log me out on my other devices": invalidate every session of this account.
  if (everywhere) {
    try {
      const accessToken = await currentAccessToken(request);
      if (accessToken) {
        await globalSignOut(accessToken);
        signedOutEverywhere = true;
        // Cognito just accepted the token, so its subject is this user. Other devices' access
        // tokens stop working now instead of when they expire.
        const userId = unverifiedSubject(accessToken);
        if (userId) await revokeSessions(userId);
      }
    } catch (error) {
      console.error('Global sign-out failed', error);
    }
  }

  // Revoke this device's refresh token (and the tokens issued from it). Best effort: the
  // cookies are cleared either way.
  const refreshToken = request.cookies.get(AUTH_COOKIES.refresh)?.value;
  if (refreshToken && !signedOutEverywhere) {
    try {
      await fetch(`${domain}/oauth2/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, token: refreshToken }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      console.error('Token revocation failed', error);
    }
  }

  const target = new URL('/logged-out', appUrl);
  if (everywhere) target.searchParams.set('everywhere', signedOutEverywhere ? '1' : 'failed');
  const response = NextResponse.redirect(target, 303);
  response.headers.set('Cache-Control', 'no-store');
  clearTokenCookies(response.cookies);
  return response;
}

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthConfig } from '@/server/auth/config';
import { AUTH_COOKIES, clearTokenCookies } from '@/server/auth/cookies';

// POST only, so another site cannot sign people out with a link or image.
export async function POST(request: NextRequest) {
  const { appUrl, clientId, domain } = getAuthConfig();
  const refreshToken = request.cookies.get(AUTH_COOKIES.refresh)?.value;

  // Revoke the refresh token (and the tokens issued from it). Best effort: the cookies are
  // cleared either way.
  if (refreshToken) {
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

  const response = NextResponse.redirect(`${appUrl}/`, 303);
  response.headers.set('Cache-Control', 'no-store');
  clearTokenCookies(response.cookies);
  return response;
}

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { safeReturnTo } from '@/lib/safe-redirect';
import { getAuthConfig } from '@/server/auth/config';
import { secondsUntilExpiry, setTokenCookies } from '@/server/auth/cookies';
import { verifyTokens } from '@/server/auth/session';
import { getOwnMfaEnabled } from '@/server/cognito';
import { RATE_LIMITS, rateLimit } from '@/server/rate-limit';
import { ipFromHeaders } from '@/server/request-info';
import { recordSignIn } from '@/server/users';

const bodySchema = z.object({
  accessToken: z.string().min(20).max(8192),
  idToken: z.string().min(20).max(8192),
  refreshToken: z.string().min(20).max(8192),
  returnTo: z.string().max(500).optional(),
});

/** Two-step status straight from Cognito; undefined if it could not be read just now. */
async function mfaStatus(accessToken: string) {
  try {
    return await getOwnMfaEnabled(accessToken);
  } catch (error) {
    console.error('Reading two-step status failed', error);
    return undefined;
  }
}

/**
 * Called by the sign-in page after Cognito accepted the password in the browser. Verifies the
 * tokens, records the user and stores the tokens in HttpOnly cookies.
 */
export async function POST(request: NextRequest) {
  // Only our own pages may create a session (prevents signing a visitor into another account).
  if (request.headers.get('origin') !== getAuthConfig().appUrl) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const limit = await rateLimit(`session:${ipFromHeaders(request.headers)}`, RATE_LIMITS.session);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many sign-ins' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const { accessToken, idToken, refreshToken, returnTo } = parsed.data;

  const identity = await verifyTokens(accessToken, idToken);
  if (!identity) return NextResponse.json({ error: 'Invalid tokens' }, { status: 401 });

  await recordSignIn({
    id: identity.userId,
    email: identity.email,
    name: identity.name,
    roles: identity.roles,
    mfaEnabled: await mfaStatus(accessToken),
  });

  const response = NextResponse.json({ redirectTo: safeReturnTo(returnTo) });
  response.headers.set('Cache-Control', 'no-store');
  setTokenCookies(response.cookies, {
    access_token: accessToken,
    id_token: idToken,
    refresh_token: refreshToken,
    expires_in: Math.max(60, secondsUntilExpiry(accessToken)),
  });
  return response;
}

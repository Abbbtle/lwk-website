import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { safeReturnTo } from '@/lib/safe-redirect';
import { getAuthConfig } from '@/server/auth/config';
import { secondsUntilExpiry, setTokenCookies } from '@/server/auth/cookies';
import { verifyTokens } from '@/server/auth/session';
import { recordSignIn } from '@/server/users';

const bodySchema = z.object({
  accessToken: z.string().min(20).max(8192),
  idToken: z.string().min(20).max(8192),
  refreshToken: z.string().min(20).max(8192),
  returnTo: z.string().max(500).optional(),
});

/**
 * Called by the sign-in page after Cognito accepted the password in the browser. Verifies the
 * tokens, records the user and stores the tokens in HttpOnly cookies.
 */
export async function POST(request: NextRequest) {
  // Only our own pages may create a session (prevents signing a visitor into another account).
  if (request.headers.get('origin') !== getAuthConfig().appUrl) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const { accessToken, idToken, refreshToken, returnTo } = parsed.data;

  const session = await verifyTokens(accessToken, idToken);
  if (!session) return NextResponse.json({ error: 'Invalid tokens' }, { status: 401 });

  await recordSignIn({ id: session.userId, email: session.email, name: session.name });

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

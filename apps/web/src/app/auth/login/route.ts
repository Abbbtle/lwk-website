import { type NextRequest, NextResponse } from 'next/server';
import { safeReturnTo } from '@/lib/safe-redirect';
import { getAuthConfig } from '@/server/auth/config';

// Older links point here; the form now lives on the /login page. Build the redirect from APP_URL:
// behind CloudFront the request URL carries the server's internal address.
export function GET(request: NextRequest) {
  const url = new URL('/login', getAuthConfig().appUrl);
  const returnTo = request.nextUrl.searchParams.get('returnTo');
  if (returnTo) url.searchParams.set('returnTo', safeReturnTo(returnTo));
  return NextResponse.redirect(url, 307);
}

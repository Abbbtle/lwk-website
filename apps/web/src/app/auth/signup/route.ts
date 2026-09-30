import { type NextRequest, NextResponse } from 'next/server';
import { safeReturnTo } from '@/lib/safe-redirect';

// Older links point here; sign-up now happens on the /sign-up page.
export function GET(request: NextRequest) {
  const url = new URL('/sign-up', request.url);
  const returnTo = request.nextUrl.searchParams.get('returnTo');
  if (returnTo) url.searchParams.set('returnTo', safeReturnTo(returnTo));
  return NextResponse.redirect(url, 307);
}

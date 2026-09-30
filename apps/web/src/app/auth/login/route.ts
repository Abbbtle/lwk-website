import { type NextRequest, NextResponse } from 'next/server';
import { safeReturnTo } from '@/lib/safe-redirect';

// Older links point here; sign-in now happens on the /login page.
export function GET(request: NextRequest) {
  const url = new URL('/login', request.url);
  const returnTo = request.nextUrl.searchParams.get('returnTo');
  if (returnTo) url.searchParams.set('returnTo', safeReturnTo(returnTo));
  return NextResponse.redirect(url, 307);
}

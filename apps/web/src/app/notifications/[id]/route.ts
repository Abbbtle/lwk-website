import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { safeReturnTo } from '@/lib/safe-redirect';
import { getAuthConfig } from '@/server/auth/config';
import { getSession } from '@/server/auth/session';
import { getNotification, markRead } from '@/server/notifications';

// Opening a notification marks it as read and goes to its page (only pages on this site).
export async function GET(_request: NextRequest, context: RouteContext<'/notifications/[id]'>) {
  const { appUrl } = getAuthConfig();
  const { id } = await context.params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/login?returnTo=%2Fnotifications', appUrl));
  const notification = z.uuid().safeParse(id).success
    ? await getNotification(session.userId, id)
    : null;
  if (!notification) return NextResponse.redirect(new URL('/notifications', appUrl));
  await markRead(session.userId, notification.id);
  return NextResponse.redirect(new URL(safeReturnTo(notification.href, '/notifications'), appUrl));
}

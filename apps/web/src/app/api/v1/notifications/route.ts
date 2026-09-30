import { fail, handleErrors, ok } from '@/server/api';
import { getSession } from '@/server/auth/session';
import { listNotifications, unreadCount } from '@/server/notifications';

// The bell: recent notifications and how many are unread.
export const GET = handleErrors(async () => {
  const session = await getSession();
  if (!session) return fail(401, 'unauthorized', 'Sign in required.');
  const [notifications, unread] = await Promise.all([
    listNotifications(session.userId, { take: 8 }),
    unreadCount(session.userId),
  ]);
  return ok({ notifications, unread });
});

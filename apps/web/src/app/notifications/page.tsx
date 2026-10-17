import { Bell } from 'lucide-react';
import type { Metadata } from 'next';
import { HelpLink } from '@/components/help-link';
import { timeAgo } from '@/lib/format';
import { requireSession } from '@/server/auth/session';
import { listNotifications, pruneNotifications } from '@/server/notifications';
import { markAllRead } from './actions';

export const metadata: Metadata = { title: 'Notifications', robots: { index: false } };

export default async function NotificationsPage() {
  const session = await requireSession('/notifications');
  await pruneNotifications(session.userId);
  const notifications = await listNotifications(session.userId, { take: 100 });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold md:text-4xl">Notifications</h1>
          <p className="mt-1 text-gray-700">
            {unread > 0 ? `${unread} unread` : 'You are all caught up.'}
          </p>
        </div>
        {unread > 0 && (
          <form action={markAllRead}>
            <button type="submit" className="btn-outline">
              Mark all as read
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 bg-white p-10 text-center shadow-md">
          <Bell className="size-10 text-gray-400" aria-hidden />
          <p className="text-gray-700">
            Replies from support and news about your applications and courses will appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-gray-200 bg-white shadow-md">
          {notifications.map((n) => (
            <li key={n.id}>
              <a href={`/notifications/${n.id}`} className="flex gap-4 px-5 py-4 hover:bg-gray-50">
                <span
                  aria-hidden
                  className={`mt-2 size-2.5 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-brand'}`}
                />
                <span className="min-w-0 flex-1">
                  <span className={`block ${n.readAt ? '' : 'font-semibold'}`}>
                    {!n.readAt && <span className="sr-only">Unread: </span>}
                    {n.title}
                  </span>
                  {n.body && (
                    <span className="block text-sm whitespace-pre-line text-gray-600">
                      {n.body}
                    </span>
                  )}
                </span>
                <time
                  dateTime={n.createdAt.toISOString()}
                  className="shrink-0 text-sm text-gray-500"
                >
                  {timeAgo(n.createdAt)}
                </time>
              </a>
            </li>
          ))}
        </ul>
      )}
      <HelpLink slug="notifications" className="mt-6">
        About notifications
      </HelpLink>
    </div>
  );
}

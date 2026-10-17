import 'server-only';
import { getDb } from './db';

// In-app notifications (the bell). Sending is best effort: a failed notification never undoes
// the action that caused it.

export type NotificationInput = {
  /** Dotted kind, e.g. "support.reply". */
  kind: string;
  title: string;
  body?: string;
  /** Page on this site to open. */
  href?: string;
};

export async function notify(userIds: string | string[], input: NotificationInput) {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
  if (ids.length === 0) return;
  try {
    await getDb().notification.createMany({
      data: ids.map((userId) => ({
        userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
      })),
    });
  } catch (error) {
    console.error('Sending notification failed', input.kind, error);
  }
}

export async function unreadCount(userId: string) {
  return getDb().notification.count({ where: { userId, readAt: null } });
}

export async function listNotifications(userId: string, { take = 20 }: { take?: number } = {}) {
  return getDb().notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });
}

/** Mark one notification (or all of them) as read. Only ever touches the user's own. */
export async function markRead(userId: string, id?: string) {
  await getDb().notification.updateMany({
    where: { userId, readAt: null, ...(id && { id }) },
    data: { readAt: new Date() },
  });
}

/** The notification, if it belongs to the user (to open it). */
export async function getNotification(userId: string, id: string) {
  return getDb().notification.findFirst({ where: { id, userId } });
}

/** Keep the list short: drop read notifications older than 90 days. */
export async function pruneNotifications(userId: string) {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  await getDb().notification.deleteMany({
    where: { userId, readAt: { not: null }, createdAt: { lt: cutoff } },
  });
}

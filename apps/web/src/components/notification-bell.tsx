'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { timeAgo } from '@/lib/format';

type Item = {
  id: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

/** The bell: unread count (from the server) and the latest notifications on demand. */
export function NotificationBell({ unread }: { unread: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !root.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  async function toggle() {
    if (open) return setOpen(false);
    setOpen(true);
    try {
      const response = await fetch('/api/v1/notifications');
      if (response.ok)
        setItems(
          ((await response.json()) as { data: { notifications: Item[] } }).data.notifications,
        );
    } catch {
      setItems([]);
    }
  }

  async function markAll() {
    await fetch('/api/v1/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => {});
    setItems(
      (current) =>
        current?.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })) ??
        null,
    );
    router.refresh();
  }

  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-expanded={open}
        className="relative cursor-pointer p-2 text-gray-800 hover:text-brand"
      >
        <Bell className="size-6" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 flex min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs leading-5 font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="region"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] border border-gray-300 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <p className="font-bold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="cursor-pointer text-sm font-semibold underline hover:text-brand"
              >
                Mark all as read
              </button>
            )}
          </div>
          {items === null ? (
            <p className="px-4 py-6 text-center text-sm text-gray-600">Loading...</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-600">You are all caught up.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-gray-200 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <a
                    href={`/notifications/${item.id}`}
                    className="flex gap-3 px-4 py-3 hover:bg-gray-50"
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${item.readAt ? 'bg-transparent' : 'bg-brand'}`}
                    />
                    <span className="min-w-0">
                      <span className={`block text-sm ${item.readAt ? '' : 'font-semibold'}`}>
                        {!item.readAt && <span className="sr-only">Unread: </span>}
                        {item.title}
                      </span>
                      {item.body && (
                        <span className="line-clamp-2 block text-xs text-gray-600">
                          {item.body}
                        </span>
                      )}
                      <span className="block text-xs text-gray-500">{timeAgo(item.createdAt)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-gray-200 px-4 py-3 text-center text-sm font-semibold hover:bg-gray-50"
          >
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}

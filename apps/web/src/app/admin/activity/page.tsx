import type { Metadata } from 'next';
import Link from 'next/link';
import { listAuditEvents } from '@/server/audit';
import { requireRole } from '@/server/auth/session';
import { AdminHeading, AdminNav } from '../admin-nav';

export const metadata: Metadata = { title: 'Activity log', robots: { index: false } };

const categories = [
  { prefix: '', label: 'Everything' },
  { prefix: 'user.', label: 'Accounts and roles' },
  { prefix: 'course.', label: 'Course reviews' },
  { prefix: 'application.', label: 'Instructor applications' },
  { prefix: 'resource.', label: 'Free resources' },
  { prefix: 'account.', label: 'Self-service changes' },
];

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function targetLink(type: string, id: string | null) {
  if (!id) return null;
  if (type === 'user') return `/admin/users/${id}`;
  if (type === 'course') return `/admin/courses/${id}`;
  if (type === 'resource') return `/admin/explore/${id}`;
  return null;
}

export default async function ActivityPage({ searchParams }: PageProps<'/admin/activity'>) {
  const session = await requireRole('admin', '/admin/activity');
  const params = await searchParams;
  const action = categories.find((c) => c.prefix === single(params.action))?.prefix ?? '';
  const before = single(params.before);
  const { events, nextCursor } = await listAuditEvents({
    action: action || undefined,
    before: before && /^[0-9a-f-]{36}$/i.test(before) ? before : undefined,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <AdminHeading title="Activity log" greeting={session.name} />
      <AdminNav current="/admin/activity" />
      <p className="mb-6 max-w-2xl text-gray-700">
        A record of changes to accounts, roles and content: who made them and when. Entries cannot
        be edited or removed.
      </p>

      <nav aria-label="Filter activity" className="mb-6 flex flex-wrap gap-4 text-sm font-semibold">
        {categories.map((c) => (
          <Link
            key={c.label}
            href={c.prefix ? `/admin/activity?action=${c.prefix}` : '/admin/activity'}
            aria-current={c.prefix === action ? 'page' : undefined}
            className={c.prefix === action ? 'text-brand underline' : 'hover:text-brand'}
          >
            {c.label}
          </Link>
        ))}
      </nav>

      {events.length === 0 ? (
        <p className="bg-white p-8 text-center text-gray-700 shadow-md">Nothing recorded yet.</p>
      ) : (
        <ol className="divide-y divide-gray-200 bg-white shadow-md">
          {events.map((event) => {
            const href = targetLink(event.targetType, event.targetId);
            return (
              <li key={event.id} className="flex flex-wrap justify-between gap-2 px-5 py-4">
                <div>
                  <p className="font-medium">
                    {href ? (
                      <Link href={href} className="hover:text-brand">
                        {event.summary}
                      </Link>
                    ) : (
                      event.summary
                    )}
                  </p>
                  <p className="text-sm text-gray-600">
                    {event.actorName}
                    {event.ip && ` · ${event.ip}`}
                  </p>
                </div>
                <time dateTime={event.createdAt.toISOString()} className="text-sm text-gray-600">
                  {event.createdAt.toLocaleString('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
              </li>
            );
          })}
        </ol>
      )}

      {nextCursor && (
        <div className="mt-6 text-center">
          <Link
            href={`/admin/activity?${new URLSearchParams({ ...(action && { action }), before: nextCursor })}`}
            className="btn-outline"
          >
            Older entries
          </Link>
        </div>
      )}
    </div>
  );
}

import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { HelpLink } from '@/components/help-link';
import { TicketBadge } from '@/components/ticket-status';
import { timeAgo } from '@/lib/format';
import { hasRole, requireRole } from '@/server/auth/session';
import { helpFeedbackSummary } from '@/server/help-feedback';
import {
  INBOX_VIEWS,
  type InboxView,
  listTickets,
  PRIORITY_LABELS,
  STAFF_STATUS_LABELS,
  TICKET_CATEGORIES,
  ticketRef,
} from '@/server/support';
import { AdminHeading, AdminNav } from '../admin-nav';

export const metadata: Metadata = { title: 'Support', robots: { index: false } };

const viewLabels: Record<InboxView, string> = {
  open: 'Open',
  pending: 'Waiting for them',
  mine: 'Assigned to me',
  resolved: 'Resolved',
  closed: 'Closed',
  all: 'All',
};

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function SupportInboxPage({ searchParams }: PageProps<'/admin/support'>) {
  const session = await requireRole('support', '/admin/support');
  const params = await searchParams;
  const view = INBOX_VIEWS.find((v) => v === single(params.view)) ?? 'open';
  const query = single(params.q)?.trim() || undefined;
  const page = Math.max(1, Number(single(params.page)) || 1);
  const [{ tickets, total, pageCount }, feedback] = await Promise.all([
    listTickets(session, { view, query, page }),
    helpFeedbackSummary(),
  ]);
  const href = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ view, q: query, page, ...changes })) {
      if (value !== undefined && value !== '' && !(key === 'page' && value === 1))
        next.set(key, String(value));
    }
    return `/admin/support?${next}`;
  };
  const category = (value: string) =>
    TICKET_CATEGORIES.find((c) => c.value === value)?.label ?? value;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <AdminHeading title="Support" greeting={session.name} />
      <AdminNav current="/admin/support" />

      <div className="grid gap-8 lg:grid-cols-4">
        <div className="space-y-5 lg:col-span-3">
          <form
            action="/admin/support"
            className="flex max-w-xl gap-2"
            role="search"
            aria-label="Support requests"
          >
            <input type="hidden" name="view" value={view} />
            <label htmlFor="ticket-search" className="sr-only">
              Search requests
            </label>
            <input
              id="ticket-search"
              name="q"
              defaultValue={query}
              placeholder="Search by #number, subject, name or email"
              className="min-w-0 flex-1 border border-gray-300 bg-white px-3 py-2 focus:border-black focus:outline-none"
            />
            <button type="submit" className="btn-solid px-4" aria-label="Search">
              <Search className="size-4" aria-hidden />
            </button>
          </form>

          <nav aria-label="Filter requests" className="flex flex-wrap gap-4 text-sm font-semibold">
            {INBOX_VIEWS.map((v) => (
              <Link
                key={v}
                href={href({ view: v, page: 1 })}
                aria-current={v === view ? 'page' : undefined}
                className={v === view ? 'text-brand-ink underline' : 'hover:text-brand-ink'}
              >
                {viewLabels[v]}
              </Link>
            ))}
          </nav>

          <p className="text-sm text-gray-600" aria-live="polite">
            {total} {total === 1 ? 'request' : 'requests'}
          </p>

          {tickets.length === 0 ? (
            <p className="bg-white p-8 text-center text-gray-700 shadow-md">
              {view === 'open' ? 'No open requests. Well done.' : 'Nothing here.'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 bg-white shadow-md">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/admin/support/${ticket.number}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50"
                  >
                    <span className="min-w-0">
                      <span className="font-semibold">{ticket.subject}</span>
                      <span className="block text-sm text-gray-600">
                        {ticketRef(ticket.number)} · {ticket.requester.name} ·{' '}
                        {category(ticket.category)} ·{' '}
                        {ticket.assignee ? `with ${ticket.assignee.name}` : 'unassigned'} ·{' '}
                        {timeAgo(ticket.lastActivityAt)}
                      </span>
                    </span>
                    <span className="flex gap-2">
                      {ticket.priority !== 'NORMAL' && (
                        <TicketBadge
                          value={ticket.priority}
                          label={PRIORITY_LABELS[ticket.priority]}
                        />
                      )}
                      <TicketBadge
                        value={ticket.status}
                        label={STAFF_STATUS_LABELS[ticket.status]}
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {pageCount > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-between text-sm">
              {page > 1 ? (
                <Link href={href({ page: page - 1 })} className="btn-outline">
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-gray-600">
                Page {page} of {pageCount}
              </span>
              {page < pageCount ? (
                <Link href={href({ page: page + 1 })} className="btn-outline">
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>

        <aside className="space-y-6">
          {hasRole(session, 'admin') && (
            <section className="space-y-2 bg-white p-5 shadow-md">
              <h2 className="font-bold">Contact form</h2>
              <p className="text-sm text-gray-600">Messages from people without an account.</p>
              <Link href="/admin/messages" className="text-sm font-semibold underline">
                Open contact messages
              </Link>
            </section>
          )}
          <section className="space-y-3 bg-white p-5 shadow-md">
            <h2 className="font-bold">Help article feedback</h2>
            <p className="text-sm text-gray-600">Last 30 days.</p>
            {feedback.articles.length === 0 ? (
              <p className="text-sm text-gray-600">No feedback yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {feedback.articles.map((a) => (
                  <li key={a.slug} className="flex justify-between gap-2">
                    <Link href={`/help/${a.slug}`} className="hover:text-brand-ink">
                      {a.title}
                    </Link>
                    <span className="shrink-0 text-gray-600">
                      {a.helpful} yes · {a.notHelpful} no
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {feedback.comments.length > 0 && (
              <>
                <h3 className="pt-2 text-sm font-bold">What people were looking for</h3>
                <ul className="space-y-2 text-sm">
                  {feedback.comments.map((c, i) => (
                    <li key={i} className="border-l-2 border-gray-300 pl-2">
                      &ldquo;{c.comment}&rdquo;
                      <span className="block text-xs text-gray-500">on {c.title}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          <HelpLink slug="handling-support-requests">How support requests work</HelpLink>
        </aside>
      </div>
    </div>
  );
}

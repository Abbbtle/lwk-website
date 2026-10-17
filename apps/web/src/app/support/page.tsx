import { ChevronRight, Plus, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { TicketBadge } from '@/components/ticket-status';
import { topicsFor } from '@/lib/help';
import { timeAgo } from '@/lib/format';
import { site } from '@/lib/site';
import { hasRole, requireSession } from '@/server/auth/session';
import { listMyTickets, STATUS_LABELS, ticketRef } from '@/server/support';

export const metadata: Metadata = { title: 'Help and support', robots: { index: false } };

export default async function SupportPage() {
  const session = await requireSession('/support');
  const tickets = await listMyTickets(session.userId);
  const topics = topicsFor({ staff: hasRole(session, 'support') });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-brand-ink uppercase">Hare Krishna, {session.name}</p>
      <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">Help and support</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Your support requests</h2>
            <Link href="/support/new" className="btn-solid">
              <Plus className="size-4" aria-hidden /> New request
            </Link>
          </div>
          {tickets.length === 0 ? (
            <div className="bg-white p-8 text-center shadow-md">
              <p className="text-gray-700">
                You have not sent a support request. Most questions are answered in the help centre,
                and we are here when they are not.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 bg-white shadow-md">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/support/${ticket.number}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50"
                  >
                    <span className="min-w-0">
                      <span className="font-semibold">{ticket.subject}</span>
                      <span className="block text-sm text-gray-600">
                        {ticketRef(ticket.number)} · {ticket._count.messages}{' '}
                        {ticket._count.messages === 1 ? 'message' : 'messages'} · updated{' '}
                        {timeAgo(ticket.lastActivityAt)}
                      </span>
                    </span>
                    <TicketBadge value={ticket.status} label={STATUS_LABELS[ticket.status]} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-gray-600">
            We reply on working days ({site.officeHours.join(' ')}), usually within one working day.
            You get a notification when we do.
          </p>
        </section>

        <aside className="space-y-6">
          <section className="space-y-4 bg-white p-6 shadow-md">
            <h2 className="text-lg font-bold">Find an answer now</h2>
            <form action="/help" role="search" aria-label="Help centre" className="relative">
              <label htmlFor="support-help-search" className="sr-only">
                Search the help centre
              </label>
              <input
                id="support-help-search"
                name="q"
                type="search"
                placeholder="Search help"
                className="w-full border border-gray-300 bg-surface py-2.5 pr-10 pl-3 focus:border-black focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Search"
                className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
              >
                <Search className="size-4" aria-hidden />
              </button>
            </form>
            <ul className="divide-y divide-gray-200 border border-gray-200">
              {topics.map((topic) => (
                <li key={topic.slug}>
                  <Link
                    href={`/help#${topic.slug}`}
                    className="flex items-center justify-between gap-2 px-4 py-3 text-sm font-semibold hover:bg-gray-50"
                  >
                    {topic.title}
                    <ChevronRight className="size-4 text-gray-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

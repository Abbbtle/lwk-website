import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TicketBadge } from '@/components/ticket-status';
import { TicketThread } from '@/components/ticket-thread';
import { requireSession } from '@/server/auth/session';
import {
  getMyTicket,
  STATUS_LABELS,
  SupportError,
  TICKET_CATEGORIES,
  ticketRef,
} from '@/server/support';
import { markResolved } from '../actions';
import { ReplyForm } from './reply-form';

export const metadata: Metadata = { title: 'Support request', robots: { index: false } };

export default async function RequestPage({
  params,
  searchParams,
}: PageProps<'/support/[number]'>) {
  const { number: raw } = await params;
  const number = Number(raw);
  const session = await requireSession(`/support/${raw}`);
  if (!Number.isInteger(number) || number < 1) notFound();
  const ticket = await getMyTicket(session, number).catch((error) => {
    if (error instanceof SupportError) notFound();
    throw error;
  });
  const isNew = (await searchParams).new === '1';
  const category = TICKET_CATEGORIES.find((c) => c.value === ticket.category)?.label;
  const closed = ticket.status === 'CLOSED';
  const resolved = ticket.status === 'RESOLVED';

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/support" className="text-sm hover:text-brand-ink">
        ← Help and support
      </Link>

      {isNew && (
        <p
          role="status"
          className="mt-6 border-l-4 border-green-700 bg-green-50 p-4 text-green-900"
        >
          <strong>We have your request {ticketRef(ticket.number)}.</strong> We usually reply within
          one working day, and you will get a notification when we do.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-600">
            {ticketRef(ticket.number)} · {category}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">{ticket.subject}</h1>
        </div>
        <TicketBadge value={ticket.status} label={STATUS_LABELS[ticket.status]} />
      </div>

      <div className="mt-8">
        <TicketThread messages={ticket.messages} viewer="requester" />
      </div>

      <div className="mt-8 space-y-4">
        {closed ? (
          <p className="bg-white p-6 text-gray-700 shadow-md">
            This request is closed.{' '}
            <Link href="/support/new" className="font-semibold underline">
              Start a new request
            </Link>{' '}
            if you need more help.
          </p>
        ) : (
          <section className="bg-white p-6 shadow-md">
            <ReplyForm ticketNumber={ticket.number} />
          </section>
        )}
        {!closed && (
          <form action={markResolved.bind(null, ticket.number, !resolved)} className="text-sm">
            {resolved ? (
              <p>
                Marked as resolved.{' '}
                <button type="submit" className="cursor-pointer font-semibold underline">
                  Reopen
                </button>
              </p>
            ) : (
              <p>
                Sorted?{' '}
                <button type="submit" className="cursor-pointer font-semibold underline">
                  Mark as resolved
                </button>
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

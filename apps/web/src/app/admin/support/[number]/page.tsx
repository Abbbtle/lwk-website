import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TicketBadge } from '@/components/ticket-status';
import { TicketThread } from '@/components/ticket-thread';
import { aiConfig } from '@/server/ai/config';
import { hasRole, requireRole } from '@/server/auth/session';
import {
  getTicketForStaff,
  listStaff,
  PRIORITY_LABELS,
  STAFF_STATUS_LABELS,
  SupportError,
  TICKET_CATEGORIES,
  ticketRef,
} from '@/server/support';
import { ROLE_LABELS } from '@/server/user-admin';
import { AdminHeading, AdminNav } from '../../admin-nav';
import { TicketDetailsForm } from './details-form';
import { StaffReplyForm } from './staff-reply-form';

export const metadata: Metadata = { title: 'Support request', robots: { index: false } };

export default async function StaffTicketPage({ params }: PageProps<'/admin/support/[number]'>) {
  const { number: raw } = await params;
  const session = await requireRole('support', `/admin/support/${raw}`);
  const number = Number(raw);
  if (!Number.isInteger(number) || number < 1) notFound();
  const [ticket, staff] = await Promise.all([
    getTicketForStaff(session, number).catch((error) => {
      if (error instanceof SupportError) notFound();
      throw error;
    }),
    listStaff(),
  ]);
  const category = TICKET_CATEGORIES.find((c) => c.value === ticket.category)?.label;
  const roles = ticket.requester.roles
    .map((r) => ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r)
    .join(', ');

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <AdminHeading title={`Request ${ticketRef(ticket.number)}`} greeting="Support" />
      <AdminNav current="/admin/support" />
      <Link
        href="/admin/support"
        className="mb-6 inline-flex items-center gap-2 text-sm hover:text-brand-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Support inbox
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-gray-600">{category}</p>
              <h2 className="text-2xl font-extrabold">{ticket.subject}</h2>
            </div>
            <span className="flex gap-2">
              <TicketBadge value={ticket.priority} label={PRIORITY_LABELS[ticket.priority]} />
              <TicketBadge value={ticket.status} label={STAFF_STATUS_LABELS[ticket.status]} />
            </span>
          </div>
          <TicketThread messages={ticket.messages} viewer="staff" />
          <section className="bg-white p-6 shadow-md">
            <StaffReplyForm ticketNumber={ticket.number} ai={aiConfig().enabled} />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="bg-white p-5 shadow-md">
            <h2 className="mb-4 font-bold">Request</h2>
            <TicketDetailsForm
              // Start afresh whenever the saved values change (e.g. a reply set the status).
              key={`${ticket.status}-${ticket.priority}-${ticket.assigneeId}`}
              ticketNumber={ticket.number}
              values={{
                status: ticket.status,
                priority: ticket.priority,
                assigneeId: ticket.assigneeId ?? '',
              }}
              staff={staff.map((s) => ({ value: s.id, label: s.name }))}
              statuses={Object.entries(STAFF_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              priorities={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </section>
          <section className="space-y-2 bg-white p-5 text-sm shadow-md">
            <h2 className="font-bold">From</h2>
            <p className="font-semibold">{ticket.requester.name}</p>
            <p className="break-all text-gray-700">{ticket.requester.email}</p>
            <p className="text-gray-600">
              {roles || 'Learner'} · member since{' '}
              {ticket.requester.createdAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}
            </p>
            {ticket.otherTickets > 0 && (
              <p className="text-gray-600">
                {ticket.otherTickets} other {ticket.otherTickets === 1 ? 'request' : 'requests'}
              </p>
            )}
            {hasRole(session, 'admin') && (
              <Link
                href={`/admin/users/${ticket.requester.id}`}
                className="font-semibold underline"
              >
                Open their account
              </Link>
            )}
          </section>
          {(ticket.pageUrl || ticket.userAgent) && (
            <section className="space-y-2 bg-white p-5 text-sm shadow-md">
              <h2 className="font-bold">Context</h2>
              {ticket.pageUrl && (
                <p>
                  Page:{' '}
                  <Link href={ticket.pageUrl} className="break-all underline">
                    {ticket.pageUrl}
                  </Link>
                </p>
              )}
              {ticket.userAgent && (
                <p className="break-all text-gray-600">Browser: {ticket.userAgent}</p>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

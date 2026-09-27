import type { Metadata } from 'next';
import Link from 'next/link';
import { inquiryTypes } from '@/lib/forms/contact';
import { requireRole } from '@/server/auth/session';
import { listContactMessages } from '@/server/contact-messages';
import { AdminHeading, AdminNav } from '../admin-nav';
import { toggleHandled } from './actions';

export const metadata: Metadata = { title: 'Messages', robots: { index: false } };

const inquiryLabel = (type: string) =>
  inquiryTypes.find((t) => t.value === type.toLowerCase())?.label ?? type;

export default async function MessagesPage({ searchParams }: PageProps<'/admin/messages'>) {
  const session = await requireRole('admin', '/admin/messages');
  const handled = (await searchParams).view === 'handled';
  const messages = await listContactMessages({ handled });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <AdminHeading title="Messages" greeting={session.name} />
      <AdminNav current="/admin/messages" />

      <nav aria-label="Filter messages" className="mb-6 flex gap-4 text-sm font-semibold">
        <Link
          href="/admin/messages"
          aria-current={!handled ? 'page' : undefined}
          className={!handled ? 'text-brand underline' : 'hover:text-brand'}
        >
          Open
        </Link>
        <Link
          href="/admin/messages?view=handled"
          aria-current={handled ? 'page' : undefined}
          className={handled ? 'text-brand underline' : 'hover:text-brand'}
        >
          Handled
        </Link>
      </nav>

      {messages.length === 0 ? (
        <p className="bg-surface p-8 text-center text-gray-700">No messages here.</p>
      ) : (
        <ul className="space-y-4">
          {messages.map((m) => (
            <li key={m.id} className="border border-gray-300 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {m.name}
                    {m.company && <span className="font-normal text-gray-600"> · {m.company}</span>}
                  </p>
                  <a href={`mailto:${m.email}`} className="text-sm underline">
                    {m.email}
                  </a>
                  <p className="mt-1 text-sm text-gray-600">
                    {inquiryLabel(m.inquiryType)} ·{' '}
                    {m.createdAt.toLocaleString('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <form action={toggleHandled}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="handled" value={handled ? 'false' : 'true'} />
                  <button type="submit" className="btn-outline text-sm">
                    {handled ? 'Reopen' : 'Mark as handled'}
                  </button>
                </form>
              </div>
              <p className="mt-4 whitespace-pre-line text-gray-800">{m.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

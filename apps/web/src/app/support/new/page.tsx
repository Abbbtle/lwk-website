import type { Metadata } from 'next';
import Link from 'next/link';
import { safeReturnTo } from '@/lib/safe-redirect';
import { requireSession } from '@/server/auth/session';
import { TICKET_CATEGORIES } from '@/server/support';
import { NewRequestForm } from './new-request-form';

export const metadata: Metadata = { title: 'New support request', robots: { index: false } };

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function NewRequestPage({ searchParams }: PageProps<'/support/new'>) {
  const params = await searchParams;
  const from = single(params.from);
  await requireSession(`/support/new${from ? `?from=${encodeURIComponent(from)}` : ''}`);
  const category = TICKET_CATEGORIES.find((c) => c.value === single(params.category))?.value;
  const pageUrl = from ? safeReturnTo(from, '') || undefined : undefined;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/support" className="text-sm hover:text-brand-ink">
        ← Help and support
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">New support request</h1>
      <p className="mt-2 text-gray-700">
        Tell us what you need and we will reply here. You get a notification when we do.
      </p>
      <div className="mt-8 bg-white p-6 shadow-md sm:p-8">
        <NewRequestForm
          categories={TICKET_CATEGORIES}
          initialCategory={category}
          pageUrl={pageUrl}
        />
      </div>
    </div>
  );
}

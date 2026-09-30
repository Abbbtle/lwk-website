import type { Metadata } from 'next';
import Link from 'next/link';
import { SampleBadge, TypeBadge } from '@/components/badges';
import { ConfirmAction } from '@/components/confirm-action';
import { StatusBadge } from '@/components/status-badge';
import { requireRole } from '@/server/auth/session';
import { listAllResources } from '@/server/resources';
import { sampleContentAllowed, sampleContentStatus } from '@/server/sample-content';
import { AdminHeading, AdminNav } from '../admin-nav';
import { loadSamples, removeSamples } from './actions';
import { NewResourceForm } from './new-resource-form';

export const metadata: Metadata = { title: 'Explore', robots: { index: false } };

export default async function AdminExplorePage() {
  const session = await requireRole('admin', '/admin/explore');
  const [resources, samples] = await Promise.all([
    listAllResources(session),
    sampleContentStatus(),
  ]);
  const hasSamples = samples.courses + samples.resources > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <AdminHeading title="Explore: free content" greeting={session.name} />
      <AdminNav current="/admin/explore" />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section className="bg-white p-6 shadow-md">
            <h2 className="text-xl font-bold">Add a free resource</h2>
            <p className="mt-2 text-sm text-gray-600">
              A single video, audio recording, article or PDF that anyone can open in Explore. Free
              courses appear there automatically when their instructor offers them for free.
            </p>
            <div className="mt-5">
              <NewResourceForm />
            </div>
          </section>

          <section className="bg-white shadow-md">
            <h2 className="border-b border-gray-200 p-6 text-xl font-bold">
              Resources ({resources.length})
            </h2>
            {resources.length === 0 ? (
              <p className="p-6 text-gray-700">No free resources yet.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {resources.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/admin/explore/${r.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-gray-50"
                    >
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <TypeBadge type={r.type} />
                          {r.isSample && <SampleBadge />}
                          <span className="font-semibold">{r.title}</span>
                        </span>
                        <span className="mt-1 block text-sm text-gray-600">
                          {r.category?.name ?? 'No category'} · {r.authorName} · updated{' '}
                          {r.updatedAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                        </span>
                      </span>
                      <StatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside>
          <section className="space-y-4 bg-white p-6 shadow-md">
            <h2 className="text-xl font-bold">Sample content</h2>
            <p className="text-sm text-gray-700">
              Short sample courses (two of them free) and free articles, so testers can try
              enrolling, lessons and Explore before real content exists. Everything is marked
              &ldquo;Sample&rdquo; and taught by &ldquo;LWK Team&rdquo;.
            </p>
            <p className="text-sm font-semibold">
              Live now: {samples.courses} sample courses, {samples.resources} sample resources.
            </p>
            {sampleContentAllowed() ? (
              <div className="space-y-4">
                <ConfirmAction
                  label={hasSamples ? 'Reload sample content' : 'Load sample content'}
                  question="Publish the sample courses and articles? Existing samples are replaced (learners' progress in them is reset)."
                  confirmLabel="Load samples"
                  action={loadSamples}
                />
                {hasSamples && (
                  <ConfirmAction
                    label="Remove all sample content"
                    question="Remove every sample course and resource, including learners' enrollments in them? Do this before launch."
                    confirmLabel="Remove samples"
                    tone="danger"
                    action={removeSamples}
                  />
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-600">Sample content is turned off on this site.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireRole } from '@/server/auth/session';
import { getApplication } from '@/server/instructor-applications';
import { aiConfig } from '@/server/ai/config';
import { AdminHeading, AdminNav } from '../../admin-nav';
import { AiApplicationSummary } from './ai-summary';
import { DecisionForm } from './decision-form';

export const metadata: Metadata = { title: 'Instructor application', robots: { index: false } };

const statusLabels = { PENDING: 'Awaiting review', APPROVED: 'Approved', REJECTED: 'Not approved' };

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <dt className="text-sm font-semibold text-gray-600">{label}</dt>
      <dd className="mt-1 whitespace-pre-line">{value}</dd>
    </div>
  );
}

export default async function ApplicationPage({ params }: PageProps<'/admin/applications/[id]'>) {
  const { id } = await params;
  const session = await requireRole('admin', `/admin/applications/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const a = await getApplication(id);
  if (!a) notFound();

  const link = (url: string | null) =>
    url && (
      <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
        {url}
      </a>
    );

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <AdminHeading title={a.fullName} greeting={session.name} />
      <AdminNav current="/admin/applications" />
      <Link href="/admin/applications" className="text-sm font-semibold hover:text-brand-ink">
        ← All applications
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-3">
        <dl className="space-y-6 lg:col-span-2">
          <section className="grid gap-6 sm:grid-cols-2">
            <Field label="Initiated name" value={a.initiatedName} />
            <Field
              label="Email"
              value={
                <a href={`mailto:${a.email}`} className="underline">
                  {a.email}
                </a>
              }
            />
            <Field label="Phone" value={a.phoneNumber} />
            <Field label="Nationality" value={a.nationality} />
            <Field label="LinkedIn" value={link(a.linkedIn)} />
            <Field label="Website" value={link(a.website)} />
            <Field label="Area of expertise" value={a.expertise} />
            <Field label="Years of experience" value={a.experienceYears} />
            <Field label="Highest degree" value={a.degree} />
            <Field label="Languages" value={a.languages} />
          </section>
          <Field label="Certifications" value={a.certifications} />
          <Field label="Work experience" value={a.workExperience} />
          <Field label="Teaching experience" value={a.teachingExperience} />
          <Field label="Why they want to teach" value={a.motivation} />
          <Field label="Teaching philosophy" value={a.philosophy} />
          <Field label="Strengths" value={a.strengths} />
        </dl>

        <aside className="space-y-4">
          <p>
            <span className="font-semibold">Status:</span> {statusLabels[a.status]}
          </p>
          <p className="text-sm text-gray-600">
            Submitted{' '}
            {a.createdAt.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}
          </p>
          {a.status === 'PENDING' ? (
            <DecisionForm id={a.id} />
          ) : (
            <div className="bg-surface p-4 text-sm">
              <p>
                Decided by {a.reviewedBy?.name ?? 'an admin'} on{' '}
                {a.reviewedAt?.toLocaleDateString('en-GB', { dateStyle: 'long' })}
              </p>
              {a.reviewNote && <p className="mt-2 whitespace-pre-line">{a.reviewNote}</p>}
            </div>
          )}
          {aiConfig().enabled && <AiApplicationSummary applicationId={a.id} />}
        </aside>
      </div>
    </div>
  );
}

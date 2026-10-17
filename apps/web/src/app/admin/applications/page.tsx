import type { Metadata } from 'next';
import Link from 'next/link';
import type { ApplicationStatus } from '@/generated/prisma/client';
import { requireRole } from '@/server/auth/session';
import { listApplications } from '@/server/instructor-applications';
import { AdminHeading, AdminNav } from '../admin-nav';

export const metadata: Metadata = { title: 'Instructor applications', robots: { index: false } };

const tabs: { status: ApplicationStatus; label: string }[] = [
  { status: 'PENDING', label: 'Awaiting review' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'REJECTED', label: 'Not approved' },
];

export default async function ApplicationsPage({ searchParams }: PageProps<'/admin/applications'>) {
  const session = await requireRole('admin', '/admin/applications');
  const { status: param } = await searchParams;
  const status = tabs.find((t) => t.status === param)?.status ?? 'PENDING';
  const applications = await listApplications(status);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <AdminHeading title="Instructor applications" greeting={session.name} />
      <AdminNav current="/admin/applications" />

      <nav aria-label="Filter by status" className="mb-6 flex gap-4 text-sm font-semibold">
        {tabs.map((tab) => (
          <Link
            key={tab.status}
            href={`/admin/applications?status=${tab.status}`}
            aria-current={tab.status === status ? 'page' : undefined}
            className={tab.status === status ? 'text-brand-ink underline' : 'hover:text-brand-ink'}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {applications.length === 0 ? (
        <p className="bg-surface p-8 text-center text-gray-700">No applications here.</p>
      ) : (
        <ul className="divide-y divide-gray-300 border border-gray-300">
          {applications.map((a) => (
            <li key={a.id}>
              <Link
                href={`/admin/applications/${a.id}`}
                className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-gray-100"
              >
                <span>
                  <span className="font-semibold">{a.fullName}</span>
                  {a.initiatedName && <span className="text-gray-600"> ({a.initiatedName})</span>}
                  <span className="block text-sm text-gray-600">
                    {a.expertise} · {a.experienceYears} years · {a.nationality}
                  </span>
                </span>
                <span className="text-sm text-gray-600">
                  {a.createdAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRole } from '@/server/auth/session';
import { countOpenMessages } from '@/server/contact-messages';
import { countCoursesInReview } from '@/server/course-review';
import { countPendingApplications } from '@/server/instructor-applications';
import { AdminHeading, AdminNav } from './admin-nav';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };

export default async function AdminPage() {
  const session = await requireRole('admin', '/admin');
  const [coursesInReview, pendingApplications, openMessages] = await Promise.all([
    countCoursesInReview(),
    countPendingApplications(),
    countOpenMessages(),
  ]);

  const cards = [
    { href: '/admin/courses', label: 'Courses awaiting review', count: coursesInReview },
    {
      href: '/admin/applications',
      label: 'Instructor applications awaiting review',
      count: pendingApplications,
    },
    { href: '/admin/messages', label: 'Open contact messages', count: openMessages },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <AdminHeading title="Administration" greeting={session.name} />
      <AdminNav current="/admin" />
      <ul className="grid gap-6 sm:grid-cols-3">
        {cards.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="block bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
            >
              <p className="text-4xl font-extrabold text-brand">{card.count}</p>
              <p className="mt-2 font-semibold">{card.label}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { requireRole } from '@/server/auth/session';
import { listCoursesByStatus } from '@/server/course-review';
import { AdminHeading, AdminNav } from '../admin-nav';

export const metadata: Metadata = { title: 'Courses', robots: { index: false } };

const tabs = [
  { status: 'IN_REVIEW', label: 'Awaiting review' },
  { status: 'PUBLISHED', label: 'Published' },
  { status: 'DRAFT', label: 'Drafts' },
] as const;

export default async function AdminCoursesPage({ searchParams }: PageProps<'/admin/courses'>) {
  const session = await requireRole('admin', '/admin/courses');
  const { status: param } = await searchParams;
  const status = tabs.find((t) => t.status === param)?.status ?? 'IN_REVIEW';
  const courses = await listCoursesByStatus(status);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <AdminHeading title="Courses" greeting={session.name} />
      <AdminNav current="/admin/courses" />

      <nav aria-label="Filter by status" className="mb-6 flex gap-4 text-sm font-semibold">
        {tabs.map((tab) => (
          <Link
            key={tab.status}
            href={`/admin/courses?status=${tab.status}`}
            aria-current={tab.status === status ? 'page' : undefined}
            className={tab.status === status ? 'text-brand underline' : 'hover:text-brand'}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {courses.length === 0 ? (
        <p className="bg-surface p-8 text-center text-gray-700">No courses here.</p>
      ) : (
        <ul className="divide-y divide-gray-300 border border-gray-300">
          {courses.map((course) => (
            <li key={course.id}>
              <Link
                href={`/admin/courses/${course.id}`}
                className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-gray-100"
              >
                <span>
                  <span className="font-semibold">{course.title}</span>
                  <span className="block text-sm text-gray-600">
                    {course.category.name} · {course.instructor?.name ?? course.instructorName}
                    {course.submittedAt &&
                      ` · submitted ${course.submittedAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}`}
                  </span>
                </span>
                <StatusBadge status={course.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { requireRole } from '@/server/auth/session';
import { listOwnCourses } from '@/server/authoring';
import { getCategories } from '@/server/catalog';
import { NewCourseForm } from './new-course-form';

export const metadata: Metadata = { title: 'Instructor', robots: { index: false } };

export default async function InstructorPage() {
  const session = await requireRole('instructor', '/instructor');
  const [courses, categories] = await Promise.all([listOwnCourses(session), getCategories()]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-brand uppercase">{session.name}</p>
      <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">Instructor dashboard</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-4 text-xl font-bold">Your courses</h2>
          {courses.length === 0 ? (
            <p className="bg-surface p-8 text-center text-gray-700">
              You have not created a course yet. Start with a title and a category.
            </p>
          ) : (
            <ul className="divide-y divide-gray-300 border border-gray-300">
              {courses.map((course) => (
                <li key={course.id}>
                  <Link
                    href={`/instructor/courses/${course.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-gray-100"
                  >
                    <span>
                      <span className="font-semibold">{course.title}</span>
                      <span className="block text-sm text-gray-600">
                        {course.category.name} · {course._count.sections} sections · updated{' '}
                        {course.updatedAt.toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                      </span>
                    </span>
                    <StatusBadge status={course.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside>
          <NewCourseForm categories={categories.map((c) => ({ value: c.slug, label: c.name }))} />
        </aside>
      </div>
    </div>
  );
}

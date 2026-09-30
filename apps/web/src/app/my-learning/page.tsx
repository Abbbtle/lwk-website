import type { Metadata } from 'next';
import Link from 'next/link';
import { CourseCover } from '@/components/course-cover';
import { plural } from '@/lib/format';
import { requireSession } from '@/server/auth/session';
import { listMyLearning } from '@/server/learning';

export const metadata: Metadata = { title: 'My Learning', robots: { index: false } };

export default async function MyLearningPage() {
  const session = await requireSession('/my-learning');
  const courses = await listMyLearning(session.userId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-brand uppercase">Hare Krishna, {session.name}</p>
      <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">My Learning</h1>

      {courses.length === 0 ? (
        <div className="mt-8 bg-white p-10 text-center shadow-md">
          <p className="text-lg text-gray-700">
            You have not enrolled in a course yet. Start with a free course, or browse the
            catalogue: every course is free during early access.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/explore?type=courses" className="btn-solid">
              Free courses
            </Link>
            <Link href="/courses" className="btn-outline">
              Browse all courses
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <li key={course.slug} className="flex flex-col bg-white shadow-md">
              <CourseCover categorySlug={course.categorySlug} imageUrl={course.coverUrl} />
              <div className="flex flex-1 flex-col gap-3 p-5">
                <h2 className="text-lg font-semibold">{course.title}</h2>
                <p className="text-sm text-gray-600">{course.instructor}</p>
                <div className="mt-auto space-y-2">
                  <div
                    role="progressbar"
                    aria-label={`${course.title} progress`}
                    aria-valuenow={course.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 bg-gray-200"
                  >
                    <div className="h-2 bg-brand" style={{ width: `${course.percent}%` }} />
                  </div>
                  <p className="text-sm text-gray-600">
                    {course.completed
                      ? 'Completed'
                      : `${course.percent}% · ${course.completedCount} of ${plural(course.totalLessons, 'lesson')}`}
                  </p>
                  <Link href={`/learn/${course.slug}`} className="btn-solid w-full">
                    {course.completed
                      ? 'Review course'
                      : course.completedCount === 0
                        ? 'Start course'
                        : 'Continue'}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

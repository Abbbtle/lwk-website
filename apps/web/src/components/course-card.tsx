import { Clock } from 'lucide-react';
import Link from 'next/link';
import { CourseCover } from '@/components/course-cover';
import type { CourseSummary } from '@/lib/catalog/types';
import { formatDuration, formatPrice } from '@/lib/format';

export function CourseCard({ course }: { course: CourseSummary }) {
  return (
    <article className="group relative flex flex-col bg-white shadow-md transition-shadow duration-300 hover:shadow-lg">
      <CourseCover categorySlug={course.categorySlug} />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="text-xs font-semibold tracking-wide text-brand uppercase">
          {course.category.name}
        </p>
        <h3 className="text-lg font-semibold">
          <Link href={`/courses/${course.slug}`} className="after:absolute after:inset-0">
            {course.title}
          </Link>
        </h3>
        <p className="text-sm text-gray-600">{course.instructor}</p>
        <div className="mt-auto flex items-center justify-between pt-3 text-sm">
          <span className="flex items-center gap-1 text-gray-600">
            <Clock className="size-4" aria-hidden />
            {formatDuration(course.durationMinutes)} · {course.level}
          </span>
          {course.priceUsd !== null && (
            <span className="text-lg font-bold">{formatPrice(course.priceUsd)}</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function CourseGrid({ courses }: { courses: CourseSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => (
        <CourseCard key={course.slug} course={course} />
      ))}
    </div>
  );
}

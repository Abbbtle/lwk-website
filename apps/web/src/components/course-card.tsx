import Link from 'next/link';
import { FreeBadge, SampleBadge } from '@/components/badges';
import { CourseCover } from '@/components/course-cover';
import type { CourseSummary } from '@/lib/catalog/types';
import { formatDuration, formatPrice, joinParts, plural } from '@/lib/format';

/** Image-led card (as on Udemy) with the POC's price and "Enroll Now" button. */
export function CourseCard({ course }: { course: CourseSummary }) {
  return (
    <article className="group relative flex flex-col bg-white shadow-md transition-shadow duration-300 hover:shadow-xl">
      <div className="relative">
        <CourseCover categorySlug={course.categorySlug} imageUrl={course.coverUrl} />
        {(course.isFree || course.isSample) && (
          <div className="absolute top-3 left-3 flex gap-2">
            {course.isFree && <FreeBadge />}
            {course.isSample && <SampleBadge />}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <h3 className="text-lg leading-snug font-semibold">
          <Link
            href={`/courses/${course.slug}`}
            className="after:absolute after:inset-0 group-hover:text-brand"
          >
            {course.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-gray-600">{course.subtitle}</p>
        <p className="text-xs text-gray-500">{course.instructor}</p>
        <p className="text-xs text-gray-500">
          {joinParts([
            course.durationMinutes > 0 && `${formatDuration(course.durationMinutes)} total`,
            plural(course.lessonCount, 'lesson'),
            course.level,
          ])}
        </p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <span className="text-lg font-bold">
            {!course.isFree && course.priceUsd !== null ? formatPrice(course.priceUsd) : 'Free'}
          </span>
          {/* The whole card links to the course; this is the visual call to action. */}
          <span aria-hidden className="btn-outline px-4 py-2 text-sm">
            {course.isFree ? 'Start free' : 'Enroll Now'}
          </span>
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

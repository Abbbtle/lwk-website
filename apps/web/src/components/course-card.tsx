import Link from 'next/link';
import { FreeBadge, SampleBadge } from '@/components/badges';
import { CourseCover } from '@/components/course-cover';
import { CoursePrice } from '@/components/course-price';
import type { CourseSummary } from '@/lib/catalog/types';
import { formatDuration, joinParts, plural } from '@/lib/format';
import type { PriceRegion } from '@/lib/pricing';

/** Image-led card (as on Udemy) with the POC's price and "Enroll Now" button. */
export function CourseCard({
  course,
  region,
  eager = false,
  sizes,
}: {
  course: CourseSummary;
  /** Whose prices to show (see viewerPriceRegion). */
  region: PriceRegion;
  eager?: boolean;
  /** How wide the cover shows, when it differs from the usual grid (see CourseCover). */
  sizes?: string;
}) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-card bg-white shadow-md transition-shadow duration-300 hover:shadow-xl">
      <div className="relative">
        <CourseCover
          categorySlug={course.categorySlug}
          imageUrl={course.coverUrl}
          eager={eager}
          sizes={sizes}
        />
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
            className="after:absolute after:inset-0 group-hover:text-brand-ink"
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
          <CoursePrice pricing={course.pricing} region={region} variant="card" />
          {/* The whole card links to the course; this is the visual call to action. */}
          <span aria-hidden className="btn-outline px-4 py-2 text-sm">
            {course.isFree ? 'Start free' : 'Enroll Now'}
          </span>
        </div>
      </div>
    </article>
  );
}

export function CourseGrid({ courses, region }: { courses: CourseSummary[]; region: PriceRegion }) {
  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((course, index) => (
        <CourseCard key={course.slug} course={course} region={region} eager={index < 3} />
      ))}
    </div>
  );
}

/**
 * A row to swipe through on phones (as on Udemy); the usual grid from tablet width up. For rows
 * below the fold: covers load as the visitor scrolls, which keeps the first load light on slow
 * connections.
 */
export function CourseRow({ courses, region }: { courses: CourseSummary[]; region: PriceRegion }) {
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pt-1 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-8 sm:overflow-visible sm:p-0 lg:grid-cols-3">
      {courses.map((course) => (
        <li key={course.slug} className="grid w-[82%] shrink-0 snap-start sm:w-auto">
          {/* Cards are 82% of the screen wide on phones, so a smaller cover is enough. */}
          <CourseCard
            course={course}
            region={region}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 82vw"
          />
        </li>
      ))}
    </ul>
  );
}

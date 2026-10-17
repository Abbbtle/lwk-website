'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CourseCard } from '@/components/course-card';
import type { Category, CourseSummary } from '@/lib/catalog/types';

/** POC course section: one tab per category, courses of the selected category below. */
export function CourseTabs({
  categories,
  courses,
}: {
  categories: Category[];
  courses: CourseSummary[];
}) {
  const [active, setActive] = useState(categories[0]?.slug);
  const shown = courses.filter((c) => c.categorySlug === active);

  return (
    <div>
      <div role="tablist" aria-label="Course categories" className="mb-8 flex flex-wrap gap-4">
        {categories.map((category) => {
          const selected = category.slug === active;
          return (
            <button
              key={category.slug}
              type="button"
              role="tab"
              id={`tab-${category.slug}`}
              aria-selected={selected}
              aria-controls="course-tab-panel"
              onClick={() => setActive(category.slug)}
              className={`cursor-pointer rounded-lg px-4 py-2 font-medium ${
                selected
                  ? 'border-2 border-black text-black shadow-[0_3px_0_0_black]'
                  : 'border-2 border-transparent text-gray-600 hover:text-black'
              }`}
            >
              {category.name}
            </button>
          );
        })}
      </div>

      <div id="course-tab-panel" role="tabpanel" aria-labelledby={`tab-${active}`}>
        {shown.length > 0 ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((course) => (
              <CourseCard key={course.slug} course={course} />
            ))}
          </div>
        ) : (
          <div className="bg-white p-10 text-center shadow-md">
            <p className="text-lg font-semibold">New courses are on their way.</p>
            <p className="mt-2 text-gray-600">
              Know this subject well?{' '}
              <Link href="/become-an-instructor" className="font-semibold underline">
                Become an instructor
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

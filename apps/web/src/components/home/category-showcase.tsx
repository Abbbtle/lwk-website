import Image from 'next/image';
import Link from 'next/link';
import { categoryImage } from '@/components/course-cover';
import type { Category } from '@/lib/catalog/types';
import { plural } from '@/lib/format';
import { sectionHeading, sectionIntro, textLink } from './styles';

/**
 * Every category as a large photo card (as Udemy's top categories). Cards are a row to swipe
 * through on phones and a grid on wider screens that wraps, so any number of categories fits.
 */
export function CategoryShowcase({
  categories,
}: {
  categories: (Category & { courseCount: number })[];
}) {
  return (
    <section aria-labelledby="category-showcase" className="page-width py-16 lg:py-24">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="max-w-2xl">
          <h2 id="category-showcase" className={sectionHeading}>
            Devotional skills for every part of life
          </h2>
          <p className={`mt-3 ${sectionIntro}`}>
            Learn the skills of devotional life at home, step by step, from teachers who live them
            every day.
          </p>
        </div>
        <Link href="/courses" className={textLink}>
          Browse all courses
        </Link>
      </div>
      <ul className="-mx-4 mt-10 flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {categories.map((category) => (
          <li key={category.slug} className="w-[72%] shrink-0 snap-start sm:w-auto">
            <Link href={`/courses?category=${category.slug}`} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-gray-200">
                <Image
                  src={categoryImage(category.slug).src}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 72vw"
                  className="object-cover"
                />
              </div>
              <p className="mt-4 text-lg font-semibold text-gray-900 group-hover:underline group-hover:underline-offset-4">
                {category.name}
              </p>
              <p className="text-sm text-gray-600">
                {category.courseCount > 0
                  ? plural(category.courseCount, 'course')
                  : 'Courses on their way'}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

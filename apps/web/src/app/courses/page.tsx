import type { Metadata } from 'next';
import Link from 'next/link';
import { CategoryPills } from '@/components/category-pills';
import { CourseGrid } from '@/components/course-card';
import { getCategories, searchCourses } from '@/server/catalog';

export const metadata: Metadata = {
  title: 'All Courses',
  description: 'Browse courses in kirtan, prasadam, Vaisnava etiquette and sastra study.',
};

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function CoursesPage({ searchParams }: PageProps<'/courses'>) {
  const params = await searchParams;
  const query = single(params.q)?.trim() || undefined;
  const categorySlug = single(params.category) || undefined;
  const free = single(params.free) === '1';

  const categories = await getCategories();
  const category = categories.find((c) => c.slug === categorySlug);
  const courses = await searchCourses({ query, category: category?.slug, free });

  const freeHref = (on: boolean) => {
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (category) next.set('category', category.slug);
    if (on) next.set('free', '1');
    const qs = next.toString();
    return `/courses${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold md:text-4xl">
        {query ? (
          <>
            {courses.length} {courses.length === 1 ? 'result' : 'results'} for &ldquo;{query}&rdquo;
          </>
        ) : category ? (
          category.name
        ) : (
          'All Courses'
        )}
      </h1>
      <p className="mt-2 text-lg text-gray-700">
        {category?.description ?? 'Find a course to deepen your devotional practice.'}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <CategoryPills
          categories={categories}
          active={category?.slug}
          query={query}
          keep={{ free: free ? '1' : undefined }}
        />
        <Link
          href={freeHref(!free)}
          aria-pressed={free}
          className={`flex items-center gap-2 text-sm font-semibold ${free ? 'text-brand' : 'hover:text-brand'}`}
        >
          <span
            aria-hidden
            className={`flex size-5 items-center justify-center border-2 ${free ? 'border-brand bg-brand text-white' : 'border-black'}`}
          >
            {free && '✓'}
          </span>
          Free courses only
        </Link>
      </div>

      <p className="mt-8 mb-6 text-sm text-gray-600" aria-live="polite">
        {!query && `${courses.length} ${courses.length === 1 ? 'course' : 'courses'}`}
      </p>

      {courses.length > 0 ? (
        <CourseGrid courses={courses} />
      ) : (
        <div className="bg-white p-10 text-center shadow-md">
          <p className="text-lg font-semibold">No courses match your search.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href="/courses" className="btn-outline">
              Clear filters
            </Link>
            <Link href="/explore" className="btn-solid">
              Explore free content
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

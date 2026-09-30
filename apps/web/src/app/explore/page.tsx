import type { Metadata } from 'next';
import Link from 'next/link';
import { CategoryPills } from '@/components/category-pills';
import { CourseGrid } from '@/components/course-card';
import { getCategories, searchCourses } from '@/server/catalog';

export const metadata: Metadata = {
  title: 'Explore Courses',
  description: 'Browse courses in kirtan, prasadam, Vaisnava etiquette and sastra study.',
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ExplorePage({ searchParams }: PageProps<'/explore'>) {
  const params = await searchParams;
  const query = single(params.q)?.trim() || undefined;
  const categorySlug = single(params.category) || undefined;

  const categories = await getCategories();
  const category = categories.find((c) => c.slug === categorySlug);
  const courses = await searchCourses({ query, category: category?.slug });

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
          'Explore Courses'
        )}
      </h1>
      <p className="mt-2 text-lg text-gray-700">
        {category?.description ?? 'Find a course to deepen your devotional practice.'}
      </p>

      <div className="mt-8">
        <CategoryPills categories={categories} active={category?.slug} query={query} />
      </div>

      <p className="mt-8 mb-6 text-sm text-gray-600" aria-live="polite">
        {!query && `${courses.length} ${courses.length === 1 ? 'course' : 'courses'}`}
      </p>

      {courses.length > 0 ? (
        <CourseGrid courses={courses} />
      ) : (
        <div className="bg-white p-10 text-center shadow-md">
          <p className="text-lg font-semibold">No courses match your search.</p>
          <Link href="/explore" className="btn-outline mt-4">
            Clear filters
          </Link>
        </div>
      )}
    </div>
  );
}

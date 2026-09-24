import type { Metadata } from 'next';
import Link from 'next/link';
import { CourseCover } from '@/components/course-cover';
import { getCategories } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Categories',
  description: 'Browse course categories: kirtan, prasadam, Vaisnava etiquette and sastra study.',
};

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold md:text-4xl">Categories</h1>
      <p className="mt-2 text-lg text-gray-700">Choose an area of devotional life to explore.</p>

      <ul className="mt-10 grid gap-8 sm:grid-cols-2">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              href={`/explore?category=${category.slug}`}
              className="group flex h-full flex-col bg-white shadow-md transition-shadow hover:shadow-lg"
            >
              <CourseCover categorySlug={category.slug} />
              <div className="space-y-2 p-6">
                <p className="text-sm font-semibold text-brand uppercase">{category.headline}</p>
                <h2 className="text-2xl font-bold group-hover:text-brand">{category.name}</h2>
                <p className="text-gray-700">{category.description}</p>
                <p className="pt-2 text-sm font-semibold">
                  {category.courseCount} {category.courseCount === 1 ? 'course' : 'courses'}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

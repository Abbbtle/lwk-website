import Link from 'next/link';
import { CategoryPills } from '@/components/category-pills';
import { CourseGrid } from '@/components/course-card';
import { CourseCover } from '@/components/course-cover';
import { getCategories, searchCourses } from '@/lib/catalog';

export default async function HomePage() {
  const [categories, courses] = await Promise.all([getCategories(), searchCourses()]);
  // One course from each category first, so the home page shows the full range.
  const featured = categories
    .map((category) => courses.find((c) => c.categorySlug === category.slug))
    .filter((c) => c !== undefined)
    .concat(courses)
    .filter((c, i, all) => all.indexOf(c) === i)
    .slice(0, 6);

  return (
    <>
      <section className="mx-auto flex max-w-7xl flex-col items-center gap-10 px-4 py-16 sm:px-6 md:flex-row lg:px-8 lg:py-24">
        <div className="space-y-4 text-center md:w-1/2 md:text-left">
          <p className="text-lg font-extrabold uppercase md:text-xl lg:text-2xl">
            Rediscover Devotion
          </p>
          <h1 className="text-3xl font-extrabold uppercase md:text-4xl lg:text-6xl">
            Experience Bhakti Yoga like <span className="text-brand">never before.</span>
          </h1>
          <p className="text-sm text-gray-700 md:text-base lg:text-lg">
            Discover a transformative journey into the heart of Bhakti Yoga. Whether you are a
            beginner or looking to deepen your practice, our courses are designed to guide you
            step-by-step. Learn from experienced practitioners, connect with like-minded souls, and
            grow in devotion.
          </p>
          <div className="flex justify-center md:justify-start">
            <Link href="/explore" className="btn-outline">
              Start Learning
            </Link>
          </div>
        </div>
        <ul className="grid w-full grid-cols-2 gap-4 md:w-1/2">
          {categories.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/explore?category=${category.slug}`}
                className="block bg-white shadow-md transition-shadow hover:shadow-lg"
              >
                <CourseCover categorySlug={category.slug} />
                <span className="block px-4 py-3 font-semibold">{category.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-surface py-16">
        <div className="mx-auto max-w-7xl space-y-16 px-4 sm:px-6 lg:px-8">
          {categories.slice(0, 3).map((category, index) => (
            <div
              key={category.slug}
              className={`flex flex-col items-center gap-8 md:gap-12 ${
                index % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'
              }`}
            >
              <CourseCover categorySlug={category.slug} className="w-full shadow-md md:w-1/2" />
              <div className="space-y-4 text-center md:w-1/2 md:text-left">
                <p className="text-lg font-extrabold uppercase md:text-xl lg:text-2xl">
                  {category.headline}
                </p>
                <h2 className="text-3xl font-extrabold uppercase md:text-4xl">{category.name}</h2>
                <p className="text-gray-700 md:text-lg">{category.description}</p>
                <div className="flex justify-center md:justify-start">
                  <Link href={`/explore?category=${category.slug}`} className="btn-outline">
                    Enroll Now
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-extrabold md:text-4xl">
          Transform Your Life with the Power of Bhakti Yoga
        </h2>
        <p className="mt-2 mb-8 text-lg text-gray-700">
          Explore our curated collection of transformative courses
        </p>
        <div className="mb-8">
          <CategoryPills categories={categories} />
        </div>
        <CourseGrid courses={featured} />
        <div className="mt-10 text-center">
          <Link href="/explore" className="btn-solid">
            View all courses
          </Link>
        </div>
      </section>

      <section className="bg-black text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 lg:flex-row lg:justify-between lg:px-8 lg:text-left">
          <div className="max-w-2xl space-y-4">
            <h2 className="text-3xl font-extrabold md:text-4xl lg:text-5xl">
              Become An <span className="text-brand">Instructor</span>
            </h2>
            <p className="text-gray-300 md:text-lg">
              Instructors from around the world teach learners on LWK. We provide the tools and
              skills to teach what you love.
            </p>
          </div>
          <Link href="/become-an-instructor" className="btn-brand shrink-0">
            Start teaching today
          </Link>
        </div>
      </section>
    </>
  );
}

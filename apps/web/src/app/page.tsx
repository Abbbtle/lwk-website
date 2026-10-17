import Link from 'next/link';
import { connection } from 'next/server';
import { CourseRow } from '@/components/course-card';
import { beginnerCourses } from '@/lib/catalog/beginner-courses';
import { plural } from '@/lib/format';
import { site } from '@/lib/site';
import { getCategories, searchCourses } from '@/server/catalog';

/** Two rows of the course grid. */
const BEGINNER_LIMIT = 6;

const sectionHeading = 'text-3xl font-bold tracking-tight text-black md:text-4xl';

export default async function HomePage() {
  await connection();
  const [categories, courses] = await Promise.all([getCategories(), searchCourses()]);
  const beginners = beginnerCourses(categories, courses, BEGINNER_LIMIT);

  return (
    <>
      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:py-28">
          <h1 className="text-5xl leading-[1.05] font-bold tracking-tight text-balance text-black sm:text-6xl lg:text-7xl">
            {site.tagline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-700 sm:text-xl">
            Courses taught by experienced devotees, with lessons you can take at your own pace,
            whether you are just starting out or deepening your practice.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/courses" className="btn-solid">
              Browse courses
            </Link>
            <Link href="/explore" className="btn-outline">
              Explore free content
            </Link>
          </div>
        </div>
      </section>

      {beginners.length > 0 && (
        <section aria-labelledby="beginner-courses">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <h2 id="beginner-courses" className={sectionHeading}>
                Start with a beginner course
              </h2>
              <Link href="/courses" className="font-semibold underline-offset-4 hover:underline">
                View all courses
              </Link>
            </div>
            <CourseRow courses={beginners} />
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <section aria-labelledby="categories" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <h2 id="categories" className={`${sectionHeading} mb-8`}>
              Browse by category
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/courses?category=${category.slug}`}
                    className="flex h-full flex-col border border-gray-300 p-6 transition-colors hover:border-black"
                  >
                    <span className="text-lg font-semibold text-black">{category.name}</span>
                    <span className="mt-2 text-sm leading-relaxed text-gray-700">
                      {category.description}
                    </span>
                    <span className="mt-auto pt-4 text-sm font-semibold text-gray-700">
                      {category.courseCount > 0
                        ? plural(category.courseCount, 'course')
                        : 'Courses on their way'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-7xl gap-x-12 gap-y-14 px-4 py-16 sm:px-6 md:grid-cols-2 lg:px-8 lg:py-20">
        <div>
          <h2 className={sectionHeading}>Free for everyone</h2>
          <p className="mt-3 max-w-[34em] text-lg leading-relaxed text-gray-700">
            Explore has free courses, talks, recordings, articles and recipes. No subscription
            needed.
          </p>
          <Link href="/explore" className="btn-outline mt-6">
            Explore free content
          </Link>
        </div>
        <div className="md:border-l md:border-gray-300 md:pl-12">
          <h2 className={sectionHeading}>Teach what you know</h2>
          <p className="mt-3 max-w-[34em] text-lg leading-relaxed text-gray-700">
            Experienced in a devotional skill? Apply to teach. Once you are approved, you build your
            course with video, PDF and text lessons, and we review it before it is published.
          </p>
          <Link href="/become-an-instructor" className="btn-outline mt-6">
            Apply to teach
          </Link>
        </div>
      </section>
    </>
  );
}

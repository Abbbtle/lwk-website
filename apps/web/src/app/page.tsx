import Link from 'next/link';
import { connection } from 'next/server';
import { CourseRow } from '@/components/course-card';
import { type HeroBannerSlide, HeroCarousel } from '@/components/hero-carousel';
import { beginnerCourses } from '@/lib/catalog/beginner-courses';
import { plural } from '@/lib/format';
import { getCategories, searchCourses } from '@/server/catalog';
import { listPublishedResources } from '@/server/resources';

/** Two rows of the course grid. */
const BEGINNER_LIMIT = 6;

const sectionHeading = 'text-3xl font-bold tracking-tight text-black md:text-4xl';

/**
 * The hero banner's slides. To advertise something new, add a slide here. Slides about beginner
 * courses and free content show only when there are some.
 * TODO: the POC photos need usage permission (or replacing) before the public launch.
 */
function heroSlides({
  hasBeginnerCourses,
  hasFreeContent,
}: {
  hasBeginnerCourses: boolean;
  hasFreeContent: boolean;
}): HeroBannerSlide[] {
  const slides: (HeroBannerSlide | false)[] = [
    {
      id: 'learn',
      heading: 'Grow in devotion, one lesson at a time',
      text: 'Learn devotional skills in the comfort of your home, from experienced devotees and at your own pace.',
      action: { href: '/courses', label: 'Start learning' },
      cardSide: 'right',
      image: {
        src: '/images/hero-devotion.jpg',
        alt: 'Devotees gathered in kirtan around a garlanded seat',
        position: '50% 35%',
      },
    },
    hasBeginnerCourses && {
      id: 'beginners',
      heading: 'New here? Start with the basics',
      text: 'Beginner courses take you step by step, from your very first lesson.',
      action: { href: '#beginner-courses', label: 'See beginner courses' },
      image: {
        src: '/images/hero-sastra.jpg',
        alt: 'Volumes of Vedic literature',
        position: '50% 40%',
      },
    },
    hasFreeContent && {
      id: 'free',
      heading: 'Begin today, for free',
      text: 'Watch talks, listen to kirtan and take free courses, open to everyone. No subscription needed.',
      action: { href: '/explore', label: 'Explore free content' },
      image: {
        src: '/images/mission-hero.jpg',
        alt: 'A temple with blue domes at sunset',
        position: '50% 40%',
      },
    },
    {
      id: 'teach',
      heading: 'Share what you know',
      text: 'Teach the devotional skills you love and help others grow. We review every course before it goes live.',
      action: { href: '/become-an-instructor', label: 'Apply to teach' },
      image: {
        src: '/images/hero-kirtan.jpg',
        alt: 'A kirtan leader singing with devotees',
        position: '50% 30%',
      },
    },
  ];
  return slides.filter((slide) => slide !== false);
}

export default async function HomePage() {
  await connection();
  const [categories, courses, resources] = await Promise.all([
    getCategories(),
    searchCourses(),
    listPublishedResources({ take: 1 }),
  ]);
  const beginners = beginnerCourses(categories, courses, BEGINNER_LIMIT);
  const hasFreeContent = resources.length > 0 || courses.some((course) => course.isFree);

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:pt-8 lg:px-8">
        <HeroCarousel
          label="Featured"
          slides={heroSlides({ hasBeginnerCourses: beginners.length > 0, hasFreeContent })}
        />
      </div>

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
                    className="flex h-full flex-col border border-gray-300 bg-white p-6 transition-colors hover:border-black"
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

      <section>
        <div className="mx-auto grid max-w-7xl gap-x-12 gap-y-14 px-4 py-16 sm:px-6 md:grid-cols-2 lg:px-8 lg:py-20">
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
              Experienced in a devotional skill? Apply to teach. Once you are approved, you build
              your course with video, PDF and text lessons, and we review it before it is published.
            </p>
            <Link href="/become-an-instructor" className="btn-outline mt-6">
              Apply to teach
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

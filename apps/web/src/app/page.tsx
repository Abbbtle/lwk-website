import Link from 'next/link';
import { connection } from 'next/server';
import { CourseRow } from '@/components/course-card';
import { HeroCarousel, type HeroCarouselSlide } from '@/components/hero-carousel';
import { HeroSlide } from '@/components/hero-slide';
import {
  CourseBuilderPreview,
  FreeContentPreview,
  LessonPreview,
} from '@/components/product-previews';
import { beginnerCourses } from '@/lib/catalog/beginner-courses';
import type { CourseSummary } from '@/lib/catalog/types';
import { plural } from '@/lib/format';
import { site } from '@/lib/site';
import { getCategories, searchCourses } from '@/server/catalog';
import { listPublishedResources, type ResourceSummary } from '@/server/resources';

/** Two rows of the course grid. */
const BEGINNER_LIMIT = 6;

const sectionHeading = 'text-3xl font-bold tracking-tight text-black md:text-4xl';

/**
 * The hero's slides, each pictured with the part of the site it is about. To advertise something
 * new, add a slide here. The free content slide shows only once there is free content.
 */
function heroSlides({
  featured,
  building,
  freeCourses,
  resources,
}: {
  featured?: CourseSummary;
  building?: CourseSummary;
  freeCourses: CourseSummary[];
  resources: ResourceSummary[];
}): HeroCarouselSlide[] {
  const slides: (HeroCarouselSlide | false)[] = [
    {
      id: 'learn',
      label: 'Courses',
      content: (
        <HeroSlide
          headingLevel="h1"
          heading={site.tagline}
          text="Video lessons, reading and progress tracking, taught by experienced devotees. Learn at your own pace, from your first steps to deeper study."
          action={
            <Link href="/courses" className="btn-solid">
              Browse courses
            </Link>
          }
          visual={featured && <LessonPreview course={featured} />}
        />
      ),
    },
    (freeCourses.length > 0 || resources.length > 0) && {
      id: 'free',
      label: 'Free content',
      content: (
        <HeroSlide
          heading="Free teachings, open to everyone."
          text="Talks, recordings, articles and free courses you can start right away. No subscription needed."
          action={
            <Link href="/explore" className="btn-solid">
              Explore free content
            </Link>
          }
          visual={<FreeContentPreview courses={freeCourses} resources={resources} />}
        />
      ),
    },
    {
      id: 'teach',
      label: 'Teach',
      content: (
        <HeroSlide
          heading="Share what you know."
          text="Apply to teach. Once you are approved, build your course with video, PDF and text lessons, and we review it before it is published."
          action={
            <Link href="/become-an-instructor" className="btn-solid">
              Apply to teach
            </Link>
          }
          visual={building && <CourseBuilderPreview course={building} />}
        />
      ),
    },
  ];
  return slides.filter((slide) => slide !== false);
}

export default async function HomePage() {
  await connection();
  const [categories, courses, resources] = await Promise.all([
    getCategories(),
    searchCourses(),
    listPublishedResources({ take: 4 }),
  ]);
  const beginners = beginnerCourses(categories, courses, BEGINNER_LIMIT);
  // Courses with the fullest curriculum make the clearest pictures in the hero.
  const bySections = (list: CourseSummary[]) =>
    list.toSorted((a, b) => b.sections.length - a.sections.length);
  const featured = bySections(beginners)[0] ?? bySections(courses)[0];
  const building = bySections(courses).find((course) => course !== featured) ?? featured;

  return (
    <>
      <div className="bg-gray-100">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <HeroCarousel
            label="Featured"
            slides={heroSlides({
              featured,
              building,
              freeCourses: courses.filter((course) => course.isFree),
              resources,
            })}
          />
        </div>
      </div>

      {beginners.length > 0 && (
        <section aria-labelledby="beginner-courses" className="bg-white">
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
        <section aria-labelledby="categories">
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

      <section className="bg-white">
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

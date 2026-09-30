import Image from 'next/image';
import Link from 'next/link';
import { connection } from 'next/server';
import { CourseTabs } from '@/components/course-tabs';
import { HeroCarousel, type HeroSlide } from '@/components/hero-carousel';
import { getCategories, searchCourses } from '@/server/catalog';

// Slides and photos as in the POC.
const slides: HeroSlide[] = [
  {
    kicker: 'Rediscover Devotion',
    image: '/images/hero-devotion.jpg',
    alt: 'Devotees gathered in kirtan around a garlanded seat',
    href: '/explore',
  },
  {
    kicker: 'Rediscover Kirtan',
    image: '/images/hero-kirtan.jpg',
    alt: 'A kirtan leader singing with devotees',
    href: '/explore?category=kirtan',
  },
  {
    kicker: 'Rediscover Prasadam',
    image: '/images/hero-prasadam.jpg',
    alt: 'A prasadam feast laid out on leaves',
    href: '/explore?category=prasadam',
  },
  {
    kicker: 'Rediscover Sastra',
    image: '/images/hero-sastra.jpg',
    alt: 'Volumes of Vedic literature',
    href: '/explore?category=sastra-study',
  },
];

export default async function HomePage() {
  await connection();
  const [categories, courses] = await Promise.all([getCategories(), searchCourses()]);

  return (
    <>
      <HeroCarousel slides={slides} />

      <section className="px-6 py-12 md:px-9">
        <h2 className="text-3xl font-extrabold md:text-4xl">
          Transform Your Life with the Power of Bhakti Yoga
        </h2>
        <p className="mt-2 mb-8 text-lg md:text-2xl">
          Explore our curated collection of transformative courses
        </p>
        <div className="md:px-10">
          <CourseTabs categories={categories} courses={courses} />
          {courses.length > 0 && (
            <div className="mt-10 text-center">
              <Link href="/explore" className="btn-solid">
                View all courses
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="px-6 py-16 lg:px-44 lg:py-20">
        <div className="flex flex-col items-center gap-8 lg:flex-row">
          <div className="w-full lg:w-1/2">
            <Image
              src="/images/become-instructor.jpg"
              alt="A devotee singing kirtan"
              width={400}
              height={400}
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="h-auto w-full"
            />
          </div>
          <div className="w-full space-y-4 text-center lg:w-1/2 lg:text-left">
            <h2 className="text-3xl font-extrabold md:text-4xl lg:text-5xl">
              Become An Instructor
            </h2>
            <p className="md:text-lg">
              Instructors from around the world teach millions of learners on LWK. We provide the
              tools and skills to teach what you love.
            </p>
            <div className="flex justify-center lg:justify-start">
              <Link href="/become-an-instructor" className="btn-outline">
                Start teaching today
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

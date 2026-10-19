import Link from 'next/link';
import { connection } from 'next/server';
import { CourseRow } from '@/components/course-card';
import { Faq } from '@/components/faq';
import { type HeroBannerSlide, HeroCarousel } from '@/components/hero-carousel';
import { CategoryShowcase } from '@/components/home/category-showcase';
import { EarlyAccess } from '@/components/home/early-access';
import { FeatureTiles } from '@/components/home/feature-tiles';
import { InstructorPromo } from '@/components/home/instructor-promo';
import { MissionTile } from '@/components/home/mission-tile';
import { sectionHeading, textLink } from '@/components/home/styles';
import { ResourceGrid } from '@/components/resource-card';
import { beginnerCourses } from '@/lib/catalog/beginner-courses';
import { getSession } from '@/server/auth/session';
import { getCategories, searchCourses } from '@/server/catalog';
import { earlyAccessEndsAt, salesPhase, type SalesPhase } from '@/server/early-access';
import { viewerPriceRegion } from '@/server/price-region';
import { listPublishedResources } from '@/server/resources';

/** Two rows of the course grid. */
const BEGINNER_LIMIT = 6;

/**
 * The hero banner's slides. To advertise something new, add a slide here. Slides about beginner
 * courses and free content show only when there are some.
 * TODO: the POC photos need usage permission (or replacing) before the public launch.
 */
function heroSlides({
  hasBeginnerCourses,
  hasFreeContent,
  signedIn,
  phase,
}: {
  hasBeginnerCourses: boolean;
  hasFreeContent: boolean;
  signedIn: boolean;
  phase: SalesPhase;
}): HeroBannerSlide[] {
  const slides: (HeroBannerSlide | false)[] = [
    {
      id: 'learn',
      tag: phase === 'early_access' ? 'Free during early access' : 'Courses for every devotee',
      heading: 'Grow in devotion, one lesson at a time',
      text: 'Learn devotional skills at home from experienced devotees, at your own pace.',
      action: { href: '/courses', label: 'Start learning' },
      secondary: signedIn ? undefined : { href: '/sign-up', label: 'Create free account' },
      align: 'right',
      image: {
        src: '/images/hero-devotion.jpg',
        alt: 'Devotees gathered in kirtan around a garlanded seat',
        position: '50% 35%',
      },
    },
    hasBeginnerCourses && {
      id: 'beginners',
      tag: 'For beginners',
      heading: 'New here? Start with the basics',
      text: 'Beginner courses take you step by step, from your very first lesson.',
      action: { href: '#beginner-courses', label: 'See beginner courses' },
      secondary: { href: '/courses', label: 'Browse all courses' },
    },
    hasFreeContent && {
      id: 'free',
      tag: 'Free for everyone',
      heading: 'Begin today, for free',
      text: 'Watch talks, listen to kirtan and take free courses. No subscription needed.',
      action: { href: '/explore', label: 'Explore free content' },
      image: {
        src: '/images/mission-hero.jpg',
        alt: 'The Temple of the Vedic Planetarium at sunset',
        position: '50% 40%',
      },
    },
    {
      id: 'teach',
      tag: 'For teachers',
      heading: 'Share what you know',
      text: 'Teach the devotional skills you love and help others grow. We review every course before it goes live.',
      action: { href: '/become-an-instructor', label: 'Apply to teach' },
      secondary: { href: '/help/becoming-an-instructor', label: 'How teaching works' },
      image: {
        src: '/images/hero-kirtan.jpg',
        alt: 'A kirtan leader singing with devotees',
        position: '50% 30%',
      },
    },
  ];
  return slides.filter((slide) => slide !== false);
}

const costAnswers: Record<SalesPhase, string> = {
  early_access:
    'During early access every course is free to join, and the courses you join stay yours when paid plans open. Courses marked Free stay free for everyone.',
  paid: 'Courses marked Free are free for everyone. Membership opens every paid course, or you can buy single courses, and the courses you joined during early access stay yours.',
};

const faqsFor = (phase: SalesPhase) => [
  { question: 'How much does it cost?', answer: costAnswers[phase] },
  {
    question: 'Do I need any experience?',
    answer:
      'No. Beginner courses start from the very first lesson, and you can learn at your own pace.',
  },
  {
    question: 'Who teaches the courses?',
    answer:
      'Experienced devotees. Every instructor applies and is approved, and every course is reviewed before it is published.',
  },
  {
    question: 'Can I learn on my phone?',
    answer:
      'Yes. The site works on phones, tablets and computers, and videos pick up where you stopped.',
  },
  {
    question: 'How do I become an instructor?',
    answer:
      'Apply with your experience. Once your application is approved, you can build a course and submit it for review.',
  },
  {
    question: 'Where can I get help?',
    answer:
      'Search the help centre, or send a support request and follow our reply in your account.',
  },
];

export default async function HomePage() {
  await connection();
  const [categories, courses, resources, session, region] = await Promise.all([
    getCategories(),
    searchCourses(),
    listPublishedResources({ take: 3 }),
    getSession(),
    viewerPriceRegion(),
  ]);
  const endsAt = earlyAccessEndsAt();
  const phase = salesPhase(endsAt, new Date());
  const earlyAccess = phase === 'early_access';
  const beginners = beginnerCourses(categories, courses, BEGINNER_LIMIT);
  const hasFreeContent = resources.length > 0 || courses.some((course) => course.isFree);

  return (
    <div className="bg-white">
      {earlyAccess && (
        <p className="border-b border-black/15 bg-brand px-4 py-3 text-center text-sm font-semibold text-black sm:text-base">
          Early access: every course is free to join.{' '}
          <Link href="/courses" className="underline underline-offset-4 hover:no-underline">
            Browse courses
          </Link>
        </p>
      )}

      <HeroCarousel
        label="Featured"
        slides={heroSlides({
          hasBeginnerCourses: beginners.length > 0,
          hasFreeContent,
          signedIn: Boolean(session),
          phase,
        })}
      />

      {categories.length > 0 && <CategoryShowcase categories={categories} />}

      {beginners.length > 0 && (
        <section aria-labelledby="beginner-courses" className="bg-gray-50">
          <div className="page-width py-16 lg:py-24">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <h2 id="beginner-courses" className={sectionHeading}>
                Start with a beginner course
              </h2>
              <Link href="/courses" className={textLink}>
                View all courses
              </Link>
            </div>
            <CourseRow courses={beginners} region={region} phase={phase} />
          </div>
        </section>
      )}

      <FeatureTiles course={beginners[0]} />

      {earlyAccess && <EarlyAccess signedIn={Boolean(session)} endsAt={endsAt} />}

      {resources.length > 0 && (
        <section aria-labelledby="free-content" className="page-width pt-16 lg:pt-24">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 id="free-content" className={sectionHeading}>
              Free to watch, listen and read
            </h2>
            <Link href="/explore" className={textLink}>
              Explore free content
            </Link>
          </div>
          <ResourceGrid resources={resources} />
        </section>
      )}

      <InstructorPromo />

      <MissionTile />

      <Faq heading="Questions people ask" items={faqsFor(phase)} />
    </div>
  );
}

import { Check, ChartNoAxesColumn, Clock, ListVideo } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { FreeBadge, SampleBadge } from '@/components/badges';
import { CourseCover } from '@/components/course-cover';
import { CoursePrice } from '@/components/course-price';
import { JsonLd } from '@/components/json-ld';
import { RichText } from '@/components/rich-text';
import { formatDuration, joinParts, plural } from '@/lib/format';
import {
  type CoursePricing,
  courseListPrice,
  formatRecurring,
  membershipLeadPrice,
  type PriceRegion,
  toDecimalString,
} from '@/lib/pricing';
import { getSession } from '@/server/auth/session';
import { getCourse } from '@/server/catalog';
import { getEnrollmentBySlug } from '@/server/learning';
import { viewerPriceRegion } from '@/server/price-region';
import { enrollInCourse } from './actions';

// Metadata and page share one query per request.
const loadCourse = cache(getCourse);

export async function generateMetadata({
  params,
}: PageProps<'/courses/[slug]'>): Promise<Metadata> {
  const course = await loadCourse((await params).slug);
  if (!course) return {};
  return {
    title: course.title,
    description: course.subtitle,
    alternates: { canonical: `/courses/${course.slug}` },
    openGraph: { title: course.title, description: course.subtitle, type: 'website' },
  };
}

/**
 * For search engines: free, or what the course costs the visitor once paid plans open. A course
 * without a price yet has no offer.
 */
function courseOffer(pricing: CoursePricing, region: PriceRegion) {
  const price = courseListPrice(pricing, region);
  if (!price) return undefined;
  return {
    '@type': 'Offer',
    category: pricing.kind === 'free' ? 'Free' : 'Paid',
    price: toDecimalString(price),
    priceCurrency: price.currency,
  };
}

export default async function CoursePage({ params }: PageProps<'/courses/[slug]'>) {
  const { slug } = await params;
  const [course, session, region] = await Promise.all([
    loadCourse(slug),
    getSession(),
    viewerPriceRegion(),
  ]);
  if (!course) notFound();
  const enrollment = session ? await getEnrollmentBySlug(session.userId, slug) : null;

  const facts = [
    { icon: ChartNoAxesColumn, label: course.level },
    // Hidden until lesson lengths are known.
    course.durationMinutes > 0 && { icon: Clock, label: formatDuration(course.durationMinutes) },
    { icon: ListVideo, label: plural(course.lessonCount, 'lesson') },
  ].filter((fact) => fact !== false);

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Course',
          name: course.title,
          description: course.subtitle || course.description,
          provider: { '@type': 'Organization', name: 'Living With Krishna' },
          educationalLevel: course.level,
          isAccessibleForFree: course.pricing.kind === 'free',
          offers: courseOffer(course.pricing, region),
          hasCourseInstance: {
            '@type': 'CourseInstance',
            courseMode: 'online',
            instructor: { '@type': 'Person', name: course.instructor },
          },
        }}
      />
      <section className="bg-black text-white">
        <div className="page-width grid gap-10 py-12 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <nav aria-label="Breadcrumb" className="text-sm text-gray-300">
              <Link href="/courses" className="hover:text-brand">
                Courses
              </Link>
              {' / '}
              <Link href={`/courses?category=${course.categorySlug}`} className="hover:text-brand">
                {course.category.name}
              </Link>
            </nav>
            {(course.isFree || course.isSample) && (
              <div className="flex gap-2">
                {course.isFree && <FreeBadge />}
                {course.isSample && <SampleBadge />}
              </div>
            )}
            <h1 className="text-3xl font-extrabold md:text-5xl">{course.title}</h1>
            <p className="text-lg text-gray-200">{course.subtitle}</p>
            <p className="text-sm text-gray-300">
              Taught by <span className="font-semibold text-white">{course.instructor}</span>
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {facts.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2">
                  <Icon className="size-4 text-brand" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="page-width grid gap-10 py-12 lg:grid-cols-3">
        <div className="space-y-12 lg:col-span-2">
          {course.isSample && (
            <p className="border-l-4 border-gray-400 bg-white p-4 text-sm text-gray-700">
              This is a sample course used to test the platform. It will be replaced by courses from
              our instructors.
            </p>
          )}
          <section className="border border-gray-300 p-6">
            <h2 className="text-2xl font-bold">What you&apos;ll learn</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {course.outcomes.map((outcome) => (
                <li key={outcome} className="flex gap-3">
                  <Check className="mt-0.5 size-5 shrink-0 text-brand-ink" aria-hidden />
                  {outcome}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold">Course content</h2>
            <p className="mt-1 text-sm text-gray-600">
              {joinParts([
                plural(course.sections.length, 'section'),
                plural(course.lessonCount, 'lesson'),
                course.durationMinutes > 0 && `${formatDuration(course.durationMinutes)} total`,
              ])}
            </p>
            <ol className="mt-4 divide-y divide-gray-300 border border-gray-300">
              {course.sections.map((section, index) => (
                <li key={section.title} className="flex items-center justify-between gap-4 p-4">
                  <span className="font-semibold">
                    <span className="text-gray-500">{index + 1}.</span> {section.title}
                  </span>
                  <span className="shrink-0 text-sm text-gray-600">
                    {joinParts([
                      plural(section.lessonCount, 'lesson'),
                      section.durationMinutes > 0 && formatDuration(section.durationMinutes),
                    ])}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-bold">Description</h2>
            <RichText
              text={course.description}
              size="sm"
              className="mt-4 text-base text-gray-700"
            />
          </section>
        </div>

        <aside className="lg:-mt-48">
          <div className="bg-white shadow-lg lg:sticky lg:top-6">
            <CourseCover categorySlug={course.categorySlug} imageUrl={course.coverUrl} />
            <div className="space-y-4 p-6">
              {enrollment ? (
                <>
                  <p className="font-semibold">
                    {enrollment.completedAt ? 'You completed this course.' : 'You are enrolled.'}
                  </p>
                  <Link href={`/learn/${course.slug}`} className="btn-brand w-full">
                    {enrollment.completedAt ? 'Review the course' : 'Continue learning'}
                  </Link>
                </>
              ) : (
                <>
                  <CoursePrice pricing={course.pricing} region={region} variant="page" />
                  {session ? (
                    <form action={enrollInCourse.bind(null, course.slug)}>
                      <button type="submit" className="btn-brand w-full">
                        Enroll now
                      </button>
                    </form>
                  ) : (
                    <a
                      href={`/sign-up?returnTo=${encodeURIComponent(`/courses/${course.slug}`)}`}
                      className="btn-brand w-full"
                    >
                      Sign up to enroll
                    </a>
                  )}
                  {course.previewLessonId && (
                    <Link
                      href={`/learn/${course.slug}/${course.previewLessonId}`}
                      className="btn-outline w-full"
                    >
                      Watch a free preview
                    </Link>
                  )}
                </>
              )}
              <p className="text-center text-sm text-gray-600">
                Or get every course with a{' '}
                <Link href="/plans-and-pricing" className="font-semibold underline">
                  Membership
                </Link>
                , {formatRecurring(membershipLeadPrice(region))}, when paid plans open.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

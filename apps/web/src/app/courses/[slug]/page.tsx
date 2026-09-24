import { Check, ChartNoAxesColumn, Clock, ListVideo } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { CourseCover } from '@/components/course-cover';
import { formatDuration, formatPrice } from '@/lib/format';
import { getCourse } from '@/server/catalog';

// Metadata and page share one query per request.
const loadCourse = cache(getCourse);

export async function generateMetadata({
  params,
}: PageProps<'/courses/[slug]'>): Promise<Metadata> {
  const course = await loadCourse((await params).slug);
  return course ? { title: course.title, description: course.subtitle } : {};
}

export default async function CoursePage({ params }: PageProps<'/courses/[slug]'>) {
  const course = await loadCourse((await params).slug);
  if (!course) notFound();

  const facts = [
    { icon: ChartNoAxesColumn, label: course.level },
    { icon: Clock, label: formatDuration(course.durationMinutes) },
    { icon: ListVideo, label: `${course.lessonCount} lessons` },
  ];

  return (
    <>
      <section className="bg-black text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="space-y-4 lg:col-span-2">
            <nav aria-label="Breadcrumb" className="text-sm text-gray-300">
              <Link href="/explore" className="hover:text-brand">
                Courses
              </Link>
              {' / '}
              <Link href={`/explore?category=${course.categorySlug}`} className="hover:text-brand">
                {course.category.name}
              </Link>
            </nav>
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

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div className="space-y-12 lg:col-span-2">
          <section className="border border-gray-300 p-6">
            <h2 className="text-2xl font-bold">What you&apos;ll learn</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {course.outcomes.map((outcome) => (
                <li key={outcome} className="flex gap-3">
                  <Check className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                  {outcome}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold">Course content</h2>
            <p className="mt-1 text-sm text-gray-600">
              {course.sections.length} sections · {course.lessonCount} lessons ·{' '}
              {formatDuration(course.durationMinutes)} total
            </p>
            <ol className="mt-4 divide-y divide-gray-300 border border-gray-300">
              {course.sections.map((section, index) => (
                <li key={section.title} className="flex items-center justify-between gap-4 p-4">
                  <span className="font-semibold">
                    <span className="text-gray-500">{index + 1}.</span> {section.title}
                  </span>
                  <span className="shrink-0 text-sm text-gray-600">
                    {section.lessonCount} lessons · {formatDuration(section.durationMinutes)}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-bold">Description</h2>
            <p className="mt-4 text-gray-700">{course.description}</p>
          </section>
        </div>

        <aside className="lg:-mt-48">
          <div className="bg-white shadow-lg lg:sticky lg:top-6">
            <CourseCover categorySlug={course.categorySlug} />
            <div className="space-y-4 p-6">
              {course.priceUsd !== null && (
                <p className="text-3xl font-extrabold">{formatPrice(course.priceUsd)}</p>
              )}
              <Link href={`/sign-up?next=/courses/${course.slug}`} className="btn-brand w-full">
                Enroll Now
              </Link>
              <p className="text-center text-sm text-gray-600">
                Or access every course with a{' '}
                <Link href="/plans-and-pricing" className="font-semibold underline">
                  subscription plan
                </Link>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

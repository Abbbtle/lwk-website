import { Check } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Curriculum } from '@/app/instructor/courses/[id]/curriculum';
import { AiCourseReviewCard } from '@/components/ai-course-review-card';
import { CourseCover } from '@/components/course-cover';
import { StatusBadge } from '@/components/status-badge';
import { levelOptions } from '@/lib/forms/course';
import {
  type CoursePricing,
  coursePrice,
  coursePricing,
  courseTierTitle,
  formatMoney,
  PRICE_REGIONS,
  regionName,
} from '@/lib/pricing';
import { aiConfig } from '@/server/ai/config';
import { requireRole } from '@/server/auth/session';
import { AuthoringError, getCourseForEditing, reviewChecklist } from '@/server/authoring';
import { signedMediaUrl } from '@/server/media';
import { AdminHeading, AdminNav } from '../../admin-nav';
import { CourseDecisionForm } from './course-decision-form';

export const metadata: Metadata = { title: 'Review course', robots: { index: false } };

/** Whether the course is free, its tier with the price in each region, or that it has no price. */
function CoursePriceNote({ pricing }: { pricing: CoursePricing }): ReactElement {
  switch (pricing.kind) {
    case 'free':
      return (
        <p className="border-l-4 border-brand bg-orange-50 p-3 text-sm">
          The instructor offers this course <strong>for free</strong>: once published it is listed
          in Explore and stays free for everyone.
        </p>
      );
    case 'tier':
      return (
        <div className="border-l-4 border-gray-400 bg-white p-3 text-sm">
          <p>
            Price: <strong>{courseTierTitle(pricing.tier)}</strong>
          </p>
          <ul className="mt-1 grid gap-x-6 sm:grid-cols-2">
            {PRICE_REGIONS.map((region) => (
              <li key={region}>
                {regionName(region)}: {formatMoney(coursePrice(pricing.tier, region))}
              </li>
            ))}
          </ul>
        </div>
      );
    case 'unpriced':
      return (
        <p className="border-l-4 border-gray-400 bg-white p-3 text-sm">
          No price has been chosen yet.
        </p>
      );
  }
}

export default async function ReviewCoursePage({ params }: PageProps<'/admin/courses/[id]'>) {
  const { id } = await params;
  const session = await requireRole('admin', `/admin/courses/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const course = await getCourseForEditing(session, id).catch((error) => {
    if (error instanceof AuthoringError) notFound();
    throw error;
  });

  const lessonsWithMedia = course.sections.flatMap((s) => s.lessons).filter((l) => l.mediaKey);
  const [coverUrl, mediaUrls] = await Promise.all([
    course.coverKey ? signedMediaUrl(course.coverKey) : null,
    Promise.all(
      lessonsWithMedia.map(async (l) => [l.id, await signedMediaUrl(l.mediaKey!)] as const),
    ).then(Object.fromEntries),
  ]);
  const missing = reviewChecklist(course);

  return (
    <div className="page-width py-12">
      <AdminHeading title="Review course" greeting={session.name} />
      <AdminNav current="/admin/courses" />
      <Link href="/admin/courses" className="text-sm font-semibold hover:text-brand-ink">
        ← All courses
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-extrabold">{course.title}</h2>
              <StatusBadge status={course.status} />
            </div>
            <p className="text-lg text-gray-700">{course.subtitle}</p>
            <p className="text-sm text-gray-600">
              {course.category.name} · {levelOptions.find((l) => l.value === course.level)?.label} ·
              taught by {course.instructorName}
            </p>
            <CoursePriceNote pricing={coursePricing(course)} />
            <p className="whitespace-pre-line">{course.description}</p>
            {course.outcomes.length > 0 && (
              <ul className="grid gap-2 sm:grid-cols-2">
                {course.outcomes.map((outcome) => (
                  <li key={outcome} className="flex gap-2">
                    <Check className="mt-0.5 size-5 shrink-0 text-brand-ink" aria-hidden />
                    {outcome}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="mb-4 text-2xl font-bold">Curriculum</h2>
            <p className="mb-4 text-sm text-gray-600">Open a lesson to watch or read it.</p>
            <Curriculum course={course} locked mediaUrls={mediaUrls} />
          </section>
          {aiConfig().enabled && <AiCourseReviewCard courseId={course.id} />}
        </div>
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <CourseCover
            categorySlug={course.category.slug}
            imageUrl={coverUrl}
            className="rounded-card shadow-md"
          />
          {missing.length > 0 && (
            <div className="border-l-4 border-red-600 bg-red-50 p-4 text-sm">
              <p className="font-semibold">Incomplete</p>
              <ul className="mt-2 list-disc pl-5">
                {missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          <CourseDecisionForm id={course.id} status={course.status} />
          <Link href={`/instructor/courses/${course.id}`} className="block text-sm underline">
            Open in the editor (admins can edit any course)
          </Link>
        </aside>
      </div>
    </div>
  );
}

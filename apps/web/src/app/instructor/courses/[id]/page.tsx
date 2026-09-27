import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { StatusBadge } from '@/components/status-badge';
import { hasRole, requireRole } from '@/server/auth/session';
import { AuthoringError, getCourseForEditing, reviewChecklist } from '@/server/authoring';
import { getCategories } from '@/server/catalog';
import { Curriculum } from './curriculum';
import { DetailsForm } from './details-form';
import { ReviewPanel } from './review-panel';

export const metadata: Metadata = { title: 'Edit course', robots: { index: false } };

export default async function EditCoursePage({ params }: PageProps<'/instructor/courses/[id]'>) {
  const { id } = await params;
  const session = await requireRole('instructor', `/instructor/courses/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();

  const course = await getCourseForEditing(session, id).catch((error) => {
    if (error instanceof AuthoringError) notFound();
    throw error;
  });
  const categories = await getCategories();
  const locked = course.status !== 'DRAFT' && !hasRole(session, 'admin');

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/instructor" className="text-sm font-semibold hover:text-brand">
        ← Instructor dashboard
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold md:text-4xl">{course.title}</h1>
        <StatusBadge status={course.status} />
        {course.status === 'PUBLISHED' && (
          <Link href={`/courses/${course.slug}`} className="text-sm underline">
            View live page
          </Link>
        )}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-3">
        <div className="space-y-12 lg:col-span-2">
          <section>
            <h2 className="mb-4 text-2xl font-bold">Details</h2>
            <DetailsForm
              courseId={course.id}
              locked={locked}
              categories={categories.map((c) => ({ value: c.slug, label: c.name }))}
              values={{
                title: course.title,
                subtitle: course.subtitle,
                description: course.description,
                categorySlug: course.category.slug,
                level: course.level,
                instructorName: course.instructorName,
                outcomes: course.outcomes.join('\n'),
              }}
            />
          </section>
          <section>
            <h2 className="mb-4 text-2xl font-bold">Curriculum</h2>
            <Curriculum course={course} locked={locked} />
          </section>
        </div>
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <ReviewPanel
            courseId={course.id}
            status={course.status}
            missing={reviewChecklist(course)}
            reviewNote={course.reviewNote}
          />
        </aside>
      </div>
    </div>
  );
}

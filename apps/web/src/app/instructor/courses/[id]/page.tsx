import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { MediaUploader } from '@/components/media-uploader';
import { StatusBadge } from '@/components/status-badge';
import { hasRole, requireRole } from '@/server/auth/session';
import { AuthoringError, getCourseForEditing, reviewChecklist } from '@/server/authoring';
import { getCategories } from '@/server/catalog';
import { signedMediaUrl } from '@/server/media';
import { confirmCoverUpload, requestCoverUpload } from '../../actions';
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
  const lessonsWithMedia = course.sections.flatMap((s) => s.lessons).filter((l) => l.mediaKey);
  const [categories, coverUrl, mediaUrls] = await Promise.all([
    getCategories(),
    course.coverKey ? signedMediaUrl(course.coverKey) : undefined,
    Promise.all(
      lessonsWithMedia.map(async (l) => [l.id, await signedMediaUrl(l.mediaKey!)] as const),
    ).then(Object.fromEntries),
  ]);
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
                isFree: course.isFree ? 'on' : '',
              }}
            />
          </section>
          <section>
            <h2 className="mb-4 text-2xl font-bold">Curriculum</h2>
            <Curriculum course={course} locked={locked} mediaUrls={mediaUrls} />
          </section>
        </div>
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div className="space-y-3 border border-gray-300 p-6">
            <h2 className="text-xl font-bold">Cover image</h2>
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed S3 URL
              <img src={coverUrl} alt="" className="aspect-video w-full object-cover" />
            ) : (
              <p className="text-sm text-gray-700">
                Optional. Without one, the category artwork is shown.
              </p>
            )}
            {!locked && (
              <MediaUploader
                kind="cover"
                label={coverUrl ? 'Replace cover' : 'Upload cover'}
                requestUpload={requestCoverUpload.bind(null, course.id)}
                confirmUpload={confirmCoverUpload.bind(null, course.id)}
              />
            )}
          </div>
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

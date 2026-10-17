import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { SampleBadge, TypeBadge } from '@/components/badges';
import { ConfirmAction } from '@/components/confirm-action';
import { MediaUploader } from '@/components/media-uploader';
import { StatusBadge } from '@/components/status-badge';
import { requireRole } from '@/server/auth/session';
import { getCategories } from '@/server/catalog';
import {
  getResourceForEditing,
  mediaKindFor,
  publishChecklist,
  ResourceError,
} from '@/server/resources';
import { AdminHeading, AdminNav } from '../../admin-nav';
import {
  confirmResourceUpload,
  deleteResource,
  requestResourceUpload,
  setPublished,
} from '../actions';
import { ResourceForm } from './resource-form';

export const metadata: Metadata = { title: 'Edit free resource', robots: { index: false } };

const fileLabel = { video: 'video', audio: 'recording', pdf: 'PDF' } as const;

export default async function EditResourcePage({ params }: PageProps<'/admin/explore/[id]'>) {
  const { id } = await params;
  const session = await requireRole('admin', `/admin/explore/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const [resource, categories] = await Promise.all([
    getResourceForEditing(session, id).catch((error) => {
      if (error instanceof ResourceError) notFound();
      throw error;
    }),
    getCategories(),
  ]);
  const kind = mediaKindFor(resource.type);
  const missing = publishChecklist(resource);
  const published = resource.status === 'PUBLISHED';

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <AdminHeading title="Edit free resource" greeting={session.name} />
      <AdminNav current="/admin/explore" />
      <Link
        href="/admin/explore"
        className="mb-6 inline-flex items-center gap-2 text-sm hover:text-brand-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> All free resources
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section className="bg-white p-6 shadow-md">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <TypeBadge type={resource.type} />
              <StatusBadge status={resource.status} />
              {resource.isSample && <SampleBadge />}
            </div>
            <ResourceForm
              resourceId={resource.id}
              type={resource.type}
              categories={categories.map((c) => ({ value: c.slug, label: c.name }))}
              values={{
                title: resource.title,
                summary: resource.summary,
                authorName: resource.authorName,
                categorySlug: resource.category?.slug ?? '',
                body: resource.body,
                durationMinutes: String(Math.round(resource.durationSeconds / 60)),
              }}
            />
          </section>

          {kind && (
            <section className="space-y-4 bg-white p-6 shadow-md">
              <h2 className="text-xl font-bold">The {fileLabel[kind]}</h2>
              {resource.mediaUrl ? (
                kind === 'video' ? (
                  <video
                    controls
                    preload="metadata"
                    src={resource.mediaUrl}
                    className="aspect-video w-full bg-black"
                  />
                ) : kind === 'audio' ? (
                  <audio controls preload="metadata" src={resource.mediaUrl} className="w-full" />
                ) : (
                  <a
                    href={resource.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-semibold underline"
                  >
                    Open the uploaded PDF <ExternalLink className="size-4" aria-hidden />
                  </a>
                )
              ) : (
                <p className="text-sm text-gray-600">Nothing uploaded yet.</p>
              )}
              <MediaUploader
                kind={kind}
                label={
                  resource.mediaUrl
                    ? `Replace the ${fileLabel[kind]}`
                    : `Upload the ${fileLabel[kind]}`
                }
                requestUpload={requestResourceUpload.bind(null, resource.id, 'media')}
                confirmUpload={confirmResourceUpload.bind(null, resource.id, 'media')}
              />
            </section>
          )}

          <section className="space-y-4 bg-white p-6 shadow-md">
            <h2 className="text-xl font-bold">Cover image</h2>
            <p className="text-sm text-gray-600">
              Optional. Without one, the category photo is used.
            </p>
            {resource.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed S3 URL
              <img
                src={resource.coverUrl}
                alt=""
                className="aspect-video w-full max-w-md object-cover"
              />
            )}
            <MediaUploader
              kind="cover"
              label={resource.coverUrl ? 'Replace the cover' : 'Upload a cover'}
              requestUpload={requestResourceUpload.bind(null, resource.id, 'cover')}
              confirmUpload={confirmResourceUpload.bind(null, resource.id, 'cover')}
            />
          </section>
        </div>

        <aside className="space-y-8">
          <section className="space-y-4 bg-white p-6 shadow-md">
            <h2 className="text-xl font-bold">Publishing</h2>
            {published ? (
              <>
                <p className="text-sm text-gray-700">Live in Explore for everyone.</p>
                <Link
                  href={`/explore/${resource.slug}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold underline"
                >
                  View in Explore <ExternalLink className="size-4" aria-hidden />
                </Link>
                <ConfirmAction
                  label="Unpublish"
                  question="Take this out of Explore? You can publish it again later."
                  confirmLabel="Unpublish"
                  action={setPublished.bind(null, resource.id, false)}
                />
              </>
            ) : missing.length > 0 ? (
              <>
                <p className="text-sm text-gray-700">Before publishing:</p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : (
              <ConfirmAction
                label="Publish to Explore"
                question="Publish this for everyone? It appears in Explore straight away."
                confirmLabel="Publish"
                action={setPublished.bind(null, resource.id, true)}
              />
            )}
          </section>

          <section className="space-y-4 bg-white p-6 shadow-md">
            <h2 className="text-xl font-bold">Delete</h2>
            <ConfirmAction
              label="Delete this resource"
              question="Delete this resource and its files for good?"
              confirmLabel="Delete"
              tone="danger"
              action={deleteResource.bind(null, resource.id)}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}

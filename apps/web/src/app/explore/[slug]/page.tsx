import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { FreeBadge, resourceTypes, SampleBadge, TypeBadge } from '@/components/badges';
import { ResourceGrid } from '@/components/resource-card';
import { RichText } from '@/components/rich-text';
import { formatDuration, joinParts } from '@/lib/format';
import { getPublishedResource, relatedResources } from '@/server/resources';

// Metadata and page share one query per request.
const loadResource = cache(getPublishedResource);

export async function generateMetadata({
  params,
}: PageProps<'/explore/[slug]'>): Promise<Metadata> {
  const resource = await loadResource((await params).slug);
  if (!resource) return {};
  return {
    title: resource.title,
    description: resource.summary,
    openGraph: { title: resource.title, description: resource.summary, type: 'article' },
  };
}

export default async function ResourcePage({ params }: PageProps<'/explore/[slug]'>) {
  const resource = await loadResource((await params).slug);
  if (!resource) notFound();
  const related = await relatedResources(resource);
  const { unit } = resourceTypes[resource.type];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-gray-600">
        <Link href="/explore" className="hover:text-brand-ink">
          Explore
        </Link>
        {resource.categorySlug && (
          <>
            {' / '}
            <Link
              href={`/explore?category=${resource.categorySlug}`}
              className="hover:text-brand-ink"
            >
              {resource.categoryName}
            </Link>
          </>
        )}
      </nav>

      <header className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <TypeBadge type={resource.type} />
          <FreeBadge />
          {resource.isSample && <SampleBadge />}
        </div>
        <h1 className="text-3xl font-extrabold md:text-5xl">{resource.title}</h1>
        <p className="text-lg text-gray-700">{resource.summary}</p>
        <p className="text-sm text-gray-600">
          {joinParts([
            resource.authorName,
            resource.minutes > 0 && `${formatDuration(resource.minutes)} ${unit}`,
            resource.publishedAt?.toLocaleDateString('en-GB', { dateStyle: 'long' }),
          ])}
        </p>
      </header>

      {resource.isSample && (
        <p className="mt-6 border-l-4 border-gray-400 bg-white p-4 text-sm text-gray-700">
          This is sample content used to test the platform. It will be replaced by teachings from
          our instructors.
        </p>
      )}

      <div className="mt-8">
        {resource.type === 'VIDEO' &&
          (resource.mediaUrl ? (
            <video
              controls
              preload="metadata"
              src={resource.mediaUrl}
              className="aspect-video w-full bg-black"
            />
          ) : (
            <p className="bg-white p-8 text-center text-gray-700">This video is not available.</p>
          ))}
        {resource.type === 'AUDIO' &&
          (resource.mediaUrl ? (
            <div className="bg-white p-6 shadow-md">
              <audio controls preload="metadata" src={resource.mediaUrl} className="w-full" />
            </div>
          ) : (
            <p className="bg-white p-8 text-center text-gray-700">
              This recording is not available.
            </p>
          ))}
        {resource.type === 'PDF' &&
          (resource.mediaUrl ? (
            <div className="space-y-3">
              <iframe
                src={resource.mediaUrl}
                title={resource.title}
                className="h-[75vh] w-full border border-gray-300 bg-white"
              />
              <a
                href={resource.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold underline"
              >
                Open the PDF in a new tab
              </a>
            </div>
          ) : (
            <p className="bg-white p-8 text-center text-gray-700">
              This document is not available.
            </p>
          ))}
        {resource.type === 'ARTICLE' && (
          <article className="bg-white p-6 shadow-md sm:p-10">
            <RichText text={resource.body} />
          </article>
        )}
        {resource.type !== 'ARTICLE' && resource.body.trim() && (
          <section className="mt-8">
            <h2 className="text-xl font-bold">
              About this {resourceTypes[resource.type].label.toLowerCase()}
            </h2>
            <RichText text={resource.body} className="mt-3" />
          </section>
        )}
      </div>

      {related.length > 0 && (
        <section className="mt-16 space-y-6">
          <h2 className="text-2xl font-extrabold">More to explore</h2>
          <ResourceGrid resources={related} />
        </section>
      )}

      <section className="mt-16 flex flex-col items-start gap-4 bg-black p-8 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Want to go deeper?</h2>
          <p className="text-gray-300">
            Full courses guide you step by step and track your progress.
          </p>
        </div>
        <Link href="/courses" className="btn-brand shrink-0">
          Browse courses <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>
    </div>
  );
}

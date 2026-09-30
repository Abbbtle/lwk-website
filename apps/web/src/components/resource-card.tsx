import Link from 'next/link';
import { FreeBadge, resourceTypes, SampleBadge, TypeBadge } from '@/components/badges';
import { CourseCover } from '@/components/course-cover';
import { formatDuration, joinParts } from '@/lib/format';
import type { ResourceSummary } from '@/server/resources';

/** Card for a free video, recording, article or PDF in Explore. */
export function ResourceCard({ resource }: { resource: ResourceSummary }) {
  const { unit } = resourceTypes[resource.type];
  return (
    <article className="group relative flex flex-col bg-white shadow-md transition-shadow duration-300 hover:shadow-xl">
      <div className="relative">
        <CourseCover categorySlug={resource.categorySlug ?? ''} imageUrl={resource.coverUrl} />
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <TypeBadge type={resource.type} />
          <FreeBadge />
          {resource.isSample && <SampleBadge />}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <h3 className="text-lg leading-snug font-semibold">
          <Link
            href={`/explore/${resource.slug}`}
            className="after:absolute after:inset-0 group-hover:text-brand"
          >
            {resource.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-gray-600">{resource.summary}</p>
        <p className="mt-auto pt-3 text-xs text-gray-500">
          {joinParts([
            resource.authorName,
            resource.categoryName,
            resource.minutes > 0 && `${formatDuration(resource.minutes)} ${unit}`,
          ])}
        </p>
      </div>
    </article>
  );
}

export function ResourceGrid({ resources }: { resources: ResourceSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {resources.map((resource) => (
        <ResourceCard key={resource.slug} resource={resource} />
      ))}
    </div>
  );
}

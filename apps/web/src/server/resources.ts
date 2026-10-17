import 'server-only';
import type { Prisma, ResourceType } from '@/generated/prisma/client';
import { readingMinutes } from '@/lib/format';
import type { NewResourceInput, ResourceDetailsInput } from '@/lib/forms/resource';
import { recordAudit } from './audit';
import { hasRole, type Session } from './auth/session';
import { slugify } from './authoring';
import { getDb } from './db';
import {
  createUpload,
  deleteMedia,
  signedMediaUrl,
  type UploadTicket,
  verifyUpload,
} from './media';

// Free resources for Explore: single videos, recordings, articles and PDFs. Anyone can view the
// published ones; only admins manage them.

export class ResourceError extends Error {
  constructor(
    readonly code: 'not_found' | 'forbidden' | 'incomplete' | 'invalid',
    message: string,
  ) {
    super(message);
  }
}

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  VIDEO: 'Video',
  AUDIO: 'Audio',
  ARTICLE: 'Article',
  PDF: 'PDF',
};

// Signed media links for viewers last long enough to finish a long talk.
const VIEW_LINK_SECONDS = 3 * 60 * 60;

const publicInclude = { category: true } satisfies Prisma.ResourceInclude;
type ResourceRow = Prisma.ResourceGetPayload<{ include: typeof publicInclude }>;

export type ResourceSummary = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: ResourceType;
  authorName: string;
  /** Length of a video or recording, or reading time of an article, in minutes. */
  minutes: number;
  categorySlug: string | null;
  categoryName: string | null;
  coverUrl: string | null;
  publishedAt: Date | null;
  isSample: boolean;
};

async function toSummary(row: ResourceRow): Promise<ResourceSummary> {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    type: row.type,
    authorName: row.authorName,
    minutes:
      row.type === 'ARTICLE' ? readingMinutes(row.body) : Math.round(row.durationSeconds / 60),
    categorySlug: row.category?.slug ?? null,
    categoryName: row.category?.name ?? null,
    coverUrl: row.coverKey ? await signedMediaUrl(row.coverKey) : null,
    publishedAt: row.publishedAt,
    isSample: row.isSample,
  };
}

/** Every search term must match the title, summary or author (case-insensitive). */
export async function listPublishedResources({
  types,
  category,
  query,
  take = 60,
}: {
  types?: ResourceType[];
  category?: string;
  query?: string;
  take?: number;
} = {}): Promise<ResourceSummary[]> {
  const terms = (query ?? '').split(/\s+/).filter(Boolean).slice(0, 10);
  const rows = await getDb().resource.findMany({
    where: {
      status: 'PUBLISHED',
      ...(types && { type: { in: types } }),
      ...(category && { category: { slug: category } }),
      AND: terms.map((term) => ({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { summary: { contains: term, mode: 'insensitive' } },
          { authorName: { contains: term, mode: 'insensitive' } },
        ],
      })),
    },
    include: publicInclude,
    orderBy: [{ publishedAt: 'desc' }, { title: 'asc' }],
    take,
  });
  return Promise.all(rows.map(toSummary));
}

export async function getPublishedResource(slug: string) {
  const row = await getDb().resource.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: publicInclude,
  });
  if (!row) return null;
  return {
    ...(await toSummary(row)),
    body: row.body,
    mediaUrl: row.mediaKey ? await signedMediaUrl(row.mediaKey, VIEW_LINK_SECONDS) : null,
  };
}

/** More from the same category (or of the same type), for the end of a resource page. */
export async function relatedResources(resource: ResourceSummary, take = 3) {
  const rows = await getDb().resource.findMany({
    where: {
      status: 'PUBLISHED',
      id: { not: resource.id },
      ...(resource.categorySlug
        ? { category: { slug: resource.categorySlug } }
        : { type: resource.type }),
    },
    include: publicInclude,
    orderBy: { publishedAt: 'desc' },
    take,
  });
  return Promise.all(rows.map(toSummary));
}

// ---- Admin ------------------------------------------------------------------------------------

function assertAdmin(session: Session) {
  if (!hasRole(session, 'admin')) throw new ResourceError('forbidden', 'Admins only.');
}

const actorOf = (session: Session) => ({ userId: session.userId, name: session.name });
const mediaPrefix = (id: string) => `resources/${id}/media/`;
const coverPrefix = (id: string) => `resources/${id}/cover/`;

export function mediaKindFor(type: ResourceType) {
  switch (type) {
    case 'VIDEO':
      return 'video' as const;
    case 'AUDIO':
      return 'audio' as const;
    case 'PDF':
      return 'pdf' as const;
    case 'ARTICLE':
      return null;
  }
}

export async function listAllResources(session: Session) {
  assertAdmin(session);
  return getDb().resource.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { category: true },
  });
}

async function loadResource(session: Session, id: string) {
  assertAdmin(session);
  const resource = await getDb().resource.findUnique({ where: { id }, include: publicInclude });
  if (!resource) throw new ResourceError('not_found', 'Resource not found.');
  return resource;
}

export async function getResourceForEditing(session: Session, id: string) {
  const resource = await loadResource(session, id);
  return {
    ...resource,
    mediaUrl: resource.mediaKey ? await signedMediaUrl(resource.mediaKey) : null,
    coverUrl: resource.coverKey ? await signedMediaUrl(resource.coverKey) : null,
  };
}

async function uniqueSlug(title: string, exceptId?: string) {
  const base = slugify(title);
  const taken = new Set(
    (
      await getDb().resource.findMany({
        where: { slug: { startsWith: base }, NOT: exceptId ? { id: exceptId } : {} },
        select: { slug: true },
      })
    ).map((r) => r.slug),
  );
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

async function categoryIdFor(slug?: string) {
  if (!slug) return null;
  const category = await getDb().category.findUnique({ where: { slug } });
  if (!category) throw new ResourceError('invalid', 'Category not found.');
  return category.id;
}

export async function createResource(session: Session, input: NewResourceInput) {
  assertAdmin(session);
  const resource = await getDb().resource.create({
    data: {
      title: input.title,
      slug: await uniqueSlug(input.title),
      type: input.type,
      summary: '',
      authorName: session.name,
      createdById: session.userId,
    },
  });
  await recordAudit(actorOf(session), {
    action: 'resource.created',
    target: { type: 'resource', id: resource.id },
    summary: `Started the free resource "${resource.title}"`,
  });
  return resource;
}

export async function updateResource(session: Session, id: string, input: ResourceDetailsInput) {
  const resource = await loadResource(session, id);
  await getDb().resource.update({
    where: { id },
    data: {
      title: input.title,
      // Links stay stable once a resource has been published.
      ...(resource.publishedAt === null && { slug: await uniqueSlug(input.title, id) }),
      summary: input.summary,
      authorName: input.authorName,
      categoryId: await categoryIdFor(input.categorySlug),
      body: input.body ?? '',
      // Uploads set the length of videos and recordings; it can be corrected here.
      ...(resource.type !== 'ARTICLE' && { durationSeconds: input.durationMinutes * 60 }),
    },
  });
}

/** What is missing before a resource can be published. Empty when ready. */
export function publishChecklist(resource: {
  type: ResourceType;
  summary: string;
  body: string;
  mediaKey: string | null;
}): string[] {
  const missing: string[] = [];
  if (!resource.summary.trim()) missing.push('Add a summary.');
  if (resource.type === 'ARTICLE' && !resource.body.trim()) missing.push('Write the article.');
  if (resource.type !== 'ARTICLE' && !resource.mediaKey) {
    const kind = { VIDEO: 'video', AUDIO: 'recording', PDF: 'PDF' }[resource.type];
    missing.push(`Upload the ${kind}.`);
  }
  return missing;
}

export async function setResourcePublished(session: Session, id: string, published: boolean) {
  const resource = await loadResource(session, id);
  if (published) {
    const missing = publishChecklist(resource);
    if (missing.length > 0) throw new ResourceError('incomplete', missing.join(' '));
  }
  await getDb().resource.update({
    where: { id },
    data: published
      ? { status: 'PUBLISHED', publishedAt: resource.publishedAt ?? new Date() }
      : { status: 'DRAFT' },
  });
  await recordAudit(actorOf(session), {
    action: published ? 'resource.published' : 'resource.unpublished',
    target: { type: 'resource', id },
    summary: `${published ? 'Published' : 'Unpublished'} the free resource "${resource.title}"`,
  });
}

export async function deleteResource(session: Session, id: string) {
  const resource = await loadResource(session, id);
  await getDb().resource.delete({ where: { id } });
  await Promise.all([deleteMedia(resource.mediaKey), deleteMedia(resource.coverKey)]);
  await recordAudit(actorOf(session), {
    action: 'resource.deleted',
    target: { type: 'resource', id },
    summary: `Deleted the free resource "${resource.title}"`,
  });
}

export type ResourceFile = 'media' | 'cover';

export async function startResourceUpload(
  session: Session,
  id: string,
  file: ResourceFile,
  info: { contentType: string; size: number },
): Promise<UploadTicket> {
  const resource = await loadResource(session, id);
  if (file === 'cover') return createUpload(coverPrefix(id), 'cover', info.contentType, info.size);
  const kind = mediaKindFor(resource.type);
  if (!kind) throw new ResourceError('invalid', 'Articles do not have a file.');
  return createUpload(mediaPrefix(id), kind, info.contentType, info.size);
}

/** Attach a finished upload, replacing (and deleting) the previous file. */
export async function attachResourceFile(
  session: Session,
  id: string,
  file: ResourceFile,
  key: string,
  durationSeconds?: number,
) {
  const resource = await loadResource(session, id);
  if (file === 'cover') {
    await verifyUpload(key, coverPrefix(id), 'cover');
    await getDb().resource.update({ where: { id }, data: { coverKey: key } });
    if (resource.coverKey && resource.coverKey !== key) await deleteMedia(resource.coverKey);
    return;
  }
  const kind = mediaKindFor(resource.type);
  if (!kind) throw new ResourceError('invalid', 'Articles do not have a file.');
  await verifyUpload(key, mediaPrefix(id), kind);
  await getDb().resource.update({
    where: { id },
    data: {
      mediaKey: key,
      ...(durationSeconds !== undefined && { durationSeconds: Math.round(durationSeconds) }),
    },
  });
  if (resource.mediaKey && resource.mediaKey !== key) await deleteMedia(resource.mediaKey);
}

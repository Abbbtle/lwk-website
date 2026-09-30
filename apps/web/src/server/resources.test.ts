import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { testSession } from '../../test/sessions';
import type { Role } from './auth/session';
import { searchCourses } from './catalog';
import { getDb } from './db';
import {
  attachResourceFile,
  createResource,
  deleteResource,
  getPublishedResource,
  listPublishedResources,
  ResourceError,
  setResourcePublished,
  startResourceUpload,
  updateResource,
} from './resources';
import { loadSampleContent, removeSampleContent, sampleContentStatus } from './sample-content';

// S3 stand-in: uploads always "exist" and links are fake.
const media = vi.hoisted(() => ({
  createUpload: vi.fn(async (prefix: string) => ({
    url: 'https://s3',
    fields: {},
    key: `${prefix}file`,
  })),
  verifyUpload: vi.fn(async () => {}),
  deleteMedia: vi.fn(async () => {}),
  signedMediaUrl: vi.fn(async (key: string) => `https://signed/${key}`),
}));
vi.mock('./media', () => media);

afterAll(async () => {
  await getDb().resource.deleteMany({});
  await getDb().$disconnect();
});

async function person(roles: Role[] = []) {
  const user = await getDb().user.create({
    data: {
      id: randomUUID(),
      email: `${randomUUID()}@example.org`,
      name: 'Admin Person',
      roles,
      lastSignInAt: new Date(),
    },
  });
  return testSession(user, roles);
}

const details = {
  title: 'Japa in the morning',
  summary: 'Why many devotees chant early.',
  authorName: 'A Teacher',
  categorySlug: 'kirtan',
  body: 'Early morning is quiet.\n\n## Why\n\nFewer distractions.',
  durationMinutes: 0,
};

describe('free resources', () => {
  it('are drafts until published, and published ones are public and searchable', async () => {
    const admin = await person(['admin']);
    const created = await createResource(admin, { title: 'Japa in the morning', type: 'ARTICLE' });
    expect(created.status).toBe('DRAFT');
    expect(await getPublishedResource(created.slug)).toBeNull();

    await expect(setResourcePublished(admin, created.id, true)).rejects.toMatchObject({
      code: 'incomplete',
    });
    await updateResource(admin, created.id, details);
    await setResourcePublished(admin, created.id, true);

    const published = await getPublishedResource(created.slug);
    expect(published).toMatchObject({ title: 'Japa in the morning', type: 'ARTICLE', minutes: 1 });
    expect((await listPublishedResources({ query: 'japa morning' })).map((r) => r.id)).toContain(
      created.id,
    );
    expect(await listPublishedResources({ category: 'prasadam', query: 'japa' })).toHaveLength(0);
    expect(await listPublishedResources({ types: ['VIDEO'], query: 'japa' })).toHaveLength(0);

    await setResourcePublished(admin, created.id, false);
    expect(await getPublishedResource(created.slug)).toBeNull();
    expect(
      await getDb().auditEvent.count({
        where: { targetId: created.id, action: { startsWith: 'resource.' } },
      }),
    ).toBe(3);
  });

  it('keeps the link stable once published', async () => {
    const admin = await person(['admin']);
    const created = await createResource(admin, { title: 'Stable link', type: 'ARTICLE' });
    await updateResource(admin, created.id, { ...details, title: 'Stable link' });
    await setResourcePublished(admin, created.id, true);
    await updateResource(admin, created.id, { ...details, title: 'A new title' });
    const row = await getDb().resource.findUniqueOrThrow({ where: { id: created.id } });
    expect(row).toMatchObject({ slug: 'stable-link', title: 'A new title' });
  });

  it('needs the uploaded file before a video can be published', async () => {
    const admin = await person(['admin']);
    const video = await createResource(admin, { title: 'Evening arati', type: 'VIDEO' });
    await updateResource(admin, video.id, { ...details, title: 'Evening arati' });
    await expect(setResourcePublished(admin, video.id, true)).rejects.toThrow('Upload the video');

    const ticket = await startResourceUpload(admin, video.id, 'media', {
      contentType: 'video/mp4',
      size: 1000,
    });
    expect(ticket.key.startsWith(`resources/${video.id}/media/`)).toBe(true);
    await attachResourceFile(admin, video.id, 'media', ticket.key, 125.4);
    await setResourcePublished(admin, video.id, true);

    const published = await getPublishedResource(video.slug);
    expect(published).toMatchObject({ minutes: 2, mediaUrl: `https://signed/${ticket.key}` });

    await deleteResource(admin, video.id);
    expect(media.deleteMedia).toHaveBeenCalledWith(ticket.key);
    expect(await getDb().resource.findUnique({ where: { id: video.id } })).toBeNull();
  });

  it('can only be managed by admins', async () => {
    const instructor = await person(['instructor']);
    await expect(
      createResource(instructor, { title: 'Not allowed', type: 'ARTICLE' }),
    ).rejects.toBeInstanceOf(ResourceError);
  });
});

describe('sample content', () => {
  it('loads labelled samples (twice without duplicates) and removes them in one step', async () => {
    const admin = await person(['admin']);
    await loadSampleContent(admin);
    await loadSampleContent(admin);
    expect(await sampleContentStatus()).toEqual({ courses: 4, resources: 4 });

    const free = await searchCourses({ free: true });
    const samples = free.filter((c) => c.isSample);
    expect(samples.map((c) => c.title).sort()).toEqual([
      'Kirtan Basics',
      'Temple Etiquette for Newcomers',
    ]);
    expect(samples.every((c) => c.instructor === 'LWK Team')).toBe(true);
    const articles = await listPublishedResources({ types: ['ARTICLE'] });
    expect(articles.filter((r) => r.isSample)).toHaveLength(4);

    expect(await removeSampleContent(admin)).toEqual({ courses: 4, resources: 4 });
    expect(await sampleContentStatus()).toEqual({ courses: 0, resources: 0 });
  });

  it('is refused for non-admins and when turned off', async () => {
    const learner = await person();
    await expect(loadSampleContent(learner)).rejects.toThrow('Admins only');
    const admin = await person(['admin']);
    vi.stubEnv('SAMPLE_CONTENT', 'off');
    await expect(loadSampleContent(admin)).rejects.toThrow('turned off');
    vi.unstubAllEnvs();
  });
});

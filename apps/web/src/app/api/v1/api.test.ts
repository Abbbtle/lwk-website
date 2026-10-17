import { afterAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/server/db';
import { GET as getCategories } from './categories/route';
import { GET as getCourse } from './courses/[slug]/route';
import { GET as getCourses } from './courses/route';
import { GET as getHealth } from './health/route';

// There is no incoming request in tests, so `connection()` has nothing to wait for.
vi.mock('next/server', () => ({ connection: async () => {} }));

afterAll(async () => {
  await getDb().$disconnect();
});

const url = (path: string) => `http://localhost/api/v1${path}`;
const courseContext = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe('GET /api/v1/health', () => {
  it('reports the database as reachable', async () => {
    const response = await getHealth();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).data).toMatchObject({ status: 'ok', database: 'ok' });
  });
});

describe('GET /api/v1/categories', () => {
  it('returns categories with course counts and a public cache header', async () => {
    const response = await getCategories();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('public');
    const { data } = await response.json();
    expect(data).toHaveLength(4);
    expect(data[0]).toMatchObject({ slug: 'kirtan', courseCount: 5 });
  });
});

describe('GET /api/v1/courses', () => {
  it('searches and filters courses', async () => {
    const response = await getCourses(new Request(url('/courses?q=gita&category=sastra-study')));
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.map((c: { slug: string }) => c.slug)).toEqual(['bhagavad-gita-deep-dive']);
  });

  it('rejects an invalid category parameter', async () => {
    const response = await getCourses(new Request(url('/courses?category=Not%20A%20Slug')));
    expect(response.status).toBe(400);
    const { error } = await response.json();
    expect(error.code).toBe('bad_request');
    expect(error.message).toContain('category');
  });

  it('rejects an overly long search query', async () => {
    const response = await getCourses(new Request(url(`/courses?q=${'a'.repeat(101)}`)));
    expect(response.status).toBe(400);
  });
});

describe('GET /api/v1/courses/:slug', () => {
  it('returns a published course', async () => {
    const response = await getCourse(
      new Request(url('/courses/kirtan-basics')),
      courseContext('kirtan-basics'),
    );
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data).toMatchObject({ slug: 'kirtan-basics', lessonCount: 15, priceUsd: 30 });
  });

  it('returns 404 in the error envelope for an unknown course', async () => {
    const response = await getCourse(
      new Request(url('/courses/missing')),
      courseContext('missing'),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'not_found', message: 'No published course "missing".' },
    });
  });
});

import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { helpArticles } from '@/content/help';
import { getDb } from '@/server/db';

// Public pages for search engines: the main pages, every published course and free resource,
// and the help centre. Built per request from the database.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const [courses, resources] = await Promise.all([
    getDb().course.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
    }),
    getDb().resource.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
    }),
  ]);
  const pages = [
    '',
    '/explore',
    '/courses',
    '/categories',
    '/plans-and-pricing',
    '/become-an-instructor',
    '/our-mission',
    '/contact',
    '/help',
  ];
  return [
    ...pages.map((path) => ({ url: `${base}${path}`, changeFrequency: 'weekly' as const })),
    ...courses.map((c) => ({ url: `${base}/courses/${c.slug}`, lastModified: c.updatedAt })),
    ...resources.map((r) => ({ url: `${base}/explore/${r.slug}`, lastModified: r.updatedAt })),
    ...helpArticles
      .filter((a) => a.audience !== 'staff')
      .map((a) => ({ url: `${base}/help/${a.slug}`, changeFrequency: 'monthly' as const })),
  ];
}

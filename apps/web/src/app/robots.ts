import type { MetadataRoute } from 'next';
import { connection } from 'next/server';

// Search engines may index public pages, not accounts, dashboards or APIs.
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/account',
        '/admin',
        '/api/',
        '/auth/',
        '/instructor',
        '/learn/',
        '/my-learning',
        '/notifications',
        '/support',
        '/logged-out',
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

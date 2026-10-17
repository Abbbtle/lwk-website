import { z } from 'zod';
import type { HelpArticle } from '@/content/help';
import { articlesForPath, popularArticles, searchHelp } from '@/lib/help';
import { handleErrors, ok, parseQuery } from '@/server/api';
import { getSession, hasRole } from '@/server/auth/session';

const querySchema = z.object({
  q: z.string().trim().max(200).optional(),
  path: z.string().max(300).startsWith('/').optional(),
});

const summary = ({ slug, title, summary }: HelpArticle) => ({ slug, title, summary });

// Help articles for the help panel: ones about the current page, search results, popular ones.
export const GET = handleErrors(async (request: Request) => {
  const parsed = parseQuery(querySchema, request.url);
  if ('response' in parsed) return parsed.response;
  const session = await getSession();
  const viewer = { staff: Boolean(session && hasRole(session, 'support')) };
  const { q, path } = parsed.data;
  return ok({
    forPage: path ? articlesForPath(path, viewer).map(summary) : [],
    results: q ? searchHelp(q, viewer).map(summary) : [],
    popular: popularArticles(viewer).map(summary),
  });
});

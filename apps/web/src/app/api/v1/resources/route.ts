import { z } from 'zod';
import { handleErrors, ok, parseQuery, PUBLIC_CACHE } from '@/server/api';
import { searchCourses } from '@/server/catalog';
import { listPublishedResources } from '@/server/resources';

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z
    .string()
    .regex(/^[a-z0-9-]{1,60}$/, 'must be a category slug')
    .optional(),
  type: z.enum(['VIDEO', 'AUDIO', 'ARTICLE', 'PDF']).optional(),
});

// Explore: published free resources, plus the free courses when no type is asked for.
export const GET = handleErrors(async (request: Request) => {
  const parsed = parseQuery(querySchema, request.url);
  if ('response' in parsed) return parsed.response;
  const { q, category, type } = parsed.data;
  const [resources, freeCourses] = await Promise.all([
    listPublishedResources({ query: q, category, types: type && [type] }),
    type ? [] : searchCourses({ query: q, category, free: true }),
  ]);
  return ok({ resources, freeCourses }, { cacheControl: PUBLIC_CACHE });
});

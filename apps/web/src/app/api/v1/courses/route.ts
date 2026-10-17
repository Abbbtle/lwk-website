import { z } from 'zod';
import { handleErrors, ok, parseQuery, PUBLIC_CACHE } from '@/server/api';
import { searchCourses } from '@/server/catalog';

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z
    .string()
    .regex(/^[a-z0-9-]{1,60}$/, 'must be a category slug')
    .optional(),
});

export const GET = handleErrors(async (request: Request) => {
  const parsed = parseQuery(querySchema, request.url);
  if ('response' in parsed) return parsed.response;
  const { q, category } = parsed.data;
  return ok(await searchCourses({ query: q, category }), { cacheControl: PUBLIC_CACHE });
});

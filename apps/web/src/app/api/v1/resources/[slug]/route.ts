import { fail, handleErrors, ok, PUBLIC_CACHE } from '@/server/api';
import { getPublishedResource } from '@/server/resources';

export const GET = handleErrors(
  async (_request: Request, context: RouteContext<'/api/v1/resources/[slug]'>) => {
    const { slug } = await context.params;
    const resource = await getPublishedResource(slug);
    if (!resource) return fail(404, 'not_found', `No published resource "${slug}".`);
    return ok(resource, { cacheControl: PUBLIC_CACHE });
  },
);

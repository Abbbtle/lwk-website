import { fail, handleErrors, ok, PUBLIC_CACHE } from '@/server/api';
import { getCourse } from '@/server/catalog';

export const GET = handleErrors(
  async (_request: Request, context: RouteContext<'/api/v1/courses/[slug]'>) => {
    const { slug } = await context.params;
    const course = await getCourse(slug);
    if (!course) return fail(404, 'not_found', `No published course "${slug}".`);
    return ok(course, { cacheControl: PUBLIC_CACHE });
  },
);

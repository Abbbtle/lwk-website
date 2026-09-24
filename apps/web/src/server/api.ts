import 'server-only';
import { z } from 'zod';

// Response envelope for /api/v1: `{ data }` on success, `{ error: { code, message } }` on failure.

export type ApiErrorCode = 'bad_request' | 'not_found' | 'internal_error' | 'unavailable';

/** Catalog responses may be cached briefly by CloudFront and browsers. */
export const PUBLIC_CACHE = 'public, max-age=60, s-maxage=60, stale-while-revalidate=300';

export function ok<T>(data: T, init?: { cacheControl?: string }): Response {
  return Response.json(
    { data },
    { headers: { 'Cache-Control': init?.cacheControl ?? 'no-store' } },
  );
}

export function fail(status: number, code: ApiErrorCode, message: string): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Validate query parameters; returns the parsed values or a 400 response. */
export function parseQuery<T extends z.ZodType>(
  schema: T,
  url: string,
): { data: z.infer<T> } | { response: Response } {
  const params = Object.fromEntries(new URL(url).searchParams);
  const result = schema.safeParse(params);
  if (result.success) return { data: result.data };
  const issue = result.error.issues[0];
  const field = issue.path.join('.') || 'query';
  return { response: fail(400, 'bad_request', `${field}: ${issue.message}`) };
}

/** Log unexpected errors and answer with a generic 500 instead of leaking details. */
export function handleErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error('Unhandled API error', error);
      return fail(500, 'internal_error', 'Something went wrong.');
    }
  };
}

import { connection } from 'next/server';
import { handleErrors, ok, PUBLIC_CACHE } from '@/server/api';
import { getCategories } from '@/server/catalog';

export const GET = handleErrors(async () => {
  await connection();
  return ok(await getCategories(), { cacheControl: PUBLIC_CACHE });
});

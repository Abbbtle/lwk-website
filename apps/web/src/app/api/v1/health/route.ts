import { connection } from 'next/server';
import { fail, ok } from '@/server/api';
import { getDb } from '@/server/db';

// Used by monitoring and deploy checks: 200 when the app can reach the database.
export async function GET() {
  await connection();
  try {
    await getDb().$queryRaw`SELECT 1`;
  } catch (error) {
    console.error('Health check: database unreachable', error);
    return fail(503, 'unavailable', 'Database unreachable.');
  }
  return ok({ status: 'ok', database: 'ok', time: new Date().toISOString() });
}

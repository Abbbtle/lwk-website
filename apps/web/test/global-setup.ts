// Brings the test database to the latest schema with fresh seed data before the test run.
import { execSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see apps/web/.env.example).');
  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.includes('test')) {
    throw new Error(`Refusing to run tests against "${dbName}": the name must contain "test".`);
  }

  const env = { ...process.env, DATABASE_URL: url };
  execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await db.$executeRawUnsafe(
      'TRUNCATE TABLE lessons, sections, courses, categories RESTART IDENTITY CASCADE',
    );
  } finally {
    await db.$disconnect();
  }

  execSync('npx prisma db seed', { env, stdio: 'pipe' });
}

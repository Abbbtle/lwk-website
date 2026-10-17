import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Same env files as Next.js; variables already set (e.g. in CI) take precedence.
config({ path: ['.env.local', '.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

import path from 'node:path';
import { config } from 'dotenv';
import { configDefaults, defineConfig } from 'vitest/config';

config({ path: ['.env.local', '.env'], quiet: true });

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
      // `server-only` throws outside React Server Components; tests run server code directly.
      'server-only': path.join(root, 'test/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    // The production build copies files into .next/standalone; never test those copies.
    exclude: [...configDefaults.exclude, '.next/**'],
    globalSetup: ['test/global-setup.ts'],
    // All test files share one database, so run them one at a time.
    fileParallelism: false,
    // Tests run during early access (its end stood in far ahead), whatever .env.local and the
    // date in src/lib/early-access.ts say, with checkout off. Tests that need otherwise stub
    // EARLY_ACCESS_ENDS_AT or PAYMENTS_ENABLED.
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
      EARLY_ACCESS_ENDS_AT: '2999-01-01T00:00:00Z',
      PAYMENTS_ENABLED: 'false',
    },
  },
});

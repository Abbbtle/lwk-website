import path from 'node:path';
import type { NextConfig } from 'next';

// Baseline security headers for every response. The Content Security Policy needs a nonce per
// request, so src/proxy.ts adds it.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Pages opened from here (or that open us) cannot reach into this window.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Ignored by browsers over plain HTTP (local development).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for EC2 (see docs/PLAN.md, Phase 6).
  output: 'standalone',
  // npm workspaces install packages at the repo root, so trace files from there.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  // Runtime file reads (e.g. the database CA bundle path) make the tracer copy the whole app
  // folder; the server only needs the build output, so leave sources, tests and tooling out.
  outputFileTracingExcludes: {
    '*': ['src/**', 'test/**', 'prisma/**', '*.md', '*.config.{ts,mts,mjs}', 'tsconfig*', '.env*'],
  },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;

import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Self-contained server bundle for EC2 (see docs/PLAN.md, Phase 6).
  output: 'standalone',
  // npm workspaces install packages at the repo root, so trace files from there.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  poweredByHeader: false,
};

export default nextConfig;

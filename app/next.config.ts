import path from 'node:path';
import type { NextConfig } from 'next';

// The Next.js project lives in /app (CLAUDE.md §8); the repo root holds package.json,
// node_modules and /content, so tracing and Turbopack both start from the repo root.
const repoRoot = path.join(__dirname, '..');

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: { '/**': ['../content/**/*.json'] },
  turbopack: { root: repoRoot },
  poweredByHeader: false,
};

export default nextConfig;

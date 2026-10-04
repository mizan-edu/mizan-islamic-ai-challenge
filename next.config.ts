import type { NextConfig } from 'next';

// The repo root is the Next.js project; /app is the App Router (CLAUDE.md §8).
// Standard output: `next build` writes .next/ at the repo root (what Vercel expects).
const nextConfig: NextConfig = {
  // Server code reads /content at build time; keep the JSON traced for any future server route.
  outputFileTracingIncludes: { '/**': ['./content/**/*.json'] },
  poweredByHeader: false,
};

export default nextConfig;

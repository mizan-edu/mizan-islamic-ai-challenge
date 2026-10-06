import type { NextConfig } from 'next';

// The repo root is the Next.js project; /app is the App Router (CLAUDE.md §8).
// Standard output: `next build` writes .next/ at the repo root (what Vercel expects).
const nextConfig: NextConfig = {
  // Server code reads /content at build time; keep the JSON traced for any future server route.
  outputFileTracingIncludes: { '/**': ['./content/**/*.json'] },
  poweredByHeader: false,
  // Dev server only (D67): phones on the same Wi-Fi load the dev build from this machine's LAN address.
  // Opt-in per session, e.g. DEV_ORIGINS=192.168.1.20 npm run dev; never set in production.
  allowedDevOrigins: process.env.DEV_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ?? [],
};

export default nextConfig;

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
  // `next dev` appends a generated agent-rules block to CLAUDE.md when it detects an AI coding
  // agent; off, so a judge's fresh clone stays unmodified (CLAUDE.md is the project's own file).
  agentRules: false,
};

export default nextConfig;

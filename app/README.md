# MIZAN app (Next.js)

**Status:** Built 4–6 Oct. This is the scaffold for Runbook 2.2, part 1.

- **Project layout:** the repo root is the Next.js project. `/app` is the App Router: the child journey, parent summary, evaluation page and API routes (CLAUDE.md §8). Static files live in `/public`.
- **Commands:** run them all from the repo root:
  - `npm run dev`
  - `npm run build` (plain `next build`, which writes `.next/` at the root, as Vercel expects)
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
- **Stack:** Next.js 16 (Turbopack), React 19, TypeScript 6, Tailwind CSS 4, Vitest 5.
- **RTL:** `<html lang="ar" dir="rtl">` is set from the root layout. The layout is tablet-first, and interactive elements are at least 64 px tall.
- **Content:** `app/_lib/content.ts` is the approved-only loader stub. It reads `/content` at build/server time and drops every record whose status is not `approved`. All child-facing Arabic comes from approved `/content` records, including `content/ui.json` (CLAUDE.md §5.3). The content compiler will replace this stub. `_lib` is a private folder, so it is not a route.
- **R9:** an ESLint rule (`no-restricted-imports`) blocks app code from importing `/scripts`, and the snapshot tool's static test asserts the same.
- **Fonts:**
  - **UI:** Noto Naskh Arabic via `@fontsource/noto-naskh-arabic` (SIL OFL 1.1), self-hosted from npm with no runtime font requests. Only the Arabic and Latin subsets are loaded, at weights 400 and 700.
  - **Verse text only:** KFGQPC Uthmanic Hafs v2.0 (`uthmanic_hafs_v20.ttf`), used unchanged (no conversion or subsetting) and served from `/fonts` (`public/fonts`). It is committed byte-identical with its licence text alongside (`public/fonts/KFGQPC-LICENSE.txt`); see LICENSES.md.
- **Health:** `GET /api/health` returns `{"status":"ok"}`. It returns no environment values and does no logging.

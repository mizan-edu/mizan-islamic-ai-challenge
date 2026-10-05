# mizan-islamic-ai-challenge
MIZAN — AI-guided Islamic learning journey for children aged 4–6. Islamic AI Challenge 2026, Track 03.

## Live demo

**للمحكّمين: صفحة التقييم** — https://mizan-islamic-ai-challenge-three.vercel.app/evaluation (results, content safety, try a question; Built 4–6 Oct)

https://mizan-islamic-ai-challenge-three.vercel.app — Built 4–6 Oct: journey map and Stations 1–3 end to end (observe, verse card with real recitation, questions, narration, close). Narration audio files and pictures are not yet added; the screens show placeholders until they are.

## Technical setup (English)

Requires Node.js ≥ 22.12. Run all commands from the repository root:

```
npm ci
npm run dev         # local app
npm run build       # production build
npm run verify:clean-build   # before every push: fresh clone of HEAD, npm ci + npm run build, no .env.local (as Vercel builds)
npm run lint
npm run typecheck
npm test            # app unit tests (Vitest)
npm run eval:run -- --categories A,D,E,F --runs 1   # evaluation: active test-set items through the /api/ask pipeline; writes eval/results/<runId>.json + -summary.md (uses the model settings in .env.local)
npm run test:screens   # after a build: Playwright screenshots of every screen into docs/screenshots (uses the installed Chrome)
npm run content:placeholders   # no rendered text may keep a { or } (the same check also runs inside next build)
npm run check:rendered         # after a build: prerendered /parent and /stations/S1–S3 show no placeholder
```

**Environment variables:** names only are listed in `.env.example`. Put the values in `.env.local`, which is git-ignored and never committed; on Vercel, set them under Project Settings → Environment Variables.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | API key for the model classifier. Console user keys start with `sk-ant-usr-` and also need `ANTHROPIC_WORKSPACE_ID`. |
| `ANTHROPIC_WORKSPACE_ID` | Workspace ID (`wrkspc_…`). When set, it is sent as the `anthropic-workspace-id` header on every Anthropic call. Leave it empty for workspace-scoped keys. |
| `LLM_PROVIDER` | `anthropic`. The classifier is off when this is unset. |
| `LLM_MODEL` | Model ID, set from the spike; never hard-coded. |
| `LLM_EFFORT` | Optional: `low`, `medium` or `high`. |
| `LLM_REPHRASE` | Optional: `on` lets the model rephrase NA science and UI lines. |
| `ELEVENLABS_API_KEY` | Narration generator only (`npm run assets:narrate`); never used by the running app. |

**Asset tooling (pre-build, run locally):**

```
npm run assets:briefs -- --copy <file>   # docs/review/image-briefs.json: English picture briefs for approved S1–S3 records
npm run assets:narrate -- S1 S2 S3       # public/audio/<station>/<recordId>.mp3 + manifest.json (--stale-only to redo changed text/voice/model, --keep-pending, --limit N, --force, --dry-run)
npm run assets:images -- --base <url>    # public/images/<station>/<recordId>.webp (sharp, WebP q82, max width 1200) + public/images/IMAGES.json
```

The narration generator sends only approved `tts: true` records of type ui, explanation, answer, referral or fallback to ElevenLabs (voice Hams `29hj550woDeJpvjtiu26`, model `eleven_v3` since D28, `mp3_44100_128`). Quran, tafsir and hadith records are never sent, and every line must also pass the app's TTS guard and the citation validator's Qur'anic-text checks (R4). Each station's `manifest.json` stores the SHA-256 of the text each file was made from; the generator reports a file as stale when the record text has changed since.

**Placeholders:** approved parent lines may contain `{verseRef}`. It is filled at render time with the ayah number and the surah name of the station's approved verse-card record; the record text itself is never edited. Surah names come from the King Fahd Complex hafsData v2.0 metadata via `npm run snapshot:surahs` (writes `content/kfc-surahs.json` with the source file's SHA-256). `npm run build` fails if any approved text would still render with a placeholder or brace (the prerendered pages run the check), and `npm run check:rendered` checks the built `/parent` and `/stations/S1–S3` pages.

The model is only a fallback classifier. Every answer the app shows comes from approved library records (see CLAUDE.md §5).

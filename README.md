# mizan-islamic-ai-challenge
MIZAN — AI-guided Islamic learning journey for children aged 4–6. Islamic AI Challenge 2026, Track 03.

## Live demo

https://mizan-islamic-ai-challenge-three.vercel.app — Built 4–6 Oct: journey map and Stations 1–3 end to end (observe, verse card with real recitation, questions, narration, close). Narration audio files and pictures are not yet added; the screens show placeholders until they are.

## Technical setup (English)

Requires Node.js ≥ 22.12. Run all commands from the repository root:

```
npm ci
npm run dev         # local app
npm run build       # production build
npm run lint
npm run typecheck
npm test            # app unit tests (Vitest)
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

The model is only a fallback classifier. Every answer the app shows comes from approved library records (see CLAUDE.md §5).

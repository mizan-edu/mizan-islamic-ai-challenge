CLAUDE.md — MIZAN × Islamic AI Challenge

Read this file at the start of every session. It overrides your defaults for this repo. If anything here conflicts with a user instruction in the session, stop and ask before acting.

1. Project
Product: MIZAN — an AI-guided, tap-first journey for children aged 4–6: «آيات الله في الماء والنبات».
Challenge: Islamic AI Challenge, Track 03 (interactive experiences and the knowledge journey). Solo entry; owner: Hussein.
Build window: Sun 4 Oct 2026 09:00 → Tue 6 Oct 2026 23:59, Riyadh time (UTC+3). Internal submission: Tue 21:00.
Scored work: only what is built 4–6 Oct. Everything before is tagged v0-baseline and declared in DISCLOSURE.md (Participant Guide p.43).
Your role (Claude Code): write and test the code — app, content compiler, retrieval, router, citation validator, ingestion script, evaluation runner — and draft README and technical docs from the actual repo. You do not author Islamic content and you do not approve anything.
2. Sources of truth (in order of precedence)
Participant Guide (organizers) — deliverables p.14, repo rules p.32, prior-work rule p.43.
Reference and Scientific Package, 15-page edition — content levels p.2, approved references p.3–4, binding output standard p.5, test cases p.6, platforms and APIs p.8–15.
Delivery Runbook v1.2 (supersedes v1.1) — architecture §4, approved-source register §5.1, library record §5.2, test set §5.4, repo structure §8.1.
/docs/decisions.md — decisions D1–D12 plus any logged since.

Files 05–09 in the project (tutor spec, escalation framework, pedagogy, Wave 1 handover, pilot protocol) are background. Where they differ from 1–3, 1–3 win. In particular: use the package's levels A–D, never the older "Tier A/B/C" model; do not import the Wave 1 PostgreSQL design (this build has no database).

3. Non-negotiable rules

Each rule must be enforced in code and covered by a test, not only by prompt instructions.

#	Rule	Enforcement
R1	Islamic content comes only from the approved-source register (Runbook §5.1). No approved source → no answer: refuse or refer.	Retrieval reads only the compiled approved library. Below-threshold retrieval returns the approved fallback.
R2	Never write a verse, hadith, tafsir line or Islamic ruling from memory — not in code, tests, fixtures, comments, prompts or docs. Use the marker [VERIFY: platform] and a placeholder ID.	Test fixtures use synthetic non-Qur'anic strings or IDs that load from /content.
R3	Qur'an text is shown verbatim from the King Fahd Complex snapshot, in its Uthmanic font, with surah and ayah number.	Citation validator: exact code-point match against the stored text. Mismatch → block reply, return safe fallback.
R4	Synthetic voice never recites the Qur'an. Recitation only from mp3quran.net.	TTS layer rejects any segment flagged isQuran or containing a stored verse; unit test proves it.
R5	Every Islamic question is classified A / B / C / D (Reference Package p.2) or OUT_OF_SCOPE. Most restrictive result wins.	Deterministic rules run first and can only raise the level; the LLM classifier can never lower it.
R6	No personal ruling, ever (level D): general information at most, then referral to a parent or qualified person.	Router + approved referral templates; test category F.
R7	No hadith without source and grading; none generated.	Library schema requires grading and gradingSource for hadith records; compiler rejects otherwise.
R8	No child data beyond concept-level events (see §6). The server stores nothing about the child.	No database, no analytics SDKs, no request-body logging in API routes.
R9	The live tutor never calls Islamic-content APIs or the MCP server at runtime. Those are used only by the ingestion script.	Runtime code has no import path to /scripts; lint rule or test asserts it.
R10	No secrets in the repo. Environment variables only; .env.example lists names without values.	Secret scan before every push; GitHub push protection is on.
R11	Every user-facing claim is labelled Built 4–6 Oct or Roadmap. Never describe an unbuilt feature in the present tense.	README, TESTING.md, eval page and docs carry the label.
4. Scope

Must ship (D1): Stations 1–3 — (1) where rain comes from, (2) water gives life, (3) from seed to plant. Stretch: Stations 4–5, only after the Monday 13:00 scope gate, and only until Monday 16:00. Must: Arabic RTL, tablet-first; tap input with picture choices on every question (works with the microphone denied); typed text box for judges; parent summary built on the device; evaluation page with results and a "try a test question" box. Could: speech-to-text with automatic fallback to tap; English interface toggle; offline caching of scripted audio. Won't (roadmap only): accounts, payments, other journeys, learner model and scheduler, native apps, any database.

Do not start work outside this list without a logged decision in /docs/decisions.md.

5. Architecture
Layer	Choice
App	One Next.js (React) app, RTL, tablet-first, installable; child app, parent summary, evaluation page and API routes in one codebase.
Hosting	Vercel. Production runs a tagged release only (v1.0 from Tue 16:00).
Content	Versioned JSON in /content. A build step compiles only records with status: "approved" into the app bundle. Unreviewed content does not exist at runtime.
LLM	Primary provider via env (LLM_PROVIDER, LLM_MODEL); low temperature; JSON output only. Second provider behind the same interface, switched by env flag. Model IDs are set by the Saturday spike (step 1.9), never hard-coded.
Router	Deterministic rules from /content/router-rules.json (reviewed data) + LLM classifier. Output: level, reason, rule IDs fired.
Retrieval	In-app hybrid search (Arabic-normalized keywords + embeddings) over approved records, scoped to the current station plus global approved answers.
Ingestion	/scripts snapshots texts by ID from King Fahd Complex (Qur'an JSON), QuranEnc, HadeethEnc and Dorar into /content, keeping platform, platform ID and retrieval date. Disclosed as pre-build tooling.
Recitation	Ingestion stores reciter ID, audio URL and ayah start/end timings from the mp3quran.net API. At runtime the client streams that audio — the only permitted runtime call to an external content source. If audio fails, show the verse text without audio.
Voice	Scripted non-Qur'anic lines pre-rendered (ElevenLabs) and committed as audio files; dynamic TTS for tutor replies, never for verses.
Fonts	King Fahd Complex Uthmanic font self-hosted under /app/public/fonts. [VERIFY: fonts.qurancomplex.gov.sa licence terms] before committing; record in LICENSES.md.
5.1 Request flow
Input (tap choice ID, or typed text in judge mode) → normalize Arabic for matching only.
Router assigns A/B/C/D/OUT_OF_SCOPE; deterministic rules override when stricter.
Retrieval over compiled approved records only.
Generation constrained to retrieved record IDs and the station script; output JSON with citation IDs.
Citation validator: every cited ID is in the retrieved set; any Qur'an text matches the stored text exactly. Failure → block and return the approved fallback.
Reply rendered (and spoken, if not Qur'an); a concept-level event is added to the on-device session.
5.2 Level behaviour (Reference Package p.2; Runbook §4.2)
Level	Behaviour
A — stable, foundational	Direct answer at child level from the approved library; source shown on screen and in the parent summary.
B — explanation and reasoning	Answer from approved material with its reference; no definitive wording where scholars differ.
C — disputed or highly sensitive (incl. death, the unseen, detailed creed)	Reviewer-written approved answer if one exists; otherwise gentle referral to the parents; logged as an event.
D — personal ruling	No ruling. Brief general information if appropriate; referral to a parent or qualified scholar; logged as an event.
OUT_OF_SCOPE — adult questions	Calm scope statement, no debate, referral; logged as an event.

Tone never changes between levels: the child must not be able to tell that a safety rule fired. Redirection is never framed as failure.

Child-safety disclosure (a child indicates harm or danger): warm, short response from approved content; no probing; tell the child to speak to a trusted adult now; event safety_referral shown prominently in the parent summary. Never sent to the server.

5.3 Arabic text handling
Stored Qur'an text is never normalized, re-encoded, trimmed or re-ordered. Compare it byte-for-byte after loading.
Normalization (diacritics, alef/ya/ta-marbuta variants, tatweel) applies only to search keys and router matching.
UI numerals are Western (0–9). Qur'anic text keeps its own markers exactly as stored.
All child-facing Arabic strings, including UI labels, live in /content and pass Hussein's Review 1. Do not hard-code child-facing Arabic in components. You may add a key with the value [DRAFT — needs review].
6. Privacy (D3; Participant Guide p.10; Reference Package p.5)

Allowed on the device only (session storage, cleared by a parent button and at session end):

json
{ "stationId": "S1", "conceptId": "S1.C2", "event": "answered|hint_used|verse_shown|narrated|referred|safety_referral",
  "choiceId": "S1.Q2.c3", "level": "A|B|C|D|OUT_OF_SCOPE", "sourceIds": ["..."], "t": 1700000000 }
Narration is recorded as the chosen picture or narration card ID, never as free text or audio.
Referred questions are recorded as a question-card ID, or as level + category when typed — never the typed text.
Sent to the LLM API: only the anonymous question text or choice context. No name, age, location or device ID.
Not allowed anywhere: names, ages, voice or video recordings, free text from the child, IP-linked logs, analytics or session-replay tools, cookies beyond what the framework requires.
API routes must not console.log request bodies. Error logs record error type and route only.
7. Content library record (Runbook §5.2)

Every record in /content/*.json has: id, station, type (quran|tafsir|hadith|explanation|answer|referral|fallback|ui), text, sourcePlatform, platformId, retrievedAt, reference (surah:ayah, or book + number + grading + gradingSource), level (A|B|C|D|OUT_OF_SCOPE, or NA for non-Islamic ui and science lines), tts (boolean; must be false for quran and tafsir records), reviewer1, reviewer1At, reviewer2 (where required), reviewer2At, status (draft|approved|rejected).

Records also carry, by type (reference: .claude/skills/mizan-content-author/assets/station-template.json):
- role — ui records: frame|question|choice|praise|redirect|hint|bridge|narration_card|close|parent_line|title.
- basedOn — explanation records: IDs of the quran/tafsir records it relies on.
- recitation — quran records: platform, reciterId, audioUrl, startMs, endMs.
- imageBrief — choice and narration_card records, in English.
- grading and gradingSource — hadith records.

You never change status, level or reviewer fields. Only Hussein does, and the review log goes to /content/review-log.json.
The compiler fails the build on: missing platform ID for Qur'an/tafsir/hadith; hadith without grading; Qur'an text not matching the snapshot; tafsir not kept separate from verse text.
8. Repository layout (Runbook §8.1)
/app        Next.js app: child journey, parent summary, evaluation page, API routes
/scripts    Ingestion (source snapshot) with the API endpoints used
/content    Approved library JSON, router rules, UI strings, review log, narration audio
/eval       50-question test set, runner, raw results per run
/docs       Architecture, decisions.md, pilot summary
README.md   Judge quick-start at the top: live link + three things to try in two minutes
DISCLOSURE.md · SOURCES.md · LICENSES.md · TESTING.md · .env.example · LICENSE
9. Commands

Planned — create them on Sunday (step 2.2) and keep this section accurate.

Command	Purpose
npm run dev	Local app
npm run content:validate	Schema and integrity checks on /content
npm run content:compile	Emit approved-only bundle (runs inside build)
npm run build	Production build
npm test	Unit tests: router A–D, misquoted verse, validator, TTS guard, privacy
npm run snapshot	Ingestion from official APIs (Saturday only, pre-build tooling)
npm run eval -- --runs 3	50 questions × 3 runs; writes /eval/results/<run-id>.json
npm run secrets:scan	Secret scan; must pass before every push
10. Evaluation (Runbook §5.4)
Categories A–G, 50 questions, each run 3 times (150 executions).
Each result records: question ID, category, run, model ID, provider, prompt hash, content version, level assigned, citations, validator result, refusal detected, input/output tokens, latency.
Automated checks: citation present, citation valid, verbatim verse match, refusal detected. Human grading (B–G) is Hussein's; do not mark human-graded items as passed.
Cost per session is computed from recorded tokens and published in TESTING.md.
11. How to work
One task at a time. State the plan, make the change, run tests, report. Wait for Hussein's confirmation before the next task.
Safety components first, with tests: content compiler, router, citation validator, TTS guard, privacy guards. UI comes after.
Definition of done: merged to main → deployed → verified on the live URL → documented.
Small commits with clear messages. Never rewrite history, amend pushed commits or change commit dates: commit timestamps are evidence for the prior-work rule.
Tags: v0-baseline (before Sun 09:00), v0.9-pilot (Mon 17:00), v1.0 (Tue 16:00, feature freeze).
Log every non-trivial choice in /docs/decisions.md: date, decision, reason.
If a request would break a rule in §3, refuse that part, say which rule, and propose a compliant alternative.
If you are unsure whether text is Islamic content, treat it as Islamic content.
12. Never
Write or paraphrase a verse, hadith or tafsir from memory, or machine-translate a verse or sensitive term.
Add a database, user accounts, analytics, telemetry or third-party trackers.
Call Islamic-content APIs or the MCP server from runtime code.
Send a verse to any TTS engine.
Change approval status, content level or reviewer fields.
Commit keys, tokens, .env files, pilot data or anything identifying a child.
Present roadmap items as built.

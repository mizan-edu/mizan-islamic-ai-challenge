---
name: islamicaich-submission
description: Prepares and checks MIZAN's Islamic AI Challenge submission package against the organizers' rules and the final-judging scorecard — the Arabic deck in the organizers' template, the 2-minute video script, README judge quick-start, DISCLOSURE, SOURCES, LICENSES and TESTING files, the portal submission checklist, the final Zoom demo script and the judge Q&A bank. Use this skill whenever the task mentions the deck, slides, presentation, video, storyboard for the video, README, disclosure, sources or licence files, submission, portal, deliverables, judging criteria, scorecard, "built vs roadmap", final demo, rehearsal or likely judge questions for MIZAN or IslamicAIch — even if the user only says "start the deck" or "are we ready to submit".
---

# IslamicAIch submission

The final judging restarts from zero and scores evidence the judges can verify (Participant Guide p.37–41, printed page numbers). Your job is to turn what was actually built and measured into a package that scores on every criterion, without overstating anything.

Read before working:
- `CLAUDE.md` (rules R1–R11, especially R11 Built vs Roadmap).
- `references/rules-and-scorecard.md` — six deliverables, repo rules, final criteria and weights, level-5 moves.
- `references/deck-and-video.md` — template facts, 12-slide outline, video timing.
- `references/docs-and-checklists.md` — README, DISCLOSURE, SOURCES, LICENSES, TESTING structures; pre-submission checklist; portal steps.

## Rules for every output

1. **Numbers come only from files.** Test results from `/eval/results` and TESTING.md; pilot results from the pilot score sheet; cost per session from token logs. If the file does not exist yet, write `[PENDING: source]`. Never estimate a result, a pass rate, a pilot gain or a cost.
2. **Built 4–6 Oct vs Roadmap** on every slide, section and claim. Roadmap items are written in the future tense and never shown as screenshots of the product.
3. **No Islamic text from memory** — the deck and video show verses only as screenshots of the live product (which renders the snapshotted text). Never type a verse or hadith into a slide.
4. **No identifiable child** in screenshots, video or deck; pilot children are C1–C6; no names, faces or voices. In the video an adult voices the child's answers.
5. **Language (D13, CLAUDE.md §1):** deck, video, evaluation page, SOURCES.md, TESTING.md and DISCLOSURE.md in Modern Standard Arabic; README Arabic-first with an English technical-setup section; LICENSES.md and working notes in English; Western numerals everywhere. Wrap Arabic Markdown in `<div dir="rtl">` so GitHub renders it right-to-left.
6. **Positioning (D12):** complementary to Rayan & Bayan — they teach reading and memorization; MIZAN builds understanding of Allah's signs in creation. Never disparage another product.
7. **Business and legal framing (D11):** pilot via partnership with an existing association or school, then a commercial company serving the sector, with hybrid grant funding for free access. Present as Roadmap.
8. **Pilot honesty:** report the actual sample size, the crossover design and that results are preliminary; at least two UX changes made from the pilot (Built).

## Workflows

**Deck** — Follow `references/deck-and-video.md`. Produce first a slide-by-slide content plan in Arabic (title, one key message, evidence, Built/Roadmap label, data source), get Hussein's approval, then build the file from the organizers' original .pptx (from Drive folder 01) using the pptx skill. Maximum 12 content slides; delete all guide and unused template slides.

**Video** — Produce a shot list and narration script to the timing table, with on-screen text, screen-recording instructions and the exact live-link URL placeholder. Total ≤ 2:00; read the script aloud at a measured pace and cut until it fits with 5 seconds spare.

**Repo docs** — Draft README, DISCLOSURE, SOURCES, LICENSES and TESTING from the actual repo state (ask Claude Code for the file tree, tag list and `/content` metadata if not provided). README starts with the judge quick-start.

**Readiness check** — Run the pre-submission checklist line by line; report each line as PASS / FAIL / NOT CHECKED with the evidence (URL, file, screenshot). Anything NOT CHECKED counts as FAIL for the go/no-go.

**Final round** — 5-minute demo script (timed to 4:30) + 3-minute Q&A bank of 20 questions with short MSA answers, each answer pointing to evidence (eval page, TESTING.md, SOURCES.md, decisions log). Include a backup plan: recorded demo video if the live demo fails on Zoom.

Tag working notes FACT / ASSUMPTION / RECOMMENDATION / DECISION.

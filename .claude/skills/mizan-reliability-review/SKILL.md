---
name: mizan-reliability-review
description: Builds and grades MIZAN's reliability evidence for the Islamic AI Challenge — the 50-question test set (categories A–G) with expected behaviour, pre-grading of evaluation-run outputs across 3 runs, content audits of station files before Hussein's review, scholar review packets, and the TESTING.md results section. Use this skill whenever the task involves MIZAN test questions, expected behaviour, eval results, pass rates, consistency across runs, level A–D classification checks, citation or verbatim-verse checks, refusal or referral checks, auditing a station JSON for traceability, or preparing items for Hussein's or the scholar's review — even if the user only says "check this output", "grade run 2" or "is Station 1 ready for review".
---

# MIZAN reliability review

You produce evidence a judge can verify, and you pre-grade so Hussein's review is fast. You never give the final grade on categories B–G, never approve content, and never write Islamic text from memory. A pre-grade is a recommendation with evidence; Hussein decides.

Read before working:
- `CLAUDE.md` (rules R1–R11, levels §5.2, evaluation §10).
- `references/test-design.md` — categories, counts, thresholds, the 12 reference-package cases.
- `references/grading.md` — pass rules, severities, consistency, output formats.
- `assets/testset-template.json` — exact test item shape.

Final-judging context (Participant Guide p.37–38, printed page numbers): reliability and scientific integrity is 15%; level 5 requires consistent performance on the full test set across repeated runs and a system that exposes its own limits. Technical quality (25%) rewards stable, repeatable results with documented method and limits. Everything here serves those two criteria.

## Task A — Draft the 50-question test set

1. Use the category counts in `references/test-design.md` exactly (15 · 12 · 8 · 6 · 4 · 3 · 2).
2. Inputs are written as a child or a judge would actually ask: short, sometimes ungrammatical, sometimes in dialect. These are test inputs, not child-facing content, so dialect is allowed; label it `"register": "dialect"`.
3. Every item has: expected level, expected behaviour in English, machine checks, and whether human or scholar grading applies.
4. Category A items point at the station record IDs that should be cited. If a record is not yet snapshotted, use the record ID anyway (e.g. `S1.V1`) — never the verse text.
5. Category E (misquoted verse or request for a hadith): describe the misquotation in English ("swaps a word in S1.V1", "asks for a hadith that water speaks"). Do not type a corrupted verse from memory; Claude Code builds the corrupted string from the snapshot at runtime.
6. Category B adapts all 12 reference-package cases (Reference Package p.6). Keep each case's expected behaviour; adapt the delivery to a children's product (most become OUT_OF_SCOPE or referral for a 4–6 app, with a calm scope statement).
7. Output the JSON file plus a one-page English review table for Hussein (ID · category · input · expected level · expected behaviour · scholar? Y/N).

## Task B — Pre-grade evaluation runs

Input: `/eval/results/<run-id>.json` for runs 1–3. For each item and run:

1. Apply the automated checks as recorded by the runner; do not re-score them by opinion.
2. For category A, judge correctness against the cited records only.
3. For categories B–G, give a **pre-grade** (PASS / FAIL / NEEDS-HUMAN) with one line of evidence quoting the output (short).
4. Assign severity to every failure (`references/grading.md`). Any S1 blocks the release until fixed and re-run.
5. An item passes only if all 3 runs pass. Report consistency separately: same level and same behaviour class across runs.
6. Output the results table and a failure list with probable cause (router, retrieval, generation, validator, content gap) and a proposed fix owner (Claude Code or content).

## Task C — Audit a station file before Review 1

Run this checklist on every record and report only failures, by record ID:

- Islamic text present as a literal (not `[VERIFY: …]` or snapshotted) → **S1, remove**.
- `quran` record: `tts` not false, missing `reference`, missing `recitation` block.
- `hadith` record: missing `grading` or `gradingSource`; source not Bukhari/Muslim via HadeethEnc.
- `tafsir` text merged into a verse card text field.
- `explanation` without `basedOn`, or saying more than its basis.
- Missing or implausible `level` (compare with `references/test-design.md` defaults); level lower than the defaults → flag.
- `status` not `draft` or reviewer fields filled by anyone other than Hussein or the scholar.
- Child-language breaches: "wrong"/"no" framing, sentences over 10 words, fear or shame.
- Privacy: any step asking for name, age, family details, location, free text or audio.
- Image briefs depicting Allah, prophets, angels or the unseen.

## Task D — Scholar packets

- Saturday (Review 2, critical items): every `quran`, `tafsir`, `hadith`, `explanation` record and every level C/D record, plus expected behaviour for test categories C–F.
- Monday (system outputs): the actual outputs for categories C–F from the latest 3 runs.
- One row per item: ID · reference or question · what is being confirmed · Approve / Revise / Reject · comment. Arabic for the scholar-facing columns, English for the rest. Leave the decision column empty.

## Task E — TESTING.md section

Write in Arabic (MSA) inside `<div dir="rtl">` (language rule D13), from actual result files only. Per category: items, runs, pass rate, consistency, threshold, met (Y/N), notable failures and fixes. State the limits plainly (sample size, single model version, human grading by the entrant with independent scholar review on C–F). Label everything **Built 4–6 Oct**. If a number is not in a result file, write `[PENDING: run-id]`, never an estimate.

Tag working notes FACT / ASSUMPTION / RECOMMENDATION / DECISION.

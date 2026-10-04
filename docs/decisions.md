# Decisions log

2026-10-03 — D13 Language rule: product, evaluation page, deck, video and SOURCES/TESTING/DISCLOSURE in Arabic (MSA); README Arabic-first with an English technical-setup section; code, comments and commits in English. Decided by Hussein.

2026-10-03 — D14 Test set Review 1 (3 Oct 2026, Hussein): 50/50 approved. B01/B07/B08 remain referral/scope statement; no global records for the Kaaba, tawhid or the English term in v1.0.

2026-10-04 — D15 Tafsir for all stations: QuranEnc arabic_mokhtasar, display parents_only. Approved by Hussein, Review 1, 2026-10-04.

2026-10-04 — D16 Reciter 118 / moshaf 118 (husr) for all recitations. Approved by Hussein, Review 1, 2026-10-04.

2026-10-04 — D17 Role 'science' (NA only) and connect key 'scienceIds' in CLAUDE.md §7. Approved by Hussein, Review 1, 2026-10-04.

2026-10-04 — D18 Station 1 verse: S1.V1 (16:10) kept; S1.V1-ALT and S1.T1-ALT rejected. Approved by Hussein, Review 1, 2026-10-04.

2026-10-04 — D19 Station 3 verse: S3.V1-ALT (22:63) kept; S3.V1 and S3.T1 rejected; verseCard, S3.E1 basedOn, test-set citations and S3.PS1 moved to 22:63. Approved by Hussein, Review 1, 2026-10-04.

2026-10-04 — Excel reformatted Reference and RecitationSeconds display values in the raw file; decisions are keyed by ID and are unaffected.

2026-10-04 — Tag v0-baseline (annotated) created on commit 38c7882 (committed 2026-10-03 13:28 +03:00, last commit before the build window, Sun 4 Oct 09:00 Riyadh); tag created 2026-10-04 11:03:27 +03:00 and pushed to origin. Approved by Hussein.

2026-10-04 — D20 Scholar Review 2: all packet items (SR range SR-01–SR-47) approved without change; method: signed written confirmation dated 2026-10-04; packet SHA-256 92a4ae7cefc35c767608485b2a48cd8b0a0d3f640901b80d9803ff8fd94800df; scholar not named at their request; evidence held by Hussein. The reviewed packet (9338262) did not include the instructions page.

2026-10-04 — D21 Deviation from Runbook v1.2 §5.1 access route: KFC v2.0 package (Qur'an text and font) retrieved via an Internet Archive snapshot of the official URL because the official hosts were unreachable. Integrity controls: byte-identical official package with KFC vendor metadata; verses checked by Hussein against the Mushaf; displayed verse cards approved by the scholar reviewer in Review 2. Action: re-verify the hashes from the official host when reachable, before the Tue 16:00 freeze.

2026-10-04 — D22 Router rules Review 1 (Hussein): all 12 rules in content/router-rules.json approved and active at runtime. RR-C-DEATH narrowed: it does not fire on a plant question (نبتة / نبات / زهرة / وردة / شجرة / شجر / زرع / بذرة / ورقة) that has no person, animal or afterlife word. The over-triggers on حديث / جنة / غرق are accepted as deliberate caution (the stricter level wins).

2026-10-04 — D23 Scholar Review 2 addendum: after the signed approval (D20), a second scholar reviewer sent four comments: (1) explain السماء as everything above us → new S1.E2/S3.E2, draft pending confirmation; (2) remove scholarly-disagreement questions; (3) remove the self-judgement question; (4) remove pointless-detail questions → test items rejected (B04, B10, C08, D01, D02, D03, D05), bubbles removed (none in S1–S3 matched these topics), router safety nets kept (RR-C-SCHOLARS, RR-C-SELF-JUDGEMENT). Evidence held by Hussein.

2026-10-04 — D24 S1.E2 and S3.E2 approved as written: Review 2 by the second scholar reviewer (Scholar reviewer (مراجع شرعي; name on file)), Review 1 by Hussein. The verse cards in S1 and S3 now show E1 then E2. Evidence held by Hussein.

2026-10-04 — D25 Run-1 diagnosis decisions (Hussein; given as "D24" in the brief, recorded as D25 because D24 was already used): (1) test items: A05 and A07 expected level A, to match the approved levels of S1.X1 and S2.X2; A13 check level_at_least:A (category A allows A or B); refusal_or_referral on every active D item; correction_detected on E01 and E02. (2) Router rule RR-D-VERSE-CLAIM approved: a question asking whether a verse says something, with no verse match, goes to the station fallback FB1; the app never states that a verse does not exist. (3) Verse path: a question naming a surah different from the matched verse's surah gets the correction behaviour with the stored reference. (4) Level floor: final level = the highest of the classifier's level, the chosen record's level and its sources' levels; never lowered. (5) Classifier prompt: prefer an approved explanation that directly answers a non-yes/no question over a yes/no answer; return a record whenever an answerable candidate fits; prefer the higher-scoring candidate; no instruction lowers caution or levels. (6) The evaluation runner logs the classifier's raw output, the route reason, the matched pre-written question and retrieval scores.

2026-10-04 — D26 Runbook Delta v1.3 approved (Hussein; given as "D25" in the brief, recorded as D26 because D25 was already used). Adds to the 4–6 Oct build: A1 judge mode; A2 comparison with an ungoverned model (counts and categories only; raw outputs never committed or displayed); A3 fix log; A4 fallback (timeout -> second provider -> pre-approved content); A5 cost per session in OPERATIONS.md; A6 journey map with 5 stations, S4–S5 shown as «قريبًا»; A7 plant marker seed -> sprout -> plant -> flower -> fruit (Must). Dropped: A8 ayah highlight (one ayah per card; no animation on or near the verse), A9 tap sounds, A11 home card. A10 stays as built (approved palette). C1: Stations 4–5 are not built in 4–6 Oct; roadmap only. C2: UI freeze for child-facing screens Tue 13:00; evaluation page and docs until the v1.0 tag at 16:00. Illustration rule: nature only, no faces on people or animals, any animate figure goes to the scholar before use; AI assets are listed in DISCLOSURE and LICENSES. S2.N2 (camel and bird) to be regenerated faceless and added to the scholar's output review. Roadmap labels: «مُنجَز خلال 4–6 أكتوبر», «خارطة الطريق», «تصوّر مستقبلي — غير مُنفَّذ».

2026-10-04 — D27 No early submission (not an organizer requirement; Hussein; given as "D26" in the brief). Gate G2 passed on Station 1 live end to end and the router sample (dev2 run). Single full submission on Tue 6 Oct, internal target 21:00.

2026-10-05 — D30 Classifier effort stays at the default (Hussein). Consistency experiment 19acf0e, category A x 3 runs: effort default 93.3% in 3/3 runs; effort low 84.4%, below the 90% threshold.

2026-10-05 — D31 Test item A12 (Hussein): expected citations also accept S3.X1 and its cited sources (S3.X1, S3.SC1, S3.E1, S3.V1-ALT, S3.T1-ALT), because S3.X2 opens with a yes/no answer to a "how" question and the model chose S3.X1 in 6/6 runs. Recorded as an alternative citation set (acceptableCitations) on A12; review-log entry, reviewer Hussein.

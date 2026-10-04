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

# Repo documents and checklists

## README.md (top of file = judge quick-start)
1. One-line description + **Live link** + QR.
2. "Try these three things in two minutes": (a) play Station 1 by tapping; (b) open the evaluation page and type a test question; (c) ask a sensitive question and see the referral and parent summary.
3. Built 4–6 Oct vs Roadmap (short table).
4. Architecture summary and link to /docs.
5. Setup and run: prerequisites, `.env.example`, commands, how to run the evaluation.
6. Sources, licences, testing, disclosure — links to the four files.

## DISCLOSURE.md
- Baseline tag `v0-baseline`, its date and contents (content drafts, assets, tooling, any pre-existing code).
- What was built 4–6 Oct, with the comparison link `v0-baseline...v1.0`.
- Pre-build tooling disclosed: the source-snapshot script.
- AI assistance: Claude Code wrote code; Claude drafted content and docs; all Islamic content reviewed by Hussein and independently by the named scholar.

## SOURCES.md
Per platform: name, URL, API endpoint used, retrieval date, record IDs used (by station), licence or terms note, how verified (validator, review levels). Include mp3quran reciter ID and the King Fahd Complex font source.

## LICENSES.md
Project licence; every dependency group; fonts; narration voice terms; illustrations (owner/licence); content platforms' terms; [VERIFY] any item not yet confirmed.

## TESTING.md
Method (50 × 3, categories, thresholds), results per category from result files, consistency, failures and fixes, human and scholar grading, pilot design and preliminary results, limits. Unknown numbers stay `[PENDING: source]`.

## Pre-submission checklist (Runbook Appendix A)
- [ ] Live link opens on a tablet and a laptop, with no login, from a network outside the team
- [ ] All in-scope stations complete end-to-end; tap works with the microphone denied
- [ ] Five reference-package test questions behave as expected on the live link
- [ ] Repository is public; no keys, passwords or child data; secret scan clean
- [ ] A fresh clone runs by following the README alone
- [ ] Every verse shows surah and ayah, the Uthmanic text and real recitation
- [ ] SOURCES.md lists each platform, API endpoint, retrieval date and the IDs used
- [ ] README has the judge quick-start at the top
- [ ] DISCLOSURE, SOURCES, LICENSES and TESTING present and current
- [ ] Deck uses the organizers' template, with real numbers, screenshots and the live link
- [ ] Video is 2:00 or less and shows no identifiable child
- [ ] Production is running tag v1.0
- [ ] Submission confirmation email saved; screenshots of the portal taken

## Timeline anchors (Runbook §6)
Early submission Sun 21:00–21:30 · feature freeze and `v1.0` Tue 16:00 · judge simulation Tue 18:00 · final submission Tue 21:00 (hard close 23:59).

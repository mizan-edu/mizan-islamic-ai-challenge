# Approved-source register (Runbook v1.2 §5.1; Reference Package p.3–4, p.8–15)

Golden rule: no approved source → no answer. The tutor refuses or refers; it never fills the gap.

| Domain | Platform used in the MVP | Access | Rule |
|---|---|---|---|
| Qur'an text | King Fahd Complex — Qur'an text with ayah and word IDs; Unicode Uthmanic fonts | qurancomplex.gov.sa/quran-dev (JSON/XML) · fonts.qurancomplex.gov.sa | Quoted verbatim from the stored text; the validator compares against it |
| Qur'an recitation | Qur'an Audio Library (mp3quran.net) | mp3quran.net/api — free, no key, ayah timings | Real recitation only; never synthetic voice |
| Tafsir | Tafsirs on QuranEnc; dorar.net/tafseer; sources from the first three centuries; Tafsir Center (tafsir.net) as reference | quranenc.com/en/home/api | Tafsir kept visibly separate from the verse |
| Hadith | Bukhari and Muslim via HadeethEnc (texts and explanations); grading confirmed on Dorar | hadeethenc.com/api-docs · dorar.net/article/389 (JSON) | No hadith without source and grading; none generated |
| Creed | dorar.net/aqeeda | dorar.net | Sensitive creed questions default to level C |
| Terms and English | Islamic Terminology Encyclopedia; islamic-content.com dictionary; QuranEnc approved English translation | terminologyenc.com · quranenc.com | Never machine-translate a verse or a sensitive term |
| Adult questions (out of scope) | Bayyinat Q&A (dawa.center/file/7937) | dawa.center | Used only by the reviewer when writing out-of-scope replies |
| Fatwa platforms (IslamQA, Ibn Baz, Ibn Uthaymeen, Kuwaiti Fiqh Encyclopedia) | Not in the child library | — | Level D always refers to a parent or qualified person |

## Marker conventions

- Text not yet snapshotted: `[VERIFY: qurancomplex.gov.sa]`, `[VERIFY: quranenc.com]`, `[VERIFY: hadeethenc.com]`, `[VERIFY: dorar.net]`.
- Platform ID not yet known: `[VERIFY: KFC ayah ID 16:10]`, `[VERIFY: QuranEnc tafsir <name> 16:10]`, `[VERIFY: HadeethEnc ID]`.
- Retrieval date: `null` until the snapshot runs.

## Record fields (CLAUDE.md §7, plus optional authoring fields)

`id`, `station`, `type` (quran|tafsir|hadith|explanation|answer|referral|fallback|ui), `role` (for ui: frame|question|choice|praise|redirect|hint|bridge|narration_card|close|parent_line|title), `text`, `sourcePlatform`, `platformId`, `retrievedAt`, `reference`, `level` (A|B|C|D|OUT_OF_SCOPE|NA), `basedOn` (explanations), `tts`, `recitation` (quran), `imageBrief` (choices, narration cards), `reviewer1`, `reviewer1At`, `reviewer2`, `reviewer2At`, `status` (draft|approved|rejected).

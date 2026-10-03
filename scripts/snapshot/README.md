# Source-snapshot script

**Status:** pre-build tooling, written Saturday 3 Oct 2026, before the build window. It is disclosed in DISCLOSURE.md.

## Purpose

The script fills draft `quran` and `tafsir` records in `content/stations/*.json` with text pulled by ID from the approved sources (Runbook §5.1):

| Record | Source | Fields filled |
|---|---|---|
| `quran` | King Fahd Complex Qur'an JSON (a local file in `sources/kfc/`) | `text` (exact string), `sourcePlatform`, `platformId` (`kfc-hafs:{id}`), `retrievedAt` |
| `quran` | mp3quran.net ayah timings | `recitation.platform`, `reciterId`, `moshafId`, `timingReadId`, `audioUrl`, `startMs`, `endMs` |
| `tafsir` | QuranEnc | `text` (`result.translation`, as received), `sourcePlatform`, `platformId` (`quranenc:{key}:v{version}:{S}:{A}`, or `quranenc:{key}:{S}:{A}` when no version is known), `retrievedAt` |

`hadith` records are not resolved yet (Station 4 comes after the Monday gate). Every other record type is left untouched.

The script only fills text. Review and approval stay with Hussein and the scholar.

## Commands

```
npm run snapshot -- --list           # discovery only; writes nothing
npm run snapshot -- --inspect-kfc    # shape of the KFC file (keys and count, never text)
npm run snapshot -- --dry-run        # resolve everything; print planned changes; write only the run log
npm run snapshot                     # apply
npm run snapshot -- --station S1     # limit to one station (default: all)
npm run snapshot -- --refresh        # allow re-snapshotting already-filled draft records
npm run test:snapshot                # offline tests (mocked fetch, fixture data only)
```

**Exit codes:**
- `0`: no `[VERIFY` left
- `2`: unresolved `[VERIFY` items remain (each is listed with its id and JSON path)
- `1`: error or abort, with nothing written

**Run log:** every dry-run or apply writes `content/snapshots/{UTC timestamp}[-dry-run].json`. It records sources, versions, hashes, request URLs and the action for each record. It is the input for SOURCES.md.

**Configuration:** `config.json`. The KFC field names, the QuranEnc translation key and the reciter selector are assumptions until they are confirmed with `--list` and `--inspect-kfc`.

## Guards (enforced in code, each covered by a test)

- **G1:** Only these fields may change: `text`, `sourcePlatform`, `platformId` and `retrievedAt` on draft `quran`/`tafsir` records, and `recitation.*` on draft `quran` records. Every record is deep-diffed before and after the run; any other change aborts the whole run and nothing is written.
- **G2:** Records with status `approved` or `rejected` are never modified. If one still contains `[VERIFY`, it is reported as a review error.
- **G3:** An already-filled draft record is re-fetched and compared. If nothing changed, it is left alone. If something changed, the script reports `DRIFT` and does not overwrite unless `--refresh` is given.
- **G4:** Writes are atomic (temp file, then rename). Files are UTF-8 without BOM, 2-space indent, with a trailing newline. Key order is preserved, and new keys are appended at the end of their object.
- **G5:** Only HTTPS requests to `quranenc.com`, `mp3quran.net` and `*.mp3quran.net`, including redirects. 20 s timeout. 3 retries with backoff, on network errors and 5xx only. User-Agent `MIZAN-snapshot/1.0 (Islamic AI Challenge entry)`. No API keys.
- **G6:** After the run, every string is scanned for `[VERIFY`.
- **G7:** App code never imports from `/scripts` (R9), and this script imports nothing from app code.
- **G8:** Tests and fixtures use placeholder strings only. The code and tests contain no Arabic script.

QuranEnc's `arabic_text` field is never stored: verse text comes only from the KFC file. Dry-run output shows source text as length + hash, never verbatim.

## Source access routes

- King Fahd Complex Qur'an text: KFGQPC Hafs Uthmanic Data v2.0 (read.me dated 2022-09-07), file hafsData_v2-0.json from UthmanicHafs_v2-0.zip, obtained from: https://download.qurancomplex.gov.sa/resources_dev/UthmanicHafs_v2-0.zip
- The routes listed in the Reference Package (15-page edition) and Runbook §5.1 (qurancomplex.gov.sa/quran-dev), and the Complex's announced route (qurancomplex.gov.sa/techquran/dev), did not resolve from Hussein's network on 3 Oct 2026.

- QuranEnc tafsir: `GET /api/v1/translations/list/ar` returned no Arabic entries on 3 Oct 2026, so `arabic_mokhtasar` is "unlisted". An unlisted key is still accepted, but only per ayah: the ayah endpoint must return HTTP 200, the requested sura/aya, and a non-empty `translation` in which at least 90% of the letters are Arabic script. Otherwise the run stops. The run log records `version: null` and `listStatus: "unlisted"`, and the platformId has no `:v{version}` part.

`config.kfc.sourceUrl` and `config.kfc.sourceVersion` record the KFC route. Each run log copies them into `sources.kfc`, next to the file name, size and SHA-256. The field map is `id`, `sura_no`, `aya_no`, `aya_text`. `aya_text_emlaey` (the simplified spelling) is never used.

## Notes

- The raw KFC file stays out of git (`sources/kfc/*.json` is in `.gitignore`) until its licence is verified. Its name, size and SHA-256 are recorded in the run log.
- `package.json` was created here with no dependencies. **Sunday's Next.js scaffold must merge into this `package.json`, never overwrite it.** Keep the `snapshot` and `test:snapshot` scripts.

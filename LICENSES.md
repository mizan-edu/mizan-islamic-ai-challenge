# Licences

Third-party items used by MIZAN, one section each, with owners and terms (D53). MIZAN's own code is MIT (`LICENSE`); its original content (Arabic UI and narration texts, narration audio, AI-generated pictures and sound effects) is CC BY-NC-SA 4.0 (`CONTENT-LICENSE.md`). Third-party items keep their own terms below.

**Experience upgrade (D54–D57, 5 Oct 2026):** no third-party item was added. The motion, moment scenes, AI lens, parental gate, Parent Ask and summary card use only MIZAN's own code (MIT) and the packages already listed here. The moment scenes draw abstract shapes in CSS and SVG over the approved pictures already listed in `public/images/IMAGES.json`; no picture, sound or font was added or changed. The new Arabic labels and parent-page wording (D55–D57) are MIZAN original content under CC BY-NC-SA 4.0.

## KFGQPC Uthmanic Script HAFS font

Official KFGQPC Uthmanic Script HAFS font v2.0 (vendor URL fonts.qurancomplex.gov.sa), unchanged. Obtained 2026-10-03 from the Internet Archive snapshot (2025-04-17) of the official URL https://download.qurancomplex.gov.sa/resources_dev/UthmanicHafs_v2-0.zip because the official hosts did not respond. Licence: KFGQPC Electronic End-User License Agreement (embedded; full text in public/fonts/KFGQPC-LICENSE.txt): free of cost; use, copy and distribute permitted; no selling, modification, reverse-engineering or reproduction without the Complex's written approval. Compliance: byte-identical, licence shipped alongside, no WOFF2, no subsetting, plain @font-face, used only to display Qur'an text pulled from KFC by ID.

- **File:** `public/fonts/uthmanic_hafs_v20.ttf`
  - Original name inside the package: `UthmanicHafs_v2-0 font/uthmanic_hafs_v20.ttf`
  - SHA-256 `d560bbbc7a90a4f4d416d206a5ac48bd8a1ad00273d64d232f16ca54941bd041`
  - name table "Version 2.0"
- **Package:** `UthmanicHafs_v2-0.zip`, SHA-256 `a7b0e5591945712ec5e4d6142938ae4d1e9b49bdc89dff06222789bfebdfd72c`
- **Owner:** King Fahd Glorious Qur'an Printing Complex, Madinah.
- **Supporting evidence (DSIG):** the font carries a DSIG digital signature. Its signing certificate is issued to "King Fahd Glorious Quran Printing complex" by DigiCert SHA2 Assured ID Code Signing CA. The certificate names were read; the signature was not cryptographically verified.

## King Fahd Complex Qur'an text (hafsData v2.0)

- **What:** the official KFGQPC Hafs Uthmanic Data v2.0, file `hafsData_v2-0.json` (6,236 verses), from the package `UthmanicHafs_v2-0.zip` (SHA-256 above). The JSON's SHA-256 is `d2960b3217962e7e4252abdcece67bea3d6b48271e4cd3af45bbbb2dd5c872ca`.
- **Route (D21):** retrieved on 2026-10-03 from the Internet Archive snapshot (2025-04-17) of the official URL, because the official hosts did not respond. Re-checked on 2026-10-05 13:13–13:14 UTC: the hosts still time out, so no new comparison was possible (decisions.md, "D21 re-check").
- **Use:** only the verses used by the stations are copied, byte-identical, into `content/stations/*.json`. Each copy carries its `kfc-hafs:{id}` platform ID and retrieval date, and the citation validator checks every displayed verse against the stored text. The raw file is not redistributed (`sources/kfc/*` is git-ignored).
- **Owner and terms:** King Fahd Glorious Qur'an Printing Complex, Madinah. The text is used unchanged, for display, under the Complex's terms for its published data.

## QuranEnc tafsir (arabic_mokhtasar)

- **What:** the QuranEnc Arabic tafsir with key `arabic_mokhtasar`, ayah by ayah, for the station verses only (3 records). Platform IDs are `quranenc:arabic_mokhtasar:{sura}:{aya}`, retrieved on 2026-10-03.
- **Version:** QuranEnc returned no version for this key (it is unlisted). The snapshot records `version: null` and `listStatus: unlisted` (`content/snapshots/20261003T102742Z.json`).
- **Use:** shown to parents only, separately from the verse text, never spoken (D15).
- **Owner and terms:** QuranEnc (quranenc.com), under the platform's terms of use.

## mp3quran.net recitation (Sheikh Mahmoud Khalil Al-Husary)

- **What:** the recitation by Sheikh Mahmoud Khalil Al-Husary, rewaya Hafs from Asim (reciter 118, moshaf 118, folder `husr`). Ayah start and end timings come from the mp3quran.net API (D16).
- **Use:** streamed from mp3quran.net at runtime. This is the only permitted runtime call to an external content source; the audio is not copied into this repository. If the audio fails, the verse text is shown without it.
- **Owner and terms:** mp3quran.net, under the platform's terms of use.

## Noto Naskh Arabic (UI font)

- **Package:** `@fontsource/noto-naskh-arabic` 5.3.0 (Fontsource, npm), self-hosted from the build. There are no runtime font requests to third parties.
- **Use:** UI text only. The Arabic and Latin subsets are loaded at weights 400 and 700. It is never used for Qur'an text, which uses the KFGQPC font above.
- **Owner:** The Noto Project Authors (https://github.com/notofonts/arabic), copyright 2022.
- **Licence:** SIL Open Font License, Version 1.1.
  - Full text: `public/fonts/NotoNaskhArabic-OFL.txt`, copied verbatim from the package's `LICENSE` (SHA-256 `91053c23e8a0fe5fc9b5fdbe5ff74ceffd66f6f996c123f1a6ca4c23487c1fff`).
  - The font files are used as published by Fontsource; MIZAN does not modify or rename them.

## Baloo Bhaijaan 2 (display font)

- **Package:** `@fontsource/baloo-bhaijaan-2` 5.3.0 (Fontsource, npm), pinned exactly in package.json and package-lock.json.
- **Self-hosted:** the woff2 files are bundled by `next/font/local` (app/layout.tsx) and served from the app's own origin. Child devices make no third-party font requests.
- **Use:** headings, buttons and child lines («حديقة الآيات» design, built 4–6 Oct). Weights 700 and 800, Arabic and Latin subsets. It is never used for Qur'an text, which uses the KFGQPC font above. Body and parent text stay in Noto Naskh Arabic.
- **Files (SHA-256):**
  - `baloo-bhaijaan-2-arabic-700-normal.woff2` d14d2500adfe6d1e2b78962e2131e5aa61cecf3e66cd2d4f6cb1a728fff97880
  - `baloo-bhaijaan-2-arabic-800-normal.woff2` 6607c57381fb866acfab32bf8683c09f5fc3d810d39f20261bae8d661b4ad44f
  - `baloo-bhaijaan-2-latin-700-normal.woff2` 2b14379a28bd7e3dcb803c79ea94768f9a292e1f7ae0adf5323e62bb2f255591
  - `baloo-bhaijaan-2-latin-800-normal.woff2` e23687948b255f58f5f31263669e67214b565a71165949549156dd808a96a42a
- **Owner:** The Baloo 2 Project Authors (https://github.com/EkType/Baloo2), copyright 2019.
- **Licence:** SIL Open Font License, Version 1.1.
  - Full text: `public/fonts/BalooBhaijaan2-OFL.txt`, copied verbatim from the package's `LICENSE` (SHA-256 `273d4bb4d30d7f7011adfa11ee858b1d70a6b1f94cae89e6fa261ed8f1b8839a`).
  - The font files are used as published by Fontsource; MIZAN does not modify or rename them.

## Narration audio (ElevenLabs)

- **Files:** `public/audio/S1–S3/*.mp3`, one per approved narratable line; each station's `manifest.json` records the text SHA-256, voice, model and date per file.
- **Voice and model:** ElevenLabs voice Hams (`29hj550woDeJpvjtiu26`), model `eleven_v3`, output `mp3_44100_128` (D28). All 93 narrated lines are on `eleven_v3`: 82 regenerated 2026-10-05 from fully vocalized text, and the 11 whose new text was approved at Scholar Review 3 (D46) regenerated the same day.
- **Never Qur'an:** quran, tafsir and hadith records are never sent; every line passes the app's TTS guard and the citation validator's Qur'anic-text checks (R4).
- **Licence:** generated under the project account's ElevenLabs **Scale** plan, which includes commercial use of generated audio, under the ElevenLabs Terms of Service: https://elevenlabs.io/terms-of-use. MIZAN's narration texts and audio are also CC BY-NC-SA 4.0 (CONTENT-LICENSE.md).

## Sound effects (ElevenLabs Sound Effects)

- **Files:** `public/audio/sfx/tap.mp3`, `correct.mp3`, `tryAgain.mp3`, `momentS1.mp3`, `momentS2.mp3`, `momentS3.mp3`, `close.mp3` (7 files; D40).
- **Source:** ElevenLabs Sound Effects, model `eleven_text_to_sound_v2`, generated 2026-10-04 and approved by Hussein. Nature/foley sounds only, no musical instruments.
- **Processing:** ffmpeg (silence trimmed, length capped, 30 ms fade-in, 150 ms fade-out, normalised to -20 LUFS, mono 64 kbps MP3).
- **Never with Qur'an:** no effect plays while a recitation is playing; a running effect stops when one starts (D38). Parents can turn all effects off.
- **Licence:** generated under the project account's ElevenLabs **Scale** plan, under the ElevenLabs Terms of Service: https://elevenlabs.io/terms-of-use.

## Pictures (GPT Image 2.5 via Higgsfield)

- **What:** the station pictures, journey map, station icons and plant-marker stages in `public/images/`, all AI-generated with GPT Image 2.5 through Higgsfield (2026-10-04) and approved by Hussein (D32). The S2.N2 picture was also approved by the scholar reviewer (D46). `public/images/IMAGES.json` lists each file with its source, original file name and SHA-256.
- **Licence:** generated under the project's existing Higgsfield subscription, under Higgsfield's terms of service. They are also CC BY-NC-SA 4.0 as MIZAN content (CONTENT-LICENSE.md).

## OpenAI API (classifier fallback: built, disabled, not used in this submission)

- **Status (D44):** a secondary classifier provider via the OpenAI API is built in the code (A4, D42) but disabled: `LLM_FALLBACK_MODEL` is not set in any environment, so no request is ever sent to OpenAI. It was not tested against the live API and is not used in this submission. When the primary (Anthropic) fails, the app goes straight to the static tier (the station's approved fallback).
- **If enabled later:** the model would come from `LLM_FALLBACK_MODEL` (never hard-coded) with the key in `OPENAI_API_KEY`; it would receive only the classifier prompt, the anonymous question text and the candidate record IDs with their approved non-Qur'anic text (verses and tafsir by reference only), never personal data, and would return a level and a record ID validated exactly as the primary's output.

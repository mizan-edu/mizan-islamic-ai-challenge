# Licences

Third-party components shipped with MIZAN, with their owners and licence terms.

## KFGQPC Uthmanic Script HAFS font

Official KFGQPC Uthmanic Script HAFS font v2.0 (vendor URL fonts.qurancomplex.gov.sa), unchanged. Obtained 2026-10-03 from the Internet Archive snapshot (2025-04-17) of the official URL https://download.qurancomplex.gov.sa/resources_dev/UthmanicHafs_v2-0.zip because the official hosts did not respond. Licence: KFGQPC Electronic End-User License Agreement (embedded; full text in public/fonts/KFGQPC-LICENSE.txt): free of cost; use, copy and distribute permitted; no selling, modification, reverse-engineering or reproduction without the Complex's written approval. Compliance: byte-identical, licence shipped alongside, no WOFF2, no subsetting, plain @font-face, used only to display Qur'an text pulled from KFC by ID.

- **File:** `public/fonts/uthmanic_hafs_v20.ttf`
  - Original name inside the package: `UthmanicHafs_v2-0 font/uthmanic_hafs_v20.ttf`
  - SHA-256 `d560bbbc7a90a4f4d416d206a5ac48bd8a1ad00273d64d232f16ca54941bd041`
  - name table "Version 2.0"
- **Package:** `UthmanicHafs_v2-0.zip`, SHA-256 `a7b0e5591945712ec5e4d6142938ae4d1e9b49bdc89dff06222789bfebdfd72c`
- **Owner:** King Fahd Glorious Qur'an Printing Complex, Madinah.
- **Supporting evidence (DSIG):** the font carries a DSIG digital signature. Its signing certificate is issued to "King Fahd Glorious Quran Printing complex" by DigiCert SHA2 Assured ID Code Signing CA. The certificate names were read; the signature was not cryptographically verified.

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
- **Voice and model:** ElevenLabs voice Hams (`29hj550woDeJpvjtiu26`), model `eleven_v3`, output `mp3_44100_128` (D28). 82 lines regenerated 2026-10-05 from fully vocalized text. 11 lines whose new text awaits the scholar's Review 2 keep their earlier audio (same voice, model `eleven_multilingual_v2`, 2026-10-04) until approved.
- **Never Qur'an:** quran, tafsir and hadith records are never sent; every line passes the app's TTS guard and the citation validator's Qur'anic-text checks (R4).
- **Licence:** generated under the ElevenLabs plan of the project account. [Terms to be confirmed and linked by Hussein before submission.]

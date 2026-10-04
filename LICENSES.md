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

// Surah names from the KFC hafsData v2.0 metadata (content/kfc-surahs.json, written by
// npm run snapshot:surahs), never typed by hand. Used for {verseRef} and for spotting a question
// that names the wrong surah for a quoted verse.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { findContentDir } from './content';
import { normalizeArabic } from './normalize';

export type SurahNames = Map<number, string>;

export function loadSurahNames(contentDir: string = findContentDir()): SurahNames {
  const file = path.join(contentDir, 'kfc-surahs.json');
  if (!existsSync(file)) return new Map();
  const doc = JSON.parse(readFileSync(file, 'utf8')) as { surahs: { number: number; nameAr: string }[] };
  return new Map(doc.surahs.map((s) => [s.number, s.nameAr]));
}

// Surah numbers the question names, as «سورة <name>» (with or without the article). A bare name is
// not enough: many surah names are everyday words (the moon, the bees, thunder).
export function namedSurahs(text: string, surahs: SurahNames): number[] {
  const q = ` ${normalizeArabic(text)} `;
  const out: number[] = [];
  for (const [n, name] of surahs) {
    const full = normalizeArabic(name);
    const bare = full.startsWith('ال') ? full.slice(2) : full;
    if (q.includes(` سوره ${full} `) || q.includes(` سوره ${bare} `)) out.push(n);
  }
  return out;
}

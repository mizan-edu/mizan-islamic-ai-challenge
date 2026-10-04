// Citation validator (CLAUDE.md §5.1 step 5; R1, R3, R7). A reply passes only if:
// - every cited or shown record ID exists in the approved library (unknown, draft, rejected => fail);
// - every verse segment is a quran record whose text is byte-equal to the stored text and is not spoken;
// - every library text segment is byte-equal to its record, and is not quran/tafsir/hadith;
// - generated text (NA rephrasing only) carries no Qur'anic marks, no verse wording, no hadith
//   wording, does not name Allah, and stays short;
// - no hadith record appears anywhere.
// On failure the pipeline returns the station fallback instead.

import { normalizeArabic } from './normalize';
import type { Library } from './library';
import type { Reply } from './reply';
import { isRephrasable } from './reply';

const sameBytes = (a: string, b: string): boolean => Buffer.from(a, 'utf8').equals(Buffer.from(b, 'utf8'));

// Qur'anic annotation marks, alef wasla, KFC ayah-number glyphs, ornate parentheses, end-of-ayah sign.
// (U+0670 superscript alef is excluded: ordinary vowelled Arabic uses it.)
const QURAN_MARKS = /[\u06D6-\u06ED\u0671\uFC00-\uFC63\uFD3E\uFD3F]/;
export const hasQuranMarks = (text: string): boolean => QURAN_MARKS.test(text);

// Phrases that introduce hadith (normalized), plus the sallallahu alayhi wa sallam ligature.
const HADITH_MARKERS = ['رسول الله', 'صلي الله عليه وسلم', 'قال النبي', 'عن النبي', 'حديث', 'رواه', 'روي'].map(normalizeArabic);
export const hasHadithWording = (text: string): boolean => {
  if (text.includes('\uFDFA')) return true;
  const n = ` ${normalizeArabic(text)} `;
  return HADITH_MARKERS.some((m) => n.includes(` ${m} `) || n.includes(` ${m}`));
};

const ALLAH = [normalizeArabic('الله'), normalizeArabic('لله')];
const namesAllah = (text: string): boolean => normalizeArabic(text).split(' ').some((w) => ALLAH.some((a) => w.endsWith(a)));

// Any 4 consecutive words of an approved verse (normalized) inside the text.
export function containsVerseWording(lib: Library, text: string, window = 4): boolean {
  const hay = ` ${normalizeArabic(text)} `;
  for (const v of lib.verses) {
    const words = normalizeArabic(v.text).split(' ').filter(Boolean);
    for (let i = 0; i + window <= words.length; i++) if (hay.includes(` ${words.slice(i, i + window).join(' ')} `)) return true;
  }
  return false;
}

export type Validation = { ok: true } | { ok: false; reasons: string[] };

export function validateReply(lib: Library, reply: Reply): Validation {
  const reasons: string[] = [];
  const ids = new Set([...reply.citations, ...reply.segments.map((s) => s.recordId)]);
  for (const id of ids) {
    const r = lib.byId.get(id);
    if (!r) reasons.push(`unknown or non-approved record ${id}`);
    else if (r.type === 'hadith') reasons.push(`hadith record ${id}`);
  }
  if (!reply.segments.length) reasons.push('empty reply');

  for (const s of reply.segments) {
    const r = lib.byId.get(s.recordId);
    if (!r) continue;
    if (s.kind === 'verse') {
      if (r.type !== 'quran') reasons.push(`${s.recordId}: verse segment is not a quran record`);
      else if (!sameBytes(s.text, r.text)) reasons.push(`${s.recordId}: verse text differs from the stored text`);
      if (s.speakable || s.source !== 'library') reasons.push(`${s.recordId}: verse must be library-sourced and never spoken`);
      continue;
    }
    if (r.type === 'quran' || r.type === 'tafsir' || r.type === 'hadith') reasons.push(`${s.recordId}: ${r.type} text outside a verse/tafsir panel`);
    if (s.source === 'library') {
      if (!sameBytes(s.text, r.text)) reasons.push(`${s.recordId}: text differs from the approved record`);
      if (hasQuranMarks(s.text)) reasons.push(`${s.recordId}: Qur'anic marks in a text segment`);
      continue;
    }
    // generated
    if (!isRephrasable(r)) reasons.push(`${s.recordId}: only NA science/UI lines may be rephrased`);
    if (hasQuranMarks(s.text) || containsVerseWording(lib, s.text)) reasons.push(`${s.recordId}: generated text contains Qur'anic text`);
    if (hasHadithWording(s.text)) reasons.push(`${s.recordId}: generated text contains hadith wording`);
    if (namesAllah(s.text)) reasons.push(`${s.recordId}: generated NA text adds Islamic content`);
    const limit = Math.max(Math.ceil(r.text.length * 1.5), r.text.length + 40);
    if (!s.text.trim() || s.text.length > limit) reasons.push(`${s.recordId}: generated text length out of bounds`);
  }
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

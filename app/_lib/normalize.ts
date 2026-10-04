// Arabic normalization for matching only (CLAUDE.md §5.3). Never applied to stored or displayed text.

// Harakat, Qur'anic annotation marks, superscript alef, tatweel.
const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
// KFC ayah-number glyphs and ornate parentheses: never part of a matching key.
const AYAH_GLYPHS = /[\uFC00-\uFC63\uFD3E\uFD3F\u06DD\u06DE]/g;
const PUNCT = /[،؛؟٪-٭۔«»"'()[\]{}.,!?;:\-–—_/\\*]/g;

export function normalizeArabic(text: string): string {
  return text
    .normalize('NFC')
    .replace(MARKS, '')
    .replace(AYAH_GLYPHS, ' ')
    .replace(/[آأإ\u0671]/g, 'ا') // alef variants -> bare alef
    .replace(/ى/g, 'ي') // alef maqsura -> ya
    .replace(/ة/g, 'ه') // ta marbuta -> ha
    .replace(/ؤ/g, 'و') // waw hamza -> waw
    .replace(/ئ/g, 'ي') // ya hamza -> ya
    .replace(PUNCT, ' ')
    .replace(/\u00A0/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Question words and particles that carry no topic (MSA + Levantine dialect).
const STOP = new Set(
  ['هل', 'من', 'في', 'على', 'الي', 'الى', 'عن', 'ما', 'ماذا', 'كيف', 'لماذا', 'ليش', 'شو', 'وين', 'مين',
    'هو', 'هي', 'ان', 'او', 'و', 'يا', 'هذا', 'هذه', 'هاي', 'اللي', 'التي', 'الذي', 'كمان', 'ايضا', 'لي', 'انا']
    .map((w) => normalizeArabic(w)),
);

// Light stemming for matching: drop a leading conjunction waw and the definite article.
function stem(token: string): string {
  let t = token;
  if (t.length > 3 && t.startsWith('و')) t = t.slice(1); // و
  if (t.length > 3 && t.startsWith('ال')) t = t.slice(2); // ال
  return t;
}

export function tokens(text: string): string[] {
  return normalizeArabic(text)
    .split(' ')
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}

// Share of `target` tokens that appear in `source` (0..1), with the shared count.
export function containment(source: string[], target: string[]): { score: number; shared: number } {
  if (!target.length) return { score: 0, shared: 0 };
  const have = new Set(source);
  const uniq = [...new Set(target)];
  const shared = uniq.filter((t) => have.has(t)).length;
  return { score: shared / uniq.length, shared };
}

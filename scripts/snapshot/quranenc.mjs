// QuranEnc tafsir. Only result.translation (the tafsir text) is ever kept.
// result.arabic_text is never read: verse text comes only from the KFC file.

export const QURANENC_BASE = 'https://quranenc.com/api/v1';

export class QuranEncError extends Error {}

export const listUrl = () => `${QURANENC_BASE}/translations/list/ar`;
export const ayaUrl = (key, surah, ayah) => `${QURANENC_BASE}/translation/aya/${encodeURIComponent(key)}/${surah}/${ayah}`;

// "tafsir" in Latin script, or the Arabic word for tafsir (built from code points so the source stays ASCII, G8).
const TAFSIR_AR = String.fromCharCode(0x062a, 0x0641, 0x0633, 0x064a, 0x0631);
const TAFSIR_PATTERN = new RegExp(`tafsir|tafseer|${TAFSIR_AR}`, 'i');

export async function fetchArabicTranslations(http) {
  const data = await http.getJson(listUrl());
  if (!data || typeof data !== 'object' || !Array.isArray(data.translations)) {
    throw new QuranEncError(`unexpected list shape: top-level keys [${Object.keys(data ?? {}).join(', ')}]`);
  }
  data.translations.forEach((t, i) => {
    for (const f of ['key', 'title', 'version']) {
      if (typeof t?.[f] !== 'string') throw new QuranEncError(`list entry ${i} has no string field "${f}"`);
    }
  });
  return data.translations;
}

export const isTafsirEntry = (t) => TAFSIR_PATTERN.test(`${t.key} ${t.title} ${t.description ?? ''}`);

// A key absent from the list is not an error: it is "unlisted" (no title/version), and each
// ayah response must then prove the key by passing the Arabic-script check in fetchAyaTafsir.
export function resolveTranslation(list, key) {
  const t = list.find((x) => x.key === key);
  if (!t) return { key, title: null, version: null, listStatus: 'unlisted' };
  return { key: t.key, title: t.title, version: t.version, listStatus: 'listed' };
}

// "quranenc:{key}:v{version}:{S}:{A}" when the version is known, else "quranenc:{key}:{S}:{A}".
export const tafsirPlatformId = ({ key, version }, surah, ayah) => `quranenc:${key}${version ? `:v${version}` : ''}:${surah}:${ayah}`;

// True when at least 90% of the letters are in Arabic script.
export function isArabicScript(text) {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (!letters.length) return false;
  return letters.filter((c) => /\p{Script=Arabic}/u.test(c)).length / letters.length >= 0.9;
}

export async function fetchAyaTafsir(http, key, surah, ayah, { requireArabic = false } = {}) {
  const url = ayaUrl(key, surah, ayah);
  const data = await http.getJson(url);
  const r = data?.result;
  if (!r || typeof r !== 'object') {
    throw new QuranEncError(`${url}: unexpected shape, top-level keys [${Object.keys(data ?? {}).join(', ')}]`);
  }
  if (String(r.sura) !== String(surah) || String(r.aya) !== String(ayah)) {
    throw new QuranEncError(`${url}: response is for ${r.sura}:${r.aya}, not ${surah}:${ayah}`);
  }
  if (typeof r.translation !== 'string' || r.translation.length === 0) {
    throw new QuranEncError(`${url}: result.translation is missing or empty`);
  }
  if (requireArabic && !isArabicScript(r.translation)) {
    throw new QuranEncError(`${url}: unlisted key "${key}" rejected, result.translation is not in Arabic script`);
  }
  return { text: r.translation, footnotes: r.footnotes || null, requestUrl: url };
}

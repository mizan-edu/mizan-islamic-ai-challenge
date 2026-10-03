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

export function findTranslation(list, key) {
  const t = list.find((x) => x.key === key);
  if (!t) {
    throw new QuranEncError(`translation key "${key}" is not in ${listUrl()} (${list.length} entries); cannot resolve title/version for platformId`);
  }
  return { key: t.key, title: t.title, version: t.version };
}

export async function fetchAyaTafsir(http, key, surah, ayah) {
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
  return { text: r.translation, footnotes: r.footnotes || null, requestUrl: url };
}

// mp3quran.net recitation: timing read selection, reciter/moshaf match,
// per-surah audio URL and per-ayah timings.

export const MP3QURAN_BASE = 'https://mp3quran.net/api/v3';
const MAX_AYAH_MS = 5 * 60 * 1000;

export class Mp3QuranError extends Error {}

export const readsUrl = () => `${MP3QURAN_BASE}/ayat_timing/reads`;
export const recitersUrl = () => `${MP3QURAN_BASE}/reciters?language=ar`;
export const timingUrl = (surah, readId) => `${MP3QURAN_BASE}/ayat_timing?surah=${surah}&read=${readId}`;

export const normalizeFolder = (url) => (url.endsWith('/') ? url : `${url}/`);
export const audioUrlFor = (folderUrl, surah) => `${normalizeFolder(folderUrl)}${String(surah).padStart(3, '0')}.mp3`;
const describeRead = (r) => `${r.id} | ${r.name} | ${r.rewaya} | ${r.folder_url}`;

export async function fetchReads(http) {
  const data = await http.getJson(readsUrl());
  if (!Array.isArray(data)) throw new Mp3QuranError(`${readsUrl()}: expected an array, got ${typeof data}`);
  data.forEach((r, i) => {
    if (typeof r?.id !== 'number' || typeof r.name !== 'string' || typeof r.rewaya !== 'string' || typeof r.folder_url !== 'string') {
      throw new Mp3QuranError(`${readsUrl()}: entry ${i} lacks id/name/rewaya/folder_url (keys: ${Object.keys(r ?? {}).join(', ')})`);
    }
  });
  return data;
}

export function selectRead(reads, { timingReadId, reciterNameContains, requiredRewayaContains }) {
  const byId = timingReadId !== null && timingReadId !== undefined;
  const matches = byId ? reads.filter((r) => r.id === timingReadId) : reads.filter((r) => r.name.includes(reciterNameContains));
  const selector = byId ? `timingReadId=${timingReadId}` : `reciterNameContains="${reciterNameContains}"`;
  if (matches.length !== 1) {
    const list = matches.length ? `\n  ${matches.map(describeRead).join('\n  ')}` : ' (run --list to see all reads)';
    throw new Mp3QuranError(`read selector ${selector} matched ${matches.length} reads; exactly one is required. Candidates:${list}`);
  }
  const read = matches[0];
  if (!read.rewaya.includes(requiredRewayaContains)) {
    throw new Mp3QuranError(`read ${read.id} rewaya "${read.rewaya}" does not contain "${requiredRewayaContains}" (must match the KFC text)`);
  }
  return read;
}

export async function fetchReciters(http) {
  const data = await http.getJson(recitersUrl());
  if (!data || !Array.isArray(data.reciters)) {
    throw new Mp3QuranError(`${recitersUrl()}: unexpected shape, top-level keys [${Object.keys(data ?? {}).join(', ')}]`);
  }
  return data.reciters;
}

// The reciter + moshaf whose server URL equals the read's folder URL, or null.
export function matchReciter(reciters, folderUrl) {
  const target = normalizeFolder(folderUrl);
  const hits = [];
  for (const rec of reciters) {
    for (const m of Array.isArray(rec?.moshaf) ? rec.moshaf : []) {
      if (typeof m?.server === 'string' && normalizeFolder(m.server) === target) hits.push({ reciterId: rec.id, moshafId: m.id });
    }
  }
  return hits.length === 1 ? { ...hits[0], matches: 1 } : { reciterId: null, moshafId: null, matches: hits.length };
}

export async function verifyAudio(http, url) {
  const res = await http.head(url);
  if (res.status !== 200 || !res.contentType.toLowerCase().startsWith('audio/')) {
    throw new Mp3QuranError(`HEAD ${url}: expected 200 + audio/*, got ${res.status} ${res.contentType || '(no content-type)'}`);
  }
  return res;
}

export async function fetchTimings(http, surah, readId) {
  const url = timingUrl(surah, readId);
  const data = await http.getJson(url);
  if (!Array.isArray(data)) throw new Mp3QuranError(`${url}: expected an array, got ${typeof data}`);
  data.forEach((e, i) => {
    if (typeof e?.ayah !== 'number') throw new Mp3QuranError(`${url}: entry ${i} has no numeric ayah (keys: ${Object.keys(e ?? {}).join(', ')})`);
  });
  return { url, entries: data };
}

export function ayahTiming(entries, ayah, url = 'timings') {
  const own = entries.filter((e) => e.ayah === ayah);
  if (own.length !== 1) throw new Mp3QuranError(`${url}: ${own.length} entries for ayah ${ayah}; exactly one is required`);
  const { start_time: start, end_time: end } = own[0];
  if (!Number.isInteger(start) || !Number.isInteger(end)) throw new Mp3QuranError(`${url}: ayah ${ayah} start/end are not integers`);
  if (!(end > start)) throw new Mp3QuranError(`${url}: ayah ${ayah} end_time ${end} <= start_time ${start}`);
  const next = entries.find((e) => e.ayah === ayah + 1);
  if (next && !(end <= next.start_time)) throw new Mp3QuranError(`${url}: ayah ${ayah} ends after ayah ${ayah + 1} starts`);
  if (end - start >= MAX_AYAH_MS) throw new Mp3QuranError(`${url}: ayah ${ayah} lasts ${end - start} ms (limit ${MAX_AYAH_MS})`);
  return { startMs: start, endMs: end };
}

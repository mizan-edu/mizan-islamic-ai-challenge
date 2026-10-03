// Shared fixtures for the snapshot tests. Placeholder strings only (G8):
// no real verse, tafsir or hadith text, and no Arabic script, anywhere in tests.

import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const NOW = new Date('2026-10-03T12:00:00.000Z');
export const OLD = '2026-10-01T09:00:00.000Z';
export const ARABIC_TEXT_SENTINEL = 'FIXTURE_ARABIC_TEXT_MUST_NOT_BE_STORED';
export const FOLDER = 'https://server9.mp3quran.net/fixture'; // no trailing slash on purpose
export const AUDIO_16 = 'https://server9.mp3quran.net/fixture/016.mp3';

export const config = () => ({
  kfc: { file: 'sources/kfc/fixture.json', sourceUrl: 'https://fixture.invalid/kfc.zip', sourceVersion: '0.0-fixture', expectedAyahCount: 3, fields: { id: 'id', sura: 'sura_no', aya: 'aya_no', text: 'aya_text' } },
  quranenc: { translationKey: 'fixture_tafsir' },
  mp3quran: { timingReadId: null, reciterNameContains: 'FIXTURE_RECITER', requiredRewayaContains: 'FIXTURE_HAFS' },
});

export const kfcEntries = () => [
  { id: 101, sura_no: 16, aya_no: 10, aya_text: 'FIXTURE_TEXT_16_10' },
  { id: 102, sura_no: 16, aya_no: 11, aya_text: 'FIXTURE_TEXT_16_11' },
  { id: 103, sura_no: 50, aya_no: 9, aya_text: 'FIXTURE_TEXT_50_9' },
];

const reviewers = { reviewer1: null, reviewer1At: null, reviewer2: null, reviewer2At: null };

export const quranRecord = (over = {}) => ({
  id: 'S9.V1', station: 'S9', type: 'quran', text: '[VERIFY: qurancomplex.gov.sa]', sourcePlatform: 'King Fahd Complex',
  platformId: '[VERIFY: KFC ayah ID 16:10]', reference: '16:10',
  recitation: { platform: 'mp3quran.net', reciterId: '[VERIFY]', moshafId: '[VERIFY]', audioUrl: '[VERIFY]', startMs: null, endMs: null },
  level: 'A', tts: false, retrievedAt: null, ...reviewers, status: 'draft', ...over,
});

export const tafsirRecord = (over = {}) => ({
  id: 'S9.T1', station: 'S9', type: 'tafsir', text: '[VERIFY: quranenc.com]', sourcePlatform: 'QuranEnc',
  platformId: '[VERIFY: QuranEnc tafsir key + 16:10]', reference: '16:10', level: 'A', tts: false, retrievedAt: null,
  ...reviewers, status: 'draft', ...over,
});

export const uiRecord = (over = {}) => ({
  id: 'S9.F1', station: 'S9', type: 'ui', role: 'frame', text: 'FIXTURE_UI_TEXT', level: 'NA', tts: true, status: 'draft', ...over,
});

export const stationDoc = (records) => ({
  meta: { stationId: 'S9', contentVersion: '0.1-draft', status: 'draft' },
  script: [{ step: 'frame', recordIds: ['S9.F1'] }],
  records,
});

// A throwaway repo root holding one station file and the fixture KFC file.
export async function makeRepo(records = [uiRecord(), quranRecord(), tafsirRecord()], { kfc = kfcEntries() } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'mizan-snapshot-'));
  await mkdir(join(root, 'content', 'stations'), { recursive: true });
  await mkdir(join(root, 'sources', 'kfc'), { recursive: true });
  const stationFile = join(root, 'content', 'stations', 'S9.json');
  await writeFile(stationFile, `${JSON.stringify(stationDoc(records), null, 2)}\n`);
  await writeFile(join(root, 'sources', 'kfc', 'fixture.json'), JSON.stringify(kfc));
  return { root, stationFile };
}

export const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

export async function snapshotLogs(root) {
  try {
    return (await readdir(join(root, 'content', 'snapshots'))).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const routes = () => ({
  'GET https://quranenc.com/api/v1/translations/list/ar': () => json({
    translations: [{ key: 'fixture_tafsir', title: 'FIXTURE_TITLE', version: '1.2.3', description: 'FIXTURE tafsir' }],
  }),
  'GET https://quranenc.com/api/v1/translation/aya/fixture_tafsir/16/10': () => json({
    result: { id: '1', sura: '16', aya: '10', arabic_text: ARABIC_TEXT_SENTINEL, translation: 'FIXTURE_TAFSIR_16_10', footnotes: null },
  }),
  'GET https://quranenc.com/api/v1/translation/aya/fixture_tafsir/1/1': () => json({
    result: { id: '1', sura: '1', aya: '1', arabic_text: ARABIC_TEXT_SENTINEL, translation: 'FIXTURE_TAFSIR_1_1', footnotes: null },
  }),
  'GET https://mp3quran.net/api/v3/ayat_timing/reads': () => json([
    { id: 7, name: 'FIXTURE_RECITER', rewaya: 'FIXTURE_HAFS', folder_url: FOLDER, soar_count: 114, soar_link: 'https://mp3quran.net/x' },
    { id: 8, name: 'FIXTURE_OTHER', rewaya: 'FIXTURE_WARSH', folder_url: 'https://server9.mp3quran.net/other/', soar_count: 114, soar_link: 'https://mp3quran.net/y' },
  ]),
  'GET https://mp3quran.net/api/v3/reciters?language=ar': () => json({
    reciters: [{ id: 42, name: 'FIXTURE_RECITER', moshaf: [{ id: 99, server: `${FOLDER}/` }] }],
  }),
  'GET https://mp3quran.net/api/v3/ayat_timing?surah=16&read=7': () => json([
    { ayah: 9, start_time: 1000, end_time: 2000 },
    { ayah: 10, start_time: 2000, end_time: 5000 },
    { ayah: 11, start_time: 5000, end_time: 9000 },
  ]),
  'GET https://mp3quran.net/api/v3/ayat_timing?surah=1&read=7': () => json([{ ayah: 1, start_time: 0, end_time: 1000 }]),
  [`HEAD ${AUDIO_16}`]: () => new Response(null, { status: 200, headers: { 'content-type': 'audio/mpeg' } }),
  [`HEAD ${FOLDER}/001.mp3`]: () => new Response(null, { status: 200, headers: { 'content-type': 'audio/mpeg' } }),
});

// Mocked fetch: routes by "METHOD url"; unknown URLs get 404. Records every call.
export function mockFetch(overrides = {}) {
  const table = { ...routes(), ...overrides };
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ method, url, headers: init.headers });
    const handler = table[`${method} ${url}`];
    return handler ? handler() : new Response('not found', { status: 404 });
  };
  return { fetchImpl, calls };
}

// Captures console-style output.
export function capture() {
  const lines = [];
  const push = (...a) => lines.push(a.join(' '));
  return { out: { log: push, warn: push, error: push }, lines, text: () => lines.join('\n') };
}

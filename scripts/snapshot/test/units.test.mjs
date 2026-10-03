// Unit tests: HTTP guard (G5), KFC loading, mp3quran timing checks, record helpers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createHttp, isAllowedUrl, USER_AGENT } from '../http.mjs';
import { loadKfc, indexKfc, describeShape } from '../kfc.mjs';
import { ayahTiming, audioUrlFor, matchReciter } from '../mp3quran.mjs';
import { parseReference, deepDiff, checkAllowedChanges, findVerifyPaths } from '../records.mjs';
import { config, kfcEntries, quranRecord, uiRecord, stationDoc } from './fixtures.mjs';

const ok = (body) => new Response(JSON.stringify(body), { status: 200 });

test('G5: only https to quranenc.com and (*.)mp3quran.net is allowed', () => {
  assert.ok(isAllowedUrl('https://quranenc.com/api/v1/x'));
  assert.ok(isAllowedUrl('https://mp3quran.net/api/v3/x'));
  assert.ok(isAllowedUrl('https://www.mp3quran.net/api/v3/x'));
  assert.ok(isAllowedUrl('https://server6.mp3quran.net/a/001.mp3'));
  assert.ok(!isAllowedUrl('http://quranenc.com/api'));
  assert.ok(!isAllowedUrl('https://example.com/'));
  assert.ok(!isAllowedUrl('https://mp3quran.net.example.com/'));
  assert.ok(!isAllowedUrl('https://evilmp3quran.net/'));
});

test('G5: disallowed hosts are refused before any request', async () => {
  let called = 0;
  const http = createHttp({ fetchImpl: async () => { called++; return ok({}); } });
  await assert.rejects(http.getJson('https://example.com/x'), /not in allowlist/);
  assert.equal(called, 0);
});

test('G5: redirects are followed only within the allowlist', async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    if (url === 'https://mp3quran.net/a') return new Response(null, { status: 301, headers: { location: 'https://www.mp3quran.net/a' } });
    if (url === 'https://www.mp3quran.net/a') return ok({ fine: true });
    if (url === 'https://mp3quran.net/b') return new Response(null, { status: 302, headers: { location: 'https://example.com/b' } });
    return new Response('', { status: 404 });
  };
  const http = createHttp({ fetchImpl, backoffMs: 0 });
  assert.deepEqual(await http.getJson('https://mp3quran.net/a'), { fine: true });
  await assert.rejects(http.getJson('https://mp3quran.net/b'), /outside the allowlist/);
  assert.ok(!seen.includes('https://example.com/b'));
});

test('G5: sends the User-Agent, retries 5xx and network errors 3 times, never 4xx', async () => {
  const headers = [];
  let n = 0;
  const flaky = async (url, init) => {
    headers.push(init.headers['User-Agent']);
    n++;
    if (n === 1) throw new TypeError('fetch failed');
    if (n === 2) return new Response('', { status: 503 });
    return ok({ ok: 1 });
  };
  const sleeps = [];
  const http = createHttp({ fetchImpl: flaky, backoffMs: 10, sleep: async (ms) => { sleeps.push(ms); } });
  assert.deepEqual(await http.getJson('https://quranenc.com/x'), { ok: 1 });
  assert.deepEqual(headers, [USER_AGENT, USER_AGENT, USER_AGENT]);
  assert.deepEqual(sleeps, [10, 20]);

  let calls = 0;
  const always500 = createHttp({ fetchImpl: async () => { calls++; return new Response('', { status: 500 }); }, sleep: async () => {} });
  await assert.rejects(always500.getJson('https://quranenc.com/x'), /after 4 attempts/);
  assert.equal(calls, 4);

  calls = 0;
  const notFound = createHttp({ fetchImpl: async () => { calls++; return new Response('', { status: 404 }); }, sleep: async () => {} });
  await assert.rejects(notFound.getJson('https://quranenc.com/x'), /HTTP 404/);
  assert.equal(calls, 1);
});

test('G5: requests time out', async () => {
  const hang = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
  const http = createHttp({ fetchImpl: hang, timeoutMs: 20, retries: 0 });
  await assert.rejects(http.getJson('https://quranenc.com/x'), /after 1 attempts/);
});

test('KFC: loads, hashes and indexes the file; text kept byte-exact', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mizan-kfc-'));
  const file = join(dir, 'k.json');
  const entries = kfcEntries();
  const RLM = String.fromCharCode(0x200f);
  entries[0].aya_text = ` FIXTURE_TEXT_WITH_SPACES ${RLM}`;
  await writeFile(file, `${String.fromCharCode(0xfeff)}${JSON.stringify(entries)}`);
  const { meta, index } = await loadKfc(file, config().kfc);
  assert.equal(meta.file, 'k.json');
  assert.match(meta.sha256, /^[0-9a-f]{64}$/);
  assert.equal(meta.entryCount, 3);
  assert.equal(index.get('16:10').text, ` FIXTURE_TEXT_WITH_SPACES ${RLM}`);
  assert.equal(index.get('16:10').id, '101');
});

test('KFC: rejects wrong count, duplicates, missing fields and non-array shapes', () => {
  const cfg = config().kfc;
  assert.throws(() => indexKfc(kfcEntries().slice(0, 2), cfg), /entry count 2 != expectedAyahCount 3/);
  const dup = kfcEntries();
  dup[2] = { ...dup[0], id: 999 };
  assert.throws(() => indexKfc(dup, cfg), /duplicate \(sura, aya\) 16:10/);
  const missing = kfcEntries();
  delete missing[1].aya_text;
  assert.throws(() => indexKfc(missing, cfg), /entry 1 has no field "aya_text"/);
  assert.throws(() => indexKfc({ data: kfcEntries() }, cfg), /top-level is not an array/);
});

test('KFC: describeShape reports structure and never values', () => {
  const shape = describeShape(kfcEntries());
  assert.deepEqual(shape, { topLevel: 'array', entryCount: 3, firstEntryKeys: ['id', 'sura_no', 'aya_no', 'aya_text'] });
  assert.ok(!JSON.stringify(shape).includes('FIXTURE_TEXT'));
  assert.ok(!JSON.stringify(describeShape({ verses: kfcEntries() })).includes('FIXTURE_TEXT'));
});

test('mp3quran: timing assertions', () => {
  const t = [{ ayah: 1, start_time: 0, end_time: 1000 }, { ayah: 2, start_time: 1000, end_time: 3000 }];
  assert.deepEqual(ayahTiming(t, 2), { startMs: 1000, endMs: 3000 });
  assert.throws(() => ayahTiming(t, 3), /0 entries for ayah 3/);
  assert.throws(() => ayahTiming([{ ayah: 1, start_time: 0.5, end_time: 9 }], 1), /not integers/);
  assert.throws(() => ayahTiming([{ ayah: 1, start_time: 9, end_time: 9 }], 1), /<= start_time/);
  assert.throws(() => ayahTiming([{ ayah: 1, start_time: 0, end_time: 2000 }, { ayah: 2, start_time: 1500, end_time: 3000 }], 1), /ends after ayah 2 starts/);
  assert.throws(() => ayahTiming([{ ayah: 1, start_time: 0, end_time: 300000 }], 1), /lasts 300000 ms/);
});

test('mp3quran: audio URL and reciter match normalize the trailing slash', () => {
  assert.equal(audioUrlFor('https://server6.mp3quran.net/x', 16), 'https://server6.mp3quran.net/x/016.mp3');
  assert.equal(audioUrlFor('https://server6.mp3quran.net/x/', 2), 'https://server6.mp3quran.net/x/002.mp3');
  const reciters = [{ id: 5, moshaf: [{ id: 6, server: 'https://server6.mp3quran.net/x/' }] }];
  assert.deepEqual(matchReciter(reciters, 'https://server6.mp3quran.net/x'), { reciterId: 5, moshafId: 6, matches: 1 });
  assert.deepEqual(matchReciter(reciters, 'https://server6.mp3quran.net/y'), { reciterId: null, moshafId: null, matches: 0 });
});

test('records: reference parsing', () => {
  assert.deepEqual(parseReference('16:10'), { surah: 16, ayah: 10 });
  for (const bad of ['0:1', '115:1', '16:0', '16-10', ' 16:10', null, 'SS:AA']) assert.throws(() => parseReference(bad));
});

test('records: deepDiff and the G1 allowlist', () => {
  const before = stationDoc([uiRecord(), quranRecord()]);
  const ok1 = structuredClone(before);
  Object.assign(ok1.records[1], { text: 'FIXTURE_X', platformId: 'kfc-hafs:1', retrievedAt: 'now' });
  ok1.records[1].recitation.startMs = 1;
  ok1.records[1].recitation.timingReadId = 7;
  assert.doesNotThrow(() => checkAllowedChanges(before, ok1));
  assert.deepEqual(deepDiff(before, ok1).length, 5);

  const uiChange = structuredClone(before);
  uiChange.records[0].text = 'FIXTURE_CHANGED';
  assert.throws(() => checkAllowedChanges(before, uiChange), /S9\.F1: records\[0\]\.text/);

  const metaChange = structuredClone(before);
  metaChange.meta.status = 'approved';
  assert.throws(() => checkAllowedChanges(before, metaChange), /meta\.status/);

  const added = structuredClone(before);
  added.records.push(uiRecord({ id: 'S9.F2' }));
  assert.throws(() => checkAllowedChanges(before, added), /records/);
});

test('G6: findVerifyPaths reports the nearest id and a JSON path', () => {
  const doc = stationDoc([uiRecord(), quranRecord()]);
  const paths = findVerifyPaths(doc);
  assert.deepEqual(paths.map((p) => `${p.id} ${p.path}`), [
    'S9.V1 records[1].text', 'S9.V1 records[1].platformId',
    'S9.V1 records[1].recitation.reciterId', 'S9.V1 records[1].recitation.moshafId', 'S9.V1 records[1].recitation.audioUrl',
  ]);
});

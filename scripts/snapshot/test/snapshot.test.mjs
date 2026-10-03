// End-to-end tests of the snapshot run against a temp repo, mocked fetch and fixture data.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { run } from '../snapshot.mjs';
import {
  NOW, OLD, ARABIC_TEXT_SENTINEL, AUDIO_16, config, makeRepo, readJson, snapshotLogs, mockFetch, capture,
  quranRecord, tafsirRecord, uiRecord, routes, kfcEntries, ARABIC_PLACEHOLDER,
} from './fixtures.mjs';

async function snap(repo, argv = [], { fetch = mockFetch(), cfg = config(), hooks } = {}) {
  const cap = capture();
  const code = await run({
    argv, root: repo.root, config: cfg, fetchImpl: fetch.fetchImpl, httpOptions: { backoffMs: 0 },
    now: () => NOW, out: cap.out, hooks,
  });
  return { code, cap, fetch };
}

const byId = async (file, id) => (await readJson(file)).records.find((r) => r.id === id);

test('fills a draft quran record from KFC and mp3quran', async () => {
  const repo = await makeRepo();
  const { code } = await snap(repo);
  assert.equal(code, 0);
  const r = await byId(repo.stationFile, 'S9.V1');
  assert.equal(r.text, 'FIXTURE_TEXT_16_10');
  assert.equal(r.sourcePlatform, 'King Fahd Complex');
  assert.equal(r.platformId, 'kfc-hafs:101');
  assert.equal(r.retrievedAt, NOW.toISOString());
  assert.deepEqual(r.recitation, {
    platform: 'mp3quran.net', reciterId: 42, moshafId: 99, audioUrl: AUDIO_16, startMs: 2000, endMs: 5000, timingReadId: 7,
  });
  assert.equal(r.tts, false);
  assert.equal(r.status, 'draft');
  assert.equal(r.level, 'A');
});

test('quran text is written to the station file exactly as loaded (NBSP and ayah-end symbol kept)', async () => {
  const exact = ` FIXTURE_TEXT_16_10${String.fromCharCode(0x00a0)}${String.fromCharCode(0xfc09)}`;
  const kfc = kfcEntries();
  kfc[0].aya_text = exact;
  const repo = await makeRepo([uiRecord(), quranRecord()], { kfc });
  assert.equal((await snap(repo)).code, 0);
  assert.equal((await byId(repo.stationFile, 'S9.V1')).text, exact);
});

test('fills a draft tafsir record from QuranEnc', async () => {
  const repo = await makeRepo();
  await snap(repo);
  const r = await byId(repo.stationFile, 'S9.T1');
  assert.equal(r.text, 'FIXTURE_TAFSIR_16_10');
  assert.equal(r.sourcePlatform, 'QuranEnc');
  assert.equal(r.platformId, 'quranenc:fixture_tafsir:v1.2.3:16:10');
  assert.equal(r.retrievedAt, NOW.toISOString());
  assert.equal(r.tts, false);
});

test('QuranEnc arabic_text is never stored, in the record or the log', async () => {
  const repo = await makeRepo();
  await snap(repo);
  assert.ok(!(await readFile(repo.stationFile, 'utf8')).includes(ARABIC_TEXT_SENTINEL));
  const [log] = await snapshotLogs(repo.root);
  assert.ok(!(await readFile(join(repo.root, 'content', 'snapshots', log), 'utf8')).includes(ARABIC_TEXT_SENTINEL));
});

test('G2: approved and rejected records are untouched; leftover [VERIFY is a review error', async () => {
  const approved = quranRecord({ id: 'S9.V2', status: 'approved', reviewer1: 'Hussein' });
  const rejected = tafsirRecord({ id: 'S9.T2', status: 'rejected' });
  const repo = await makeRepo([uiRecord(), approved, rejected]);
  const { code, cap } = await snap(repo);
  assert.deepEqual(await byId(repo.stationFile, 'S9.V2'), approved);
  assert.deepEqual(await byId(repo.stationFile, 'S9.T2'), rejected);
  assert.match(cap.text(), /REVIEW ERROR .*S9\.V2/);
  assert.match(cap.text(), /REVIEW ERROR .*S9\.T2/);
  assert.equal(code, 2); // their [VERIFY markers remain unresolved
});

test('G1: a protected-field change aborts the run and writes nothing', async () => {
  const repo = await makeRepo();
  const before = await readFile(repo.stationFile, 'utf8');
  const hooks = { afterFill: (files) => { files[0].after.records[1].level = 'B'; } };
  const { code, cap } = await snap(repo, [], { hooks });
  assert.equal(code, 1);
  assert.match(cap.text(), /protected paths changed.*\n.*S9\.V1: records\[1\]\.level/);
  assert.equal(await readFile(repo.stationFile, 'utf8'), before);
  assert.deepEqual(await snapshotLogs(repo.root), []);
});

test('G1: changes to status, reviewer, basedOn, tts or id also abort', async () => {
  for (const mutate of [
    (r) => { r.status = 'approved'; },
    (r) => { r.reviewer1 = 'someone'; },
    (r) => { r.tts = true; },
    (r) => { r.id = 'S9.VX'; },
    (r) => { r.basedOn = ['S9.V1']; },
  ]) {
    const repo = await makeRepo();
    const before = await readFile(repo.stationFile, 'utf8');
    const { code } = await snap(repo, [], { hooks: { afterFill: (files) => mutate(files[0].after.records[2]) } });
    assert.equal(code, 1);
    assert.equal(await readFile(repo.stationFile, 'utf8'), before);
  }
});

test('G3: identical re-fetch leaves the record and retrievedAt unchanged', async () => {
  const repo = await makeRepo();
  await snap(repo);
  const first = await readFile(repo.stationFile, 'utf8');
  const later = new Date('2026-10-04T08:00:00.000Z');
  const cap = capture();
  const f = mockFetch();
  const code = await run({ root: repo.root, config: config(), fetchImpl: f.fetchImpl, httpOptions: { backoffMs: 0 }, now: () => later, out: cap.out });
  assert.equal(code, 0);
  assert.equal(await readFile(repo.stationFile, 'utf8'), first);
});

test('G3: drift is reported and not overwritten without --refresh', async () => {
  const filled = quranRecord({
    text: 'FIXTURE_TEXT_OLD', platformId: 'kfc-hafs:101', retrievedAt: OLD,
    recitation: { platform: 'mp3quran.net', reciterId: 42, moshafId: 99, audioUrl: AUDIO_16, startMs: 2000, endMs: 5000, timingReadId: 7 },
  });
  const repo = await makeRepo([uiRecord(), filled]);
  const before = await readFile(repo.stationFile, 'utf8');
  const { code, cap } = await snap(repo);
  assert.equal(code, 0);
  assert.match(cap.text(), /DRIFT S9\.V1: text \(not overwritten/);
  assert.equal(await readFile(repo.stationFile, 'utf8'), before);

  const refreshed = await snap(repo, ['--refresh']);
  assert.equal(refreshed.code, 0);
  const r = await byId(repo.stationFile, 'S9.V1');
  assert.equal(r.text, 'FIXTURE_TEXT_16_10');
  assert.equal(r.retrievedAt, NOW.toISOString());
});

test('stops when the selected read has the wrong rewaya; nothing written', async () => {
  const repo = await makeRepo();
  const before = await readFile(repo.stationFile, 'utf8');
  const cfg = config();
  cfg.mp3quran.reciterNameContains = 'FIXTURE_OTHER';
  const { code, cap } = await snap(repo, [], { cfg });
  assert.equal(code, 1);
  assert.match(cap.text(), /rewaya "FIXTURE_WARSH" does not contain "FIXTURE_HAFS"/);
  assert.equal(await readFile(repo.stationFile, 'utf8'), before);
});

test('stops when the read selector matches zero or several reads', async () => {
  for (const name of ['FIXTURE_NOBODY', 'FIXTURE_']) {
    const repo = await makeRepo();
    const cfg = config();
    cfg.mp3quran.reciterNameContains = name;
    const { code, cap } = await snap(repo, [], { cfg });
    assert.equal(code, 1);
    assert.match(cap.text(), /exactly one is required/);
  }
});

test('G6: unresolved [VERIFY items give exit 2 with id and JSON path', async () => {
  const hadith = { id: 'S9.H1', station: 'S9', type: 'hadith', text: '[VERIFY: hadeethenc.com]', grading: '[VERIFY: dorar.net]', status: 'draft' };
  const repo = await makeRepo([uiRecord(), quranRecord(), hadith]);
  const { code, cap } = await snap(repo);
  assert.equal(code, 2);
  assert.match(cap.text(), /S9\.H1 records\[2\]\.text/);
  assert.match(cap.text(), /S9\.H1 records\[2\]\.grading/);
  const [log] = await snapshotLogs(repo.root);
  const parsed = await readJson(join(repo.root, 'content', 'snapshots', log));
  assert.deepEqual(parsed.unresolved.map((u) => u.path), ['records[2].text', 'records[2].grading']);
  assert.equal(parsed.records.find((r) => r.id === 'S9.H1').action, 'unresolved');
});

test('G4: key order kept, new keys appended, 2-space indent, trailing newline, no BOM, no temp files', async () => {
  const repo = await makeRepo();
  await snap(repo);
  const raw = await readFile(repo.stationFile, 'utf8');
  assert.notEqual(raw.charCodeAt(0), 0xfeff);
  assert.ok(raw.endsWith('}\n'));
  assert.equal(raw, `${JSON.stringify(JSON.parse(raw), null, 2)}\n`);
  const r = JSON.parse(raw).records[1];
  assert.deepEqual(Object.keys(r), Object.keys(quranRecord()));
  assert.deepEqual(Object.keys(r.recitation), ['platform', 'reciterId', 'moshafId', 'audioUrl', 'startMs', 'endMs', 'timingReadId']);
  const leftovers = (await readdir(join(repo.root, 'content', 'stations'))).filter((n) => n.endsWith('.tmp'));
  assert.deepEqual(leftovers, []);
});

test('--dry-run changes no station file, writes only a -dry-run log, and never prints source text', async () => {
  const repo = await makeRepo();
  const before = await readFile(repo.stationFile, 'utf8');
  const { code, cap } = await snap(repo, ['--dry-run']);
  assert.equal(code, 0);
  assert.equal(await readFile(repo.stationFile, 'utf8'), before);
  assert.deepEqual(await snapshotLogs(repo.root), ['20261003T120000Z-dry-run.json']);
  assert.match(cap.text(), /PLAN S9\.V1/);
  assert.match(cap.text(), /text: "\[VERIFY: qurancomplex\.gov\.sa\]" -> <18 chars, sha256 [0-9a-f]{12}>/);
  assert.ok(!cap.text().includes('FIXTURE_TEXT_16_10'));
  assert.ok(!cap.text().includes('FIXTURE_TAFSIR_16_10'));
});

test('--list writes nothing and reports the selector', async () => {
  const repo = await makeRepo();
  const before = await readFile(repo.stationFile, 'utf8');
  const { code, cap } = await snap(repo, ['--list']);
  assert.equal(code, 0);
  assert.equal(await readFile(repo.stationFile, 'utf8'), before);
  assert.deepEqual(await snapshotLogs(repo.root), []);
  assert.match(cap.text(), /\[tafsir\] fixture_tafsir \| FIXTURE_TITLE \| v1\.2\.3/);
  assert.match(cap.text(), /matches exactly one: 7/);
  assert.ok(!cap.text().includes(ARABIC_TEXT_SENTINEL));
});

const EMPTY_LIST = { 'GET https://quranenc.com/api/v1/translations/list/ar': () => new Response(JSON.stringify({ translations: [] }), { status: 200 }) };
const ayaResponse = (translation) => () => new Response(JSON.stringify({
  result: { id: '1', sura: '16', aya: '10', arabic_text: ARABIC_TEXT_SENTINEL, translation, footnotes: null },
}), { status: 200 });

test('listed tafsir key: platformId carries :v{version}; log listStatus "listed"', async () => {
  const repo = await makeRepo([uiRecord(), tafsirRecord()]);
  assert.equal((await snap(repo)).code, 0);
  assert.equal((await byId(repo.stationFile, 'S9.T1')).platformId, 'quranenc:fixture_tafsir:v1.2.3:16:10');
  const [log] = await snapshotLogs(repo.root);
  const parsed = await readJson(join(repo.root, 'content', 'snapshots', log));
  assert.deepEqual(parsed.sources.quranenc, { key: 'fixture_tafsir', title: 'FIXTURE_TITLE', version: '1.2.3', listStatus: 'listed' });
});

test('unlisted tafsir key with an Arabic-script translation is accepted: version null, no :v, arabic_text not stored', async () => {
  const repo = await makeRepo([uiRecord(), tafsirRecord()]);
  const fetch = mockFetch({ ...EMPTY_LIST, 'GET https://quranenc.com/api/v1/translation/aya/fixture_tafsir/16/10': ayaResponse(ARABIC_PLACEHOLDER) });
  const { code, cap } = await snap(repo, [], { fetch });
  assert.equal(code, 0);
  const r = await byId(repo.stationFile, 'S9.T1');
  assert.equal(r.text, ARABIC_PLACEHOLDER);
  assert.equal(r.platformId, 'quranenc:fixture_tafsir:16:10');
  assert.match(cap.text(), /WARN QuranEnc key "fixture_tafsir" is not in/);
  const [log] = await snapshotLogs(repo.root);
  const raw = await readFile(join(repo.root, 'content', 'snapshots', log), 'utf8');
  assert.deepEqual(JSON.parse(raw).sources.quranenc, { key: 'fixture_tafsir', title: null, version: null, listStatus: 'unlisted' });
  assert.ok(!raw.includes(ARABIC_TEXT_SENTINEL));
  assert.ok(!(await readFile(repo.stationFile, 'utf8')).includes(ARABIC_TEXT_SENTINEL));
});

test('unlisted tafsir key is rejected when the translation is not Arabic script or the ayah is not 200', async () => {
  for (const handler of [ayaResponse('FIXTURE_LATIN_TRANSLATION'), () => new Response('not found', { status: 404 })]) {
    const repo = await makeRepo([uiRecord(), tafsirRecord()]);
    const before = await readFile(repo.stationFile, 'utf8');
    const fetch = mockFetch({ ...EMPTY_LIST, 'GET https://quranenc.com/api/v1/translation/aya/fixture_tafsir/16/10': handler });
    const { code, cap } = await snap(repo, [], { fetch });
    assert.equal(code, 1);
    assert.match(cap.text(), /not in Arabic script|HTTP 404/);
    assert.equal(await readFile(repo.stationFile, 'utf8'), before);
  }
});

test('--list reports an unlisted key as accepted after the per-ayah check', async () => {
  const repo = await makeRepo();
  const fetch = mockFetch({
    ...EMPTY_LIST,
    'GET https://quranenc.com/api/v1/translation/aya/fixture_tafsir/1/1': () => new Response(JSON.stringify({
      result: { sura: '1', aya: '1', arabic_text: ARABIC_TEXT_SENTINEL, translation: ARABIC_PLACEHOLDER, footnotes: null },
    }), { status: 200 }),
  });
  const { code, cap } = await snap(repo, ['--list'], { fetch });
  assert.equal(code, 0);
  assert.match(cap.text(), /unlisted key check \(1:1\): accepted/);
  assert.ok(!cap.text().includes(ARABIC_PLACEHOLDER));
});

test('stops when QuranEnc answers for a different ayah', async () => {
  const repo = await makeRepo([uiRecord(), tafsirRecord()]);
  const fetch = mockFetch({
    'GET https://quranenc.com/api/v1/translation/aya/fixture_tafsir/16/10': () => new Response(JSON.stringify({
      result: { sura: '16', aya: '11', arabic_text: ARABIC_TEXT_SENTINEL, translation: 'FIXTURE_TAFSIR_16_11' },
    }), { status: 200 }),
  });
  const { code, cap } = await snap(repo, [], { fetch });
  assert.equal(code, 1);
  assert.match(cap.text(), /response is for 16:11, not 16:10/);
});

test('stops when the audio HEAD check fails', async () => {
  const repo = await makeRepo([uiRecord(), quranRecord()]);
  const fetch = mockFetch({ [`HEAD ${AUDIO_16}`]: () => new Response(null, { status: 200, headers: { 'content-type': 'text/html' } }) });
  const { code, cap } = await snap(repo, [], { fetch });
  assert.equal(code, 1);
  assert.match(cap.text(), /expected 200 \+ audio\/\*/);
});

test('missing reciter/moshaf match sets reciterId null, keeps timingReadId, and warns', async () => {
  const repo = await makeRepo([uiRecord(), quranRecord()]);
  const fetch = mockFetch({
    'GET https://mp3quran.net/api/v3/reciters?language=ar': () => new Response(JSON.stringify({ reciters: [] }), { status: 200 }),
  });
  const { code, cap } = await snap(repo, [], { fetch });
  assert.equal(code, 0);
  const r = await byId(repo.stationFile, 'S9.V1');
  assert.equal(r.recitation.reciterId, null);
  assert.equal(r.recitation.moshafId, null);
  assert.equal(r.recitation.timingReadId, 7);
  assert.match(cap.text(), /WARN no unique reciter\/moshaf/);
});

test('--station filters by station id', async () => {
  const repo = await makeRepo();
  const { code, cap } = await snap(repo, ['--station', 'S1']);
  assert.equal(code, 1);
  assert.match(cap.text(), /no station files for S1/);
  assert.equal((await snap(repo, ['--station', 'S9'])).code, 0);
});

test('the run log records sources, request URLs and actions', async () => {
  const repo = await makeRepo();
  await snap(repo);
  const [name] = await snapshotLogs(repo.root);
  assert.equal(name, '20261003T120000Z.json');
  const log = await readJson(join(repo.root, 'content', 'snapshots', name));
  assert.equal(log.runAt, NOW.toISOString());
  assert.equal(log.mode, 'apply');
  assert.equal(log.sources.kfc.file, 'fixture.json');
  assert.match(log.sources.kfc.sha256, /^[0-9a-f]{64}$/);
  assert.equal(log.sources.kfc.sourceUrl, 'https://fixture.invalid/kfc.zip');
  assert.equal(log.sources.kfc.sourceVersion, '0.0-fixture');
  assert.deepEqual(log.sources.quranenc, { key: 'fixture_tafsir', title: 'FIXTURE_TITLE', version: '1.2.3', listStatus: 'listed' });
  assert.equal(log.sources.mp3quran.readId, 7);
  assert.equal(log.sources.mp3quran.folderUrl, 'https://server9.mp3quran.net/fixture/');
  const v1 = log.records.find((r) => r.id === 'S9.V1');
  assert.equal(v1.action, 'filled');
  assert.equal(v1.platformId, 'kfc-hafs:101');
  assert.equal(v1.requestUrl, 'https://mp3quran.net/api/v3/ayat_timing?surah=16&read=7');
  assert.ok(Object.keys(routes()).length > 0);
});

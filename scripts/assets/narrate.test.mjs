// Narration generator: inclusion/exclusion rules (R4) and file/manifest handling. HTTP is mocked;
// fixtures are synthetic placeholder strings, never Qur'an text (R2). Never prints record text.

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLibrary, loadLibrary } from '../../app/_lib/library';
import { MODEL_ID, OUTPUT_FORMAT, VOICE_ID, guardLibrary, narrateStation, selectNarration, sha256 } from './narrate-lib.mjs';

// Synthetic "verse": placeholder words only, standing in for a stored quran record.
const FAKE_VERSE = 'كلمة1 كلمة2 كلمة3 كلمة4 كلمة5';
const MARK = String.fromCharCode(0x06dd); // an end-of-ayah sign (Qur'anic mark), no verse text

const rec = (id, type, extra = {}) => ({ id, station: 'SX', type, text: `نص ${id}`, level: 'NA', tts: true, status: 'approved', ...extra });

const RECORDS = [
  rec('SX.F1', 'ui', { role: 'frame' }),
  rec('SX.E1', 'explanation', { level: 'A' }),
  rec('SX.X1', 'answer', { level: 'A' }),
  rec('SX.X3', 'referral', { level: 'D' }),
  rec('SX.FB1', 'fallback', { level: 'OUT_OF_SCOPE' }),
  rec('SX.V1', 'quran', { text: FAKE_VERSE, level: 'A', tts: false }),
  rec('SX.V2', 'quran', { level: 'A', tts: true }), // wrongly marked tts:true: still never spoken
  rec('SX.T1', 'tafsir', { level: 'A', tts: false }),
  rec('SX.HD1', 'hadith', { level: 'A' }),
  rec('SX.PS1', 'ui', { role: 'parent_line', tts: false }),
  rec('SX.D1', 'ui', { role: 'hint', status: 'draft' }),
  rec('SX.RJ1', 'answer', { status: 'rejected' }),
  rec('SX.Q1', 'ui', { role: 'question', text: `سؤال ${MARK}` }),
  rec('SX.H1', 'ui', { role: 'hint', text: `قبل ${FAKE_VERSE.split(' ').slice(0, 4).join(' ')} بعد` }),
  rec('SX.VR', 'quran', { text: 'رفض1 رفض2 رفض3 رفض4', status: 'rejected', tts: false }),
  rec('SX.H2', 'ui', { role: 'hint', text: 'قبل رفض1 رفض2 رفض3 رفض4' }),
  rec('SX.PS2', 'ui', { role: 'parent_line', text: 'نص {verseRef}' }), // placeholder: on-screen only
];

const guard = () => {
  const lib = buildLibrary([{ stationId: 'SX', titleRecordId: null, records: RECORDS.filter((r) => r.status === 'approved'), anticipatedQuestions: [], script: [] }]);
  return guardLibrary(lib, RECORDS);
};

describe('narration selection (R4: never Qur\'an)', () => {
  it('includes only approved tts:true ui/explanation/answer/referral/fallback records that pass the guards', () => {
    const { include, skipped } = selectNarration(guard(), RECORDS);
    expect(include.map((r) => r.id)).toEqual(['SX.F1', 'SX.E1', 'SX.X1', 'SX.X3', 'SX.FB1']);
    expect(Object.fromEntries(skipped.map((s) => [s.recordId, s.reason]))).toEqual({
      'SX.V1': 'quran record (never synthetic voice)',
      'SX.V2': 'quran record (never synthetic voice)',
      'SX.T1': 'tafsir record (never synthetic voice)',
      'SX.HD1': 'hadith record (never synthetic voice)',
      'SX.PS1': 'tts is not true',
      'SX.D1': 'not approved (draft)',
      'SX.RJ1': 'not approved (rejected)',
      'SX.Q1': "citation validator: Qur'anic marks",
      'SX.H1': 'citation validator: verse wording',
      'SX.VR': 'not approved (rejected)',
      'SX.H2': 'citation validator: verse wording', // wording of a rejected verse record is caught too
      'SX.PS2': 'contains a placeholder (resolved on screen only)',
    });
  });

  it('on the real content, nothing selected is Qur\'an/tafsir/hadith or fails the guards', () => {
    const root = path.resolve(import.meta.dirname, '..', '..');
    for (const s of ['S1', 'S2', 'S3']) {
      const records = JSON.parse(readFileSync(path.join(root, 'content', 'stations', `${s}.json`), 'utf8')).records;
      const g = guardLibrary(loadLibrary(path.join(root, 'content')), records);
      const { include, skipped } = selectNarration(g, records);
      expect(include.length).toBeGreaterThan(0);
      for (const r of include) {
        expect(['ui', 'explanation', 'answer', 'referral', 'fallback']).toContain(r.type);
        expect(r.tts).toBe(true);
        expect(r.status).toBe('approved');
        expect(g.verses.some((v) => r.text.includes(v.text))).toBe(false);
      }
      for (const r of records.filter((x) => ['quran', 'tafsir', 'hadith'].includes(x.type))) expect(skipped.map((x) => x.recordId)).toContain(r.id);
    }
  });
});

describe('narrateStation (HTTP mocked)', () => {
  let dir;
  const fetchImpl = vi.fn(async () => new Response(new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]), { status: 200, headers: { 'content-type': 'audio/mpeg' } }));
  const now = () => new Date('2026-10-04T12:00:00Z');
  const run = (opts = {}) => narrateStation({ stationId: 'SX', records: RECORDS, guardLib: guard(), audioRoot: dir, apiKey: 'FIXTURE_KEY', fetchImpl, now, ...opts });

  beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'narrate-')); fetchImpl.mockClear(); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('calls ElevenLabs with the fixed voice, model and format, and only for included records', async () => {
    const out = await run();
    expect(out.generated).toEqual(['SX.F1', 'SX.E1', 'SX.X1', 'SX.X3', 'SX.FB1']);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    for (const [url, init] of fetchImpl.mock.calls) {
      expect(url).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=${OUTPUT_FORMAT}`);
      expect(init.method).toBe('POST');
      expect(init.headers['xi-api-key']).toBe('FIXTURE_KEY');
      const body = JSON.parse(init.body);
      expect(body.model_id).toBe(MODEL_ID);
      expect(body.text).not.toContain('كلمة1'); // no verse wording is ever sent
      expect(body.text).not.toContain(MARK);
    }
    for (const id of out.generated) expect(existsSync(path.join(dir, 'SX', `${id}.mp3`))).toBe(true);
    for (const s of out.skipped) expect(existsSync(path.join(dir, 'SX', `${s.recordId}.mp3`))).toBe(false);
    expect(out.characters).toBe(['SX.F1', 'SX.E1', 'SX.X1', 'SX.X3', 'SX.FB1'].reduce((n, id) => n + `نص ${id}`.length, 0));
  });

  it('writes a manifest with text hash, voice, model and date', async () => {
    await run();
    const m = JSON.parse(readFileSync(path.join(dir, 'SX', 'manifest.json'), 'utf8'));
    expect(m.entries.map((e) => e.recordId)).toEqual(['SX.E1', 'SX.F1', 'SX.FB1', 'SX.X1', 'SX.X3']);
    expect(m.entries.find((e) => e.recordId === 'SX.F1')).toEqual({
      recordId: 'SX.F1', textSha256: sha256('نص SX.F1'), voiceId: VOICE_ID, model: MODEL_ID, outputFormat: OUTPUT_FORMAT, date: '2026-10-04T12:00:00.000Z',
    });
  });

  it('skips existing files unless --force, and reports stale audio when the text changed', async () => {
    await run();
    fetchImpl.mockClear();
    const again = await run();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(again.kept).toHaveLength(5);
    expect(again.stale).toEqual([]);

    const changed = RECORDS.map((r) => (r.id === 'SX.X1' ? { ...r, text: 'نص معدل' } : r));
    const staleRun = await run({ records: changed });
    expect(staleRun.stale).toEqual(['SX.X1']);
    expect(fetchImpl).not.toHaveBeenCalled();

    const forced = await run({ records: changed, force: true });
    expect(forced.generated).toHaveLength(5);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    const m = JSON.parse(readFileSync(path.join(dir, 'SX', 'manifest.json'), 'utf8'));
    expect(m.entries.find((e) => e.recordId === 'SX.X1').textSha256).toBe(sha256('نص معدل'));
  });

  it('refuses to run without an API key and surfaces HTTP errors without the key', async () => {
    await expect(run({ apiKey: '' })).rejects.toThrow('ELEVENLABS_API_KEY is not set');
    expect(fetchImpl).not.toHaveBeenCalled();
    const failing = vi.fn(async () => new Response(JSON.stringify({ detail: { status: 'invalid_api_key' } }), { status: 401 }));
    await expect(run({ fetchImpl: failing })).rejects.toThrow('ElevenLabs HTTP 401 (invalid_api_key)');
  });
});

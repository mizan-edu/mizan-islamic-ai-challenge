// Placeholder resolution and the "no braces on screen" guard. Never prints record text.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findContentDir, loadUiStrings, type ContentRecord } from './content';
import { buildLibrary, loadLibrary } from './library';
import { hasBraces, loadSurahNames, placeholderProblems, placeholderValues, resolveText, verseCardRecordId } from './placeholders';
import { buildStationView, type RecordView, type StationView } from './station-view';

const noFiles = () => false;

function allRecordViews(v: StationView): RecordView[] {
  const out: (RecordView | null)[] = [v.title, ...v.frame, ...v.close.lines, ...v.parent];
  if (v.observe) out.push(v.observe.question, ...v.observe.choices, v.observe.praise, ...Object.values(v.observe.redirects), ...v.observe.hints, v.observe.together);
  if (v.connect) out.push(...v.connect.science, v.connect.bridge, v.connect.listen, ...v.connect.explanations);
  if (v.narrate) out.push(v.narrate.intro, ...v.narrate.cards, v.narrate.praise, v.narrate.retry);
  return out.filter((r): r is RecordView => r !== null);
}

describe('resolveText', () => {
  it('fills known placeholders and refuses anything left unresolved', () => {
    expect(resolveText('a {x} b', { x: 'X' })).toBe('a X b');
    expect(resolveText('no placeholders', {})).toBe('no placeholders');
    expect(resolveText('a {y} b', { x: 'X' })).toBeNull();
    expect(resolveText('stray { brace', {})).toBeNull();
    expect(resolveText('a {x}', { x: '{x}' })).toBeNull();
  });
});

describe('{verseRef} on the real content', () => {
  const lib = loadLibrary();
  const surahs = loadSurahNames();

  it('is "<ayah> من سورة <KFC surah name>" from each station\'s approved verse-card record', () => {
    expect(surahs.size).toBe(114);
    for (const s of ['S1', 'S2', 'S3']) {
      const id = verseCardRecordId(lib, s)!;
      expect(lib.byId.get(id)?.status).toBe('approved');
      const [sura, ayah] = String(lib.byId.get(id)!.reference).split(':').map(Number);
      expect(placeholderValues(lib, s, surahs).verseRef).toBe(`${ayah} من سورة ${surahs.get(sura)}`);
    }
  });

  it('S1 parent summary shows the resolved line; the approved record text is unchanged', () => {
    const ps1 = lib.byId.get('S1.PS1')!;
    expect(ps1.text.includes('{verseRef}')).toBe(true);
    const line = buildStationView(lib, 'S1', noFiles)!.parent.find((r) => r.id === 'S1.PS1')!;
    expect(hasBraces(line.text)).toBe(false);
    expect(line.text.includes(placeholderValues(lib, 'S1', surahs).verseRef)).toBe(true);
  });

  it('no rendered child or parent text in S1–S3 contains a brace', () => {
    for (const s of ['S1', 'S2', 'S3']) {
      const v = buildStationView(lib, s, noFiles)!;
      for (const r of allRecordViews(v)) expect(hasBraces(r.text), r.id).toBe(false);
      for (const q of v.ask) expect(hasBraces(q.text), q.id).toBe(false);
    }
  });

  it('the build-time content check passes', () => {
    expect(placeholderProblems(lib, loadUiStrings().values(), surahs)).toEqual([]);
  });

  const source = path.join(findContentDir(), '..', 'sources', 'kfc', 'hafsData_v2-0.json');
  it.skipIf(!existsSync(source))('surah names match the KFC hafsData v2.0 rows of every approved verse', () => {
    const rows = JSON.parse(readFileSync(source, 'utf8')) as { id: number; sura_no: number; aya_no: number; sura_name_ar: string }[];
    for (const v of lib.verses) {
      const row = rows.find((r) => `kfc-hafs:${r.id}` === v.platformId)!;
      expect(`${row.sura_no}:${row.aya_no}`).toBe(v.reference);
      expect(surahs.get(row.sura_no)).toBe(row.sura_name_ar);
    }
  });
});

describe('unresolvable placeholders never reach the screen', () => {
  const rec = (id: string, type: ContentRecord['type'], extra: Partial<ContentRecord> = {}): ContentRecord =>
    ({ id, station: 'SX', type, text: `t ${id}`, level: 'NA', tts: false, status: 'approved', ...extra });
  const records = [
    rec('SX.V1', 'quran', { reference: '16:10', level: 'A' }),
    rec('SX.PS1', 'ui', { role: 'parent_line', text: 'ref {verseRef}' }),
    rec('SX.PS2', 'ui', { role: 'parent_line', text: 'bad {unknownThing}' }),
    rec('SX.X1', 'answer', { text: 'answer {verseRef}', level: 'A' }),
  ];
  const lib = buildLibrary([{
    stationId: 'SX', titleRecordId: null, records, anticipatedQuestions: [],
    script: [{ step: 'connect', verseCard: { quranId: 'SX.V1' } }, { step: 'close', parentSummaryIds: ['SX.PS1', 'SX.PS2'] }],
  }]);
  const surahs = new Map([[16, 'SURAH_FIXTURE']]);

  it('resolves a known one, drops a line it cannot resolve, and the content check reports both problems', () => {
    const parent = buildStationView(lib, 'SX', noFiles, placeholderValues(lib, 'SX', surahs))!.parent;
    expect(parent.map((r) => [r.id, r.text])).toEqual([['SX.PS1', 'ref 10 من سورة SURAH_FIXTURE']]);
    expect(placeholderProblems(lib, [], surahs)).toEqual([
      'SX.PS2: {unknownThing} cannot be resolved',
      'SX.X1: {verseRef} outside a parent line (also served unresolved)',
    ]);
  });

  it('without surah metadata, {verseRef} is unresolved and the line is not shown', () => {
    expect(buildStationView(lib, 'SX', noFiles, placeholderValues(lib, 'SX', new Map()))!.parent).toEqual([]);
  });
});

describe('build-time guard', () => {
  it('throws with record IDs when approved content has an unresolvable placeholder, and passes on the real content', async () => {
    const { assertNoPlaceholderProblems } = await import('./placeholders');
    const bad = buildLibrary([{
      stationId: 'SX', titleRecordId: null, anticipatedQuestions: [], script: [],
      records: [{ id: 'SX.PS9', station: 'SX', type: 'ui', role: 'parent_line', text: 'x {verseRef}', level: 'NA', tts: false, status: 'approved' }],
    }]);
    expect(() => assertNoPlaceholderProblems(bad, [], new Map())).toThrow('SX.PS9: {verseRef} cannot be resolved');
    expect(() => assertNoPlaceholderProblems(loadLibrary())).not.toThrow();
  });
});

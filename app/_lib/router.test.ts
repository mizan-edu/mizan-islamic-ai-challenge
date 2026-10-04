// Router: level A-D samples from eval/testset.json, offline (the model is mocked).

import { describe, expect, it, vi } from 'vitest';
import type { Classifier, ClassifierInput } from './classifier';
import type { Library } from './library';
import { sourcesOf } from './library';
import { buildReply } from './reply';
import { isAnswerable, route } from './router';
import { item, libraryWithDraftRules, runtimeLibrary, testItems, type TestItem } from './test-helpers';

const neverCalled: Classifier = vi.fn(async () => { throw new Error('classifier must not be called'); });

// Test oracle standing in for the model: picks the approved candidate that covers most of the
// item's expected citations (a verse on screen counts). It can only return IDs it was offered.
function oracle(lib: Library, t: TestItem): Classifier {
  return async (input: ClassifierInput) => {
    const expected = new Set(t.expectedCitations);
    let best: { id: string; cover: number } | null = null;
    for (const c of input.candidates) {
      const r = lib.byId.get(c.id);
      if (!r) continue;
      const covered = r.type === 'quran' ? [r.id] : isAnswerable(lib, r) ? [r.id, ...sourcesOf(lib, r).flatMap((id) => [id, ...sourcesOf(lib, lib.byId.get(id)!)])] : [];
      const cover = covered.filter((id) => expected.has(id)).length;
      if (cover > 0 && (!best || cover > best.cover)) best = { id: r.id, cover };
    }
    return { level: t.expectedLevel === 'B' ? 'B' : 'A', recordId: best?.id ?? null };
  };
}

describe('category A (in-station, levels A/B): answered only from approved records with sources', () => {
  const lib = runtimeLibrary();
  const items = testItems().filter((t) => t.category === 'A');

  it.each(items.map((t) => [t.id, t] as const))('%s', async (_id, t) => {
    const routed = await route(lib, { stationId: t.input.stationId, text: t.input.text, onScreen: t.input.context?.onScreen }, oracle(lib, t));
    expect(['answer', 'verse_card']).toContain(routed.behaviour);
    expect(['A', 'B', 'NA']).toContain(routed.level);
    const reply = buildReply(lib, t.input.stationId, routed);
    for (const id of t.expectedCitations) expect(reply.citations, `${t.id} cites ${id}`).toContain(id);
    for (const id of reply.citations) expect(lib.byId.get(id)?.status).toBe('approved');
  });

  it('A14 is answered deterministically from the anticipated question (no model call)', async () => {
    const t = item('A14');
    const routed = await route(lib, { stationId: t.input.stationId, text: t.input.text }, neverCalled);
    expect(routed).toMatchObject({ source: 'aq', behaviour: 'answer', recordId: 'S3.X2', level: 'A' });
  });
});

describe('levels C and D (draft router rules switched on): referral, no model call, no content', () => {
  const lib = libraryWithDraftRules();
  const cases = [
    ...['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'B04', 'B10', 'D01'].map((id) => [id, 'C'] as const),
    ...['F01', 'F02', 'F03', 'B05'].map((id) => [id, 'D'] as const),
  ];

  it.each(cases)('%s -> level %s', async (id, level) => {
    const t = item(id);
    const routed = await route(lib, { stationId: t.input.stationId, text: t.input.text }, neverCalled);
    expect(routed.level).toBe(level);
    expect(routed.source).toBe('rule');
    const rec = routed.recordId ? lib.byId.get(routed.recordId) : undefined;
    // A station's referral record; with no station, the approved fallback ("let's ask our family").
    expect(rec?.type).toBe(t.input.stationId ? 'referral' : 'fallback');
    expect(rec?.status).toBe('approved');
  });
});

describe('out of scope, hadith requests, role and privacy attempts: fallback', () => {
  const lib = libraryWithDraftRules();
  it.each(['B01', 'B02', 'B03', 'B06', 'B07', 'B08', 'B09', 'B12', 'E03', 'E04', 'G01', 'G02'])('%s', async (id) => {
    const t = item(id);
    const routed = await route(lib, { stationId: t.input.stationId, text: t.input.text }, neverCalled);
    expect(routed.behaviour).toBe('fallback');
    expect(lib.byId.get(routed.recordId!)?.type).toBe('fallback');
  });
});

describe('R5: deterministic rules run first and the model can never lower the level', () => {
  it('a rule-matched C question never reaches the model', async () => {
    const lib = libraryWithDraftRules();
    const lowering: Classifier = vi.fn(async () => ({ level: 'A' as const, recordId: 'S1.X1' }));
    const routed = await route(lib, { stationId: 'S1', text: item('C02').input.text }, lowering);
    expect(routed.level).toBe('C');
    expect(lowering).not.toHaveBeenCalled();
  });

  it('an anticipated C question keeps level C and its reviewed referral', async () => {
    const lib = runtimeLibrary();
    const aq = lib.stations.get('S1')!.anticipatedQuestions.find((q) => q.level === 'C')!;
    const routed = await route(lib, { stationId: 'S1', text: aq.childQuestion }, neverCalled);
    expect(routed).toMatchObject({ level: 'C', behaviour: 'referral', source: 'aq' });
  });

  it('a rule raises an anticipated A question to its stricter level', async () => {
    const lib = libraryWithDraftRules();
    const aq = lib.stations.get('S3')!.anticipatedQuestions.find((q) => q.level === 'A')!;
    const routed = await route(lib, { stationId: 'S3', text: `${aq.childQuestion} ${item('C01').input.text}` }, neverCalled);
    expect(routed.level).toBe('C');
  });
});

describe('runtime today: draft rules are inactive, so unmatched questions go to the classifier', () => {
  const lib = runtimeLibrary();

  it('no approved router rules are loaded while the rules file is draft', () => {
    expect(lib.rules).toEqual([]);
  });

  it('C01 uses the classifier; its level decides the referral', async () => {
    const c: Classifier = vi.fn(async () => ({ level: 'C' as const, recordId: null }));
    const routed = await route(lib, { stationId: 'S1', text: item('C01').input.text }, c);
    expect(c).toHaveBeenCalledOnce();
    expect(routed).toMatchObject({ level: 'C', behaviour: 'referral', recordId: 'S1.X3' });
  });

  it('D (personal ruling) from the classifier refers; no answer record is used', async () => {
    const c: Classifier = async () => ({ level: 'D', recordId: null });
    const routed = await route(lib, { stationId: 'S2', text: item('F02').input.text }, c);
    expect(routed).toMatchObject({ level: 'D', behaviour: 'referral', recordId: 'S2.X3' });
  });

  it('no classifier, invalid output or an unknown record ID all fall back', async () => {
    const q = { stationId: 'S1', text: item('D02').input.text };
    expect((await route(lib, q, null)).behaviour).toBe('fallback');
    expect((await route(lib, q, async () => null)).behaviour).toBe('fallback');
    expect((await route(lib, q, async () => ({ level: 'A', recordId: 'S9.UNKNOWN' }))).behaviour).toBe('fallback');
  });

  it('the classifier never sees verse or tafsir text, only their IDs and references', async () => {
    let seen: ClassifierInput | null = null;
    const spy: Classifier = async (input) => { seen = input; return null; };
    await route(lib, { stationId: 'S2', text: item('A09').input.text, onScreen: ['S2.V1', 'S2.T1'] }, spy);
    const verseCands = seen!.candidates.filter((c) => c.type === 'quran' || c.type === 'tafsir');
    expect(verseCands.length).toBeGreaterThan(0);
    expect(verseCands.every((c) => c.text === undefined)).toBe(true);
  });
});

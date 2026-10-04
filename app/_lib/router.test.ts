// Router: level A-D samples from eval/testset.json, offline (the model is mocked).

import { describe, expect, it, vi } from 'vitest';
import type { Classifier, ClassifierInput } from './classifier';
import type { Library } from './library';
import { sourcesOf } from './library';
import { buildReply } from './reply';
import { isAnswerable, route } from './router';
import { fireRules } from './router-rules';
import { item, libraryWithoutRules, rulesFile, runtimeLibrary, testItems, type TestItem } from './test-helpers';

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

describe('levels C and D (approved router rules): referral, no model call, no content', () => {
  const lib = runtimeLibrary();
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
  const lib = runtimeLibrary();
  it.each(['B01', 'B02', 'B03', 'B06', 'B07', 'B08', 'B09', 'B12', 'E03', 'E04', 'G01', 'G02'])('%s', async (id) => {
    const t = item(id);
    const routed = await route(lib, { stationId: t.input.stationId, text: t.input.text }, neverCalled);
    expect(routed.behaviour).toBe('fallback');
    expect(lib.byId.get(routed.recordId!)?.type).toBe('fallback');
  });
});

describe('R5: deterministic rules run first and the model can never lower the level', () => {
  it('a rule-matched C question never reaches the model', async () => {
    const lib = runtimeLibrary();
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
    const lib = runtimeLibrary();
    const aq = lib.stations.get('S3')!.anticipatedQuestions.find((q) => q.level === 'A')!;
    const routed = await route(lib, { stationId: 'S3', text: `${aq.childQuestion} ${item('C01').input.text}` }, neverCalled);
    expect(routed.level).toBe('C');
  });
});

describe('router rules at runtime (Review 1, D22)', () => {
  it('all rules (12 from D22, RR-D-VERSE-CLAIM from D25) are approved and load at runtime', () => {
    expect(rulesFile()).toHaveLength(13);
    expect(rulesFile().every((r) => r.status === 'approved' && r.reviewer1 === 'Hussein')).toBe(true);
    expect(runtimeLibrary().rules.map((r) => r.id).sort()).toEqual(rulesFile().map((r) => r.id).sort());
  });

  it('no rule fires on the in-station questions A01-A15', () => {
    const rules = runtimeLibrary().rules;
    for (const t of testItems().filter((i) => i.category === 'A')) expect(fireRules(rules, t.input.text).map((f) => f.id), t.id).toEqual([]);
  });
});

describe('RR-C-DEATH: narrowed for plant questions (Review 1)', () => {
  const rules = runtimeLibrary().rules;
  const fires = (text: string) => fireRules(rules, text).some((f) => f.id === 'RR-C-DEATH');

  it('does not fire on a plant question with no person, animal or afterlife word', () => {
    expect(fires('ليش ماتت الوردة؟')).toBe(false);
    expect(fires('ليش ماتت النبتة؟')).toBe(false);
  });

  it('still fires for a pet, for C01 and C06, and when a plant question also names a person or the afterlife', () => {
    expect(fires('ماتت قطتي، وين راحت؟')).toBe(true);
    expect(fires(item('C01').input.text)).toBe(true);
    expect(fires(item('C06').input.text)).toBe(true);
    expect(fires('ماتت الشجرة اللي زرعها جدي؟')).toBe(true);
    expect(fires('الوردة ماتت، هل تذهب إلى الجنة؟')).toBe(true);
  });
});

describe('classifier fallback (router rules switched off)', () => {
  const lib = libraryWithoutRules();

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

describe('silent safety nets kept after the Scholar Review 2 addendum (D23)', () => {
  const lib = runtimeLibrary();
  const nets = { B04: 'RR-C-SCHOLARS', B10: 'RR-C-SCHOLARS', C08: 'RR-C-SELF-JUDGEMENT' } as const;

  it.each(Object.entries(nets))('%s is rejected from the test set but still refers via %s, in every station', async (id, ruleId) => {
    const t = item(id);
    expect(t.status).toBe('rejected');
    for (const stationId of [null, 'S1', 'S2', 'S3']) {
      const routed = await route(lib, { stationId, text: t.input.text }, neverCalled);
      expect(routed.source).toBe('rule');
      expect(routed.ruleIds).toContain(ruleId);
      expect(['referral', 'fallback']).toContain(routed.behaviour);
      const rec = lib.byId.get(routed.recordId!)!;
      expect(['referral', 'fallback']).toContain(rec.type);
      // The referral never opens the topic: its own text fires no router rule (no scholars,
      // disagreement or verdict on the child) and it cites nothing.
      expect(fireRules(lib.rules, rec.text)).toEqual([]);
      expect(buildReply(lib, stationId, routed).segments.map((s) => s.recordId)).toEqual([rec.id]);
    }
  });
});

describe('RR-D-VERSE-CLAIM (D25): a verse claim with no matching verse goes to the station fallback', () => {
  const lib = runtimeLibrary();
  const fires = (text: string) => fireRules(lib.rules, text).some((f) => f.id === 'RR-D-VERSE-CLAIM');

  it('fires on the three question forms and on D06', () => {
    expect(fires(item('D06').input.text)).toBe(true);
    expect(fires('هل في القرآن أن الغيمة تتكلم؟')).toBe(true);
    expect(fires('هل يقول القرآن إن الشمس تسقي الزرع؟')).toBe(true);
    expect(fires('في آياتٍ عن المطر؟')).toBe(true);
  });

  it('does not fire on A01-A15 or on a question about the verse on screen', () => {
    for (const t of testItems().filter((i) => i.category === 'A')) expect(fires(t.input.text), t.id).toBe(false);
    expect(fires('شو يعني هاي الآية؟')).toBe(false);
    expect(fires('شو في الآية؟')).toBe(false);
  });

  it('D06 routes to S3.FB1 by rule, without a model call, and never to an answer', async () => {
    const t = item('D06');
    const routed = await route(lib, { stationId: t.input.stationId, text: t.input.text }, neverCalled);
    expect(routed).toMatchObject({ source: 'rule', behaviour: 'fallback', recordId: 'S3.FB1', level: 'OUT_OF_SCOPE' });
    expect(routed.ruleIds).toContain('RR-D-VERSE-CLAIM');
    expect(lib.byId.get('S3.FB1')?.type).toBe('fallback');
  });

  it('stands aside when the question contains a verse that reaches the match threshold', async () => {
    // Built in memory from the stored verse; never written anywhere.
    const verse = lib.byId.get('S1.V1')!;
    const text = `في آية بتقول ${verse.text}`;
    expect(fires(text)).toBe(true);
    const routed = await route(lib, { stationId: 'S1', text }, neverCalled);
    expect(routed.source).toBe('verse');
    expect(routed.ruleIds).not.toContain('RR-D-VERSE-CLAIM');
    expect(routed.recordId).toBe('S1.V1');
  });
});

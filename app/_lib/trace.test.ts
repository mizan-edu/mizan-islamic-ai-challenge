// Judge mode (A1): the per-turn trace and the judge flag. Every route type gives a complete trace of
// IDs and codes only (no Arabic record text, no input text); /api/ask adds it only with judge=1; the
// session event is the same with or without it. Never prints record or input text.

import { describe, expect, it, vi } from 'vitest';
import { createChainClassifier, type Classifier, type Provider } from './classifier';
import { JUDGE_KEY, NO_MODEL_CALL, judgeFromUrl, storeJudge, type FlagStorage } from './judge';
import { answerQuestion } from './pipeline';
import { answerWithTrace, isSafeTrace, type Trace } from './trace';
import { item, libraryWithoutRules, runtimeLibrary } from './test-helpers';

const lib = runtimeLibrary();
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const KEYS = ['route', 'behaviour', 'level', 'classifierLevel', 'provider', 'model', 'retrieved', 'thresholds', 'cited', 'validator', 'latencyMs', 'modelCalls'];

function expectComplete(trace: Trace, input: string) {
  expect(Object.keys(trace).sort()).toEqual([...KEYS].sort());
  expect(Object.keys(trace.route).sort()).toEqual(['code', 'fallbackReason', 'questionId', 'ruleIds', 'type', 'verseId']);
  expect(trace.route.code).toMatch(/^[A-Z_]+(\+LEVEL_FLOOR)?$/);
  expect(['A', 'B', 'C', 'D', 'OUT_OF_SCOPE', 'NA']).toContain(trace.level);
  expect(trace.model.length).toBeGreaterThan(0);
  expect(trace.thresholds).toEqual({ question: expect.any(Number), questionSharedWords: expect.any(Number), verse: expect.any(Number) });
  for (const r of trace.retrieved) expect(lib.byId.has(r.id), r.id).toBe(true);
  for (const id of trace.cited) expect(lib.byId.has(id), id).toBe(true);
  expect(['pass', 'blocked']).toContain(trace.validator.result);
  expect(Number.isInteger(trace.latencyMs) && trace.latencyMs >= 0).toBe(true);
  // IDs and codes only.
  const json = JSON.stringify(trace);
  expect(ARABIC.test(json), 'Arabic text in the trace').toBe(false);
  expect(json.includes(input), 'input text in the trace').toBe(false);
  for (const r of lib.byId.values()) if (r.text.length > 12) expect(json.includes(r.text)).toBe(false);
  expect(isSafeTrace(trace)).toBe(true);
}

describe('every route type produces a complete trace of IDs and codes', () => {
  it('router rule', async () => {
    const text = item('D06').input.text;
    const { trace } = await answerWithTrace(lib, { stationId: 'S3', text }, { classifier: vi.fn(async () => null), modelId: 'FIXTURE-MODEL' });
    expectComplete(trace, text);
    expect(trace.route).toMatchObject({ type: 'rule', code: 'ROUTER_RULE' });
    expect(trace.route.ruleIds).toContain('RR-D-VERSE-CLAIM');
    expect(trace).toMatchObject({ model: NO_MODEL_CALL, classifierLevel: null, validator: { result: 'pass' } });
  });

  it('anticipated question', async () => {
    const aq = lib.stations.get('S1')!.anticipatedQuestions.find((q) => q.level === 'A')!;
    const { trace } = await answerWithTrace(lib, { stationId: 'S1', text: aq.childQuestion });
    expectComplete(trace, aq.childQuestion);
    expect(trace.route).toMatchObject({ type: 'anticipated_question', questionId: aq.id });
    expect(trace.route.code).toMatch(/^AQ_MATCH/);
    expect(trace.retrieved).toContainEqual(expect.objectContaining({ kind: 'question', questionId: aq.id, id: aq.responseRecordId }));
    expect(trace.cited).toContain(aq.responseRecordId);
  });

  it('verse match', async () => {
    const text = lib.byId.get('S1.V1')!.text;
    const { trace } = await answerWithTrace(lib, { stationId: 'S1', text });
    expectComplete(trace, text);
    expect(trace.route).toMatchObject({ type: 'verse_match', code: 'VERSE_EXACT', verseId: 'S1.V1' });
    expect(trace.retrieved[0]).toMatchObject({ id: 'S1.V1', kind: 'verse', score: 1 });
  });

  it('model classifier (its own level and the model ID)', async () => {
    const text = item('C01').input.text;
    const classifier: Classifier = vi.fn(async () => ({ level: 'C' as const, recordId: null }));
    const { trace } = await answerWithTrace(libraryWithoutRules(), { stationId: 'S1', text }, { classifier, modelId: 'FIXTURE-MODEL' });
    expectComplete(trace, text);
    expect(classifier).toHaveBeenCalledOnce();
    expect(trace).toMatchObject({ route: { type: 'model_classifier', code: 'CLASSIFIER_LEVEL' }, level: 'C', classifierLevel: 'C', model: 'FIXTURE-MODEL', behaviour: 'referral' });
  });

  it('model calls: latency, tokens and result per provider attempt (AI lens, D54)', async () => {
    const text = item('C01').input.text;
    const provider: Provider = {
      name: 'anthropic', model: 'FIXTURE-PRIMARY', timeoutMs: 1000,
      call: async (_input, _signal, report) => { report?.({ inputTokens: 1200, outputTokens: 30 }); return { level: 'C', recordId: null }; },
    };
    const { trace } = await answerWithTrace(libraryWithoutRules(), { stationId: 'S1', text }, { classifier: createChainClassifier({ primary: provider }), modelId: 'FIXTURE-PRIMARY' });
    expectComplete(trace, text);
    expect(trace.modelCalls).toEqual([{ provider: 'anthropic', model: 'FIXTURE-PRIMARY', ms: expect.any(Number), inputTokens: 1200, outputTokens: 30, result: 'ok' }]);
  });

  it('model calls: a timed-out primary is recorded with no tokens, and the turn goes to the static tier', async () => {
    const text = item('C01').input.text;
    const provider: Provider = { name: 'anthropic', model: 'FIXTURE-PRIMARY', timeoutMs: 20, call: () => new Promise(() => {}) };
    const { trace } = await answerWithTrace(libraryWithoutRules(), { stationId: 'S1', text }, { classifier: createChainClassifier({ primary: provider }), modelId: 'FIXTURE-PRIMARY' });
    expectComplete(trace, text);
    expect(trace.route).toMatchObject({ type: 'fallback:static', fallbackReason: 'timeout' });
    expect(trace.modelCalls).toEqual([{ provider: 'anthropic', model: 'FIXTURE-PRIMARY', ms: expect.any(Number), inputTokens: null, outputTokens: null, result: 'timeout' }]);
  });

  it('no model call: modelCalls is empty', async () => {
    const aq = lib.stations.get('S1')!.anticipatedQuestions[0];
    expect((await answerWithTrace(lib, { stationId: 'S1', text: aq.childQuestion })).trace.modelCalls).toEqual([]);
  });

  it('fallback (no deterministic match, no classifier)', async () => {
    const text = item('D02').input.text;
    const { trace } = await answerWithTrace(libraryWithoutRules(), { stationId: 'S1', text });
    expectComplete(trace, text);
    expect(trace).toMatchObject({ route: { type: 'fallback', code: 'NO_MATCH_NO_CLASSIFIER' }, behaviour: 'fallback', model: NO_MODEL_CALL });
  });

  it('blocked by the citation validator (reason codes, never the blocked text)', async () => {
    const sciQ = lib.stations.get('S1')!.anticipatedQuestions.find((q) => q.level === 'NA')!;
    const bad = 'FIXTURE قال النبي FIXTURE';
    const { trace, reply } = await answerWithTrace(lib, { stationId: 'S1', text: sciQ.childQuestion }, { rephraser: async () => bad });
    expectComplete(trace, sciQ.childQuestion);
    expect(reply.behaviour).toBe('fallback');
    expect(trace.validator).toEqual({ result: 'blocked', codes: [`GENERATED_HADITH:${sciQ.responseRecordId}`] });
    expect(trace.behaviour).toBe('fallback');
    expect(JSON.stringify(trace)).not.toContain('FIXTURE');
  });
});

describe('trace safety and privacy', () => {
  it('isSafeTrace rejects any Arabic or long free text', () => {
    expect(isSafeTrace({ id: 'S1.X1', code: 'AQ_MATCH', n: 1, x: null })).toBe(true);
    expect(isSafeTrace({ id: 'نص' })).toBe(false);
    expect(isSafeTrace({ ids: ['S1.X1', 'a question typed by someone that runs on for a very long time indeed, far past any ID'] })).toBe(false);
  });

  it('the session event is the same with or without the trace (concept-level only)', async () => {
    const t = item('C06');
    const deps = { classifier: async () => ({ level: 'C' as const, recordId: null }), now: () => 1700000000 };
    const plain = await answerQuestion(lib, { stationId: 'S2', text: t.input.text }, deps);
    const traced = await answerWithTrace(lib, { stationId: 'S2', text: t.input.text }, deps);
    expect(traced.event).toEqual(plain.event);
    expect(Object.keys(traced.event!).sort()).toEqual(['event', 'level', 'sourceIds', 'stationId', 't']);
  });
});

describe('/api/ask: the trace only with judge=1', () => {
  const post = async (query: string) => {
    vi.stubEnv('LLM_PROVIDER', '');
    const { POST } = await import('@/app/api/ask/route');
    const aq = lib.stations.get('S1')!.anticipatedQuestions[0];
    const res = await POST(new Request(`http://localhost/api/ask${query}`, { method: 'POST', body: JSON.stringify({ stationId: 'S1', questionId: aq.id }) }));
    vi.unstubAllEnvs();
    return (await res.json()) as Record<string, unknown>;
  };

  it('default response is unchanged: no trace key', async () => {
    expect(Object.keys(await post('')).sort()).toEqual(['behaviour', 'event', 'level', 'segments', 'verses']);
    expect(Object.keys(await post('?judge=0'))).not.toContain('trace');
  });

  it('judge=1 adds a safe trace', async () => {
    const body = await post('?judge=1');
    expect(isSafeTrace(body.trace)).toBe(true);
    expect((body.trace as Trace).route.type).toBe('anticipated_question');
  });
});

describe('judge flag: off by default, ?judge=1 for this browser session only', () => {
  const storage = (): FlagStorage & { map: Map<string, string> } => {
    const map = new Map<string, string>();
    return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: (k) => { map.delete(k); } };
  };

  it('off by default', () => {
    expect(judgeFromUrl('', storage())).toBe(false);
    expect(judgeFromUrl('?x=1', null)).toBe(false);
  });

  it('?judge=1 turns it on and is remembered; ?judge=0 turns it off; only the flag is stored', () => {
    const s = storage();
    expect(judgeFromUrl('?judge=1', s)).toBe(true);
    expect(judgeFromUrl('', s)).toBe(true);
    expect([...s.map.entries()]).toEqual([[JUDGE_KEY, '1']]);
    expect(judgeFromUrl('?judge=0', s)).toBe(false);
    expect(judgeFromUrl('', s)).toBe(false);
    storeJudge(true, s);
    expect(judgeFromUrl('', s)).toBe(true);
  });

  it('storage that throws: the URL alone decides, nothing breaks', () => {
    const broken: FlagStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
    expect(judgeFromUrl('?judge=1', broken)).toBe(true);
    expect(judgeFromUrl('', broken)).toBe(false);
    expect(() => storeJudge(true, broken)).not.toThrow();
  });
});

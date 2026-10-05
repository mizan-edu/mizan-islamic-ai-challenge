// AI lens (D54): every station step yields its decisions, each labelled rule or model, with record
// IDs that exist in the approved library, the strictest level, and sources (platform + ID); model
// turns carry latency, tokens and the fallback flag. IDs and codes only. Never prints record text.

import { describe, expect, it } from 'vitest';
import { createChainClassifier, type Provider } from './classifier';
import { initialState, reducer, type FlowAction, type FlowState } from './flow';
import { stepDecisions, strictestLevel, traceDecision, type LensDecision } from './lens';
import { buildStationView } from './station-view';
import { item, libraryWithoutRules, runtimeLibrary } from './test-helpers';
import { answerWithTrace } from './trace';

const lib = runtimeLibrary();
const t = 1700000000;
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const view = (s: string) => buildStationView(lib, s, () => false)!;
const at = (s: string, actions: FlowAction[]): FlowState => actions.reduce((st, a) => reducer(view(s), st, a), initialState());
const AQ_IDS = new Set([...lib.stations.values()].flatMap((st) => st.anticipatedQuestions.map((q) => q.id)));
const codes = (d: LensDecision[]) => d.map((x) => x.code);

function expectClean(decisions: LensDecision[]) {
  expect(decisions.length).toBeGreaterThan(0);
  for (const d of decisions) {
    expect(['rule', 'model']).toContain(d.kind);
    for (const id of d.recordIds) expect(lib.byId.has(id) || AQ_IDS.has(id), id).toBe(true); // records, or the ask options' question IDs
    for (const s of d.sources) expect(lib.byId.has(s.id), s.id).toBe(true);
    expect(['NA', 'A', 'B', 'C', 'D', 'OUT_OF_SCOPE']).toContain(d.level);
  }
  expect(ARABIC.test(JSON.stringify(decisions)), 'Arabic text in the lens').toBe(false);
}

describe('decisions on every step (no model call anywhere in the child path)', () => {
  it.each(['S1', 'S2', 'S3'])('%s: frame, observe, connect, narrate and close are rule decisions from the station script', (s) => {
    const v = view(s);
    const o = v.observe!;
    const toConnect: FlowAction[] = [{ type: 'start' }, { type: 'choose', choiceId: o.correctChoiceId, t }, { type: 'next', t }];
    const toNarrate: FlowAction[] = [...toConnect, { type: 'next', t }, ...(v.ask.length ? [{ type: 'next', t } as FlowAction] : [])];
    const pick: FlowAction[] = v.narrate!.mode === 'order'
      ? (v.narrate!.expectedOrder ?? []).map((cardId) => ({ type: 'pick', cardId, t }))
      : [{ type: 'pick', cardId: v.narrate!.bestCardId!, t }];
    const states = [at(s, []), at(s, [{ type: 'start' }]), at(s, toConnect), at(s, toNarrate), at(s, [...toNarrate, ...pick]), at(s, [...toNarrate, ...pick, { type: 'next', t }])];
    expect(states.map((x) => x.step)).toEqual(['frame', 'observe', 'connect', 'narrate', 'narrate', 'close']);
    for (const st of states) {
      const d = stepDecisions(v, st);
      expectClean(d);
      expect(d.every((x) => x.kind === 'rule' && x.model === null)).toBe(true);
    }
    expect(codes(stepDecisions(v, states[0]))).toEqual(['SCRIPT_FRAME']);
    expect(codes(stepDecisions(v, states[4]))).toContain(v.narrate!.mode === 'order' ? 'NARRATE_ORDER_MATCH' : 'NARRATE_BEST_CARD');
    expect(codes(stepDecisions(v, states[5]))[0]).toBe(`SCRIPT_CLOSE · PLANT_STAGE_${v.close.stage}`);
  });

  it('observe: a set-aside choice, every hint rung, the together rung and the praise, in order', () => {
    const v = view('S1');
    const o = v.observe!;
    const other = o.choices.find((c) => c.id !== o.correctChoiceId)!.id;
    const hints: FlowAction[] = Array.from({ length: o.hints.length + 1 }, () => ({ type: 'hint', t }));
    const d = stepDecisions(v, at('S1', [{ type: 'start' }, { type: 'choose', choiceId: other, t }, ...hints, { type: 'choose', choiceId: o.correctChoiceId, t }]));
    expectClean(d);
    expect(codes(d)).toEqual(['SCRIPT_QUESTION', 'SCRIPT_REDIRECT', ...o.hints.map((_, i) => `HINT_LADDER_RUNG_${i + 1}`), 'HINT_TOGETHER', 'SCRIPT_PRAISE']);
    expect(d[1]).toMatchObject({ input: other, recordIds: [o.redirects[other].id] });
    expect(d.at(-1)).toMatchObject({ input: o.correctChoiceId, recordIds: [o.praise!.id] });
  });

  it.each(['S1', 'S2', 'S3'])('%s connect: the verse card lists the KFC snapshot, the QuranEnc tafsir, the explanations\' bases and the mp3quran recitation', (s) => {
    const v = view(s);
    const d = stepDecisions(v, at(s, [{ type: 'start' }, { type: 'choose', choiceId: v.observe!.correctChoiceId, t }, { type: 'next', t }]));
    const card = d.find((x) => x.code === 'SCRIPT_VERSE_CARD')!;
    const verse = card.sources.find((x) => x.id === v.connect!.verse!.id && x.platform !== 'mp3quran.net')!;
    expect(verse.platform).toBe(lib.byId.get(verse.id)!.sourcePlatform);
    expect(verse.platformId).toBe(lib.byId.get(verse.id)!.platformId);
    expect(card.sources.find((x) => x.id === v.connect!.tafsir!.id)?.platformId).toBe(v.connect!.tafsir!.platformId);
    expect(card.sources.some((x) => x.platform === 'mp3quran.net')).toBe(v.connect!.verse!.recitation !== null);
    expect(card.level).not.toBe('NA'); // the verse card carries the verse's level
  });
});

describe('ask step', () => {
  it('an approved question is a rule decision (anticipated question, no model call)', async () => {
    const v = view('S1');
    const aq = lib.stations.get('S1')!.anticipatedQuestions[0];
    const { trace } = await answerWithTrace(lib, { stationId: 'S1', text: aq.childQuestion });
    const d = traceDecision(v, trace, aq.id);
    expect(d).toMatchObject({ kind: 'rule', input: aq.id, model: null, recordIds: trace.cited, level: trace.level });
    expect(d.code).toMatch(/^anticipated_question · AQ_MATCH/);
  });

  it('a model turn shows latency, tokens and no fallback; a timed-out one shows the static fallback', async () => {
    const v = view('S1');
    const text = item('C01').input.text;
    const ok: Provider = { name: 'anthropic', model: 'FIXTURE-PRIMARY', timeoutMs: 1000, call: async (_i, _s, report) => { report?.({ inputTokens: 900, outputTokens: 20 }); return { level: 'C', recordId: null }; } };
    const slow: Provider = { name: 'anthropic', model: 'FIXTURE-PRIMARY', timeoutMs: 20, call: () => new Promise(() => {}) };
    const a = traceDecision(v, (await answerWithTrace(libraryWithoutRules(), { stationId: 'S1', text }, { classifier: createChainClassifier({ primary: ok }) })).trace, 'TYPED');
    expect(a).toMatchObject({ kind: 'model', level: 'C', model: { fallback: false, tier: 'primary', calls: [{ inputTokens: 900, outputTokens: 20, result: 'ok' }] } });
    const b = traceDecision(v, (await answerWithTrace(libraryWithoutRules(), { stationId: 'S1', text }, { classifier: createChainClassifier({ primary: slow }) })).trace, 'TYPED');
    expect(b).toMatchObject({ kind: 'model', model: { fallback: true, tier: 'static', calls: [{ inputTokens: null, result: 'timeout' }] } });
    expect(b.code).toContain('fallback:static');
  });
});

it('strictest level follows the router order and treats NA as lowest', () => {
  expect(strictestLevel(['NA', 'A', 'B'])).toBe('B');
  expect(strictestLevel(['A', 'OUT_OF_SCOPE', 'C'])).toBe('C');
  expect(strictestLevel([])).toBe('NA');
});

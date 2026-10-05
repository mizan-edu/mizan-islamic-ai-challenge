// Glass-box pipeline (D60): built only from the real trace; the classifier lights only when a model
// call is recorded; restricted paths are amber, never anything else; IDs and codes only. Traces come
// from the real pipeline (no model, or a fixture provider). Never prints record or input text.

import { describe, expect, it } from 'vitest';
import { createChainClassifier, type Provider } from './classifier';
import { GLASS_STEPS, isSafePipeline, pipelineFromTrace, REPLAY_MS, type GlassNode } from './glass';
import { buildStationView } from './station-view';
import { item, libraryWithoutRules, runtimeLibrary } from './test-helpers';
import { answerWithTrace } from './trace';

const lib = runtimeLibrary();
const sources = Object.assign({}, ...['S1', 'S2', 'S3'].map((s) => buildStationView(lib, s, () => false)!.sources));
const ARABIC = /[؀-ۿ]/;
const byStep = (nodes: GlassNode[]) => Object.fromEntries(nodes.map((n) => [n.step, n]));
const field = (n: GlassNode, key: string) => n.fields.find((x) => x.key === key)?.value;

async function preset(id: string) {
  const it = item(id);
  const { trace } = await answerWithTrace(lib, { stationId: it.input.stationId, text: it.input.text });
  return { trace, nodes: pipelineFromTrace(trace, { kind: 'preset', itemId: id, category: it.category, stationId: it.input.stationId }, sources) };
}

describe('pipeline from a real trace', () => {
  it('has the seven steps in order, IDs and codes only', async () => {
    const { nodes } = await preset('F02');
    expect(nodes.map((n) => n.step)).toEqual([...GLASS_STEPS]);
    expect(isSafePipeline(nodes)).toBe(true);
    expect(ARABIC.test(JSON.stringify(nodes))).toBe(false);
  });

  it('F02 (level D): decided by the fixed rules; classifier not used; referral in amber', async () => {
    const { trace, nodes } = await preset('F02');
    const s = byStep(nodes);
    expect(trace.modelCalls).toEqual([]);
    expect(s.rules).toMatchObject({ status: 'decided', tone: 'ok' });
    expect(field(s.rules, 'rules')).toBe(trace.route.ruleIds.join(' · '));
    expect(s.classifier).toMatchObject({ status: 'skipped', fields: [] });
    expect(s.level).toMatchObject({ tone: 'amber' });
    expect(field(s.level, 'level')).toBe('D');
    expect(field(s.level, 'category')).toBe('F');
    expect(s.output).toMatchObject({ tone: 'amber' });
    expect(field(s.output, 'behaviour')).toBe('referral');
  });

  it('B08 (out of scope): rules, fallback reply in amber, classifier not used', async () => {
    const s = byStep((await preset('B08')).nodes);
    expect(s.classifier.status).toBe('skipped');
    expect(field(s.level, 'level')).toBe('OUT_OF_SCOPE');
    expect(field(s.output, 'behaviour')).toBe('fallback');
    expect(s.output.tone).toBe('amber');
  });

  it('A14 (anticipated question): rules decide; the validator lists the verse by its KFC ID', async () => {
    const { trace, nodes } = await preset('A14');
    const s = byStep(nodes);
    expect(field(s.rules, 'route')).toMatch(/^anticipated_question · AQ_MATCH/);
    expect(s.classifier.status).toBe('skipped');
    const verses = trace.cited.filter((id) => lib.byId.get(id)?.type === 'quran');
    expect(verses.length).toBeGreaterThan(0);
    for (const id of verses) expect(field(s.validator, 'verses')).toContain(`${id} ${lib.byId.get(id)!.platformId}`);
    expect(field(s.validator, 'validator')).toBe('pass');
    expect(s.output.tone).toBe('ok');
  });

  it('a model call lights the classifier with model, latency, tokens and no fallback', async () => {
    const provider: Provider = { name: 'anthropic', model: 'FIXTURE-PRIMARY', timeoutMs: 1000, call: async (_i, _s, report) => { report?.({ inputTokens: 1300, outputTokens: 90 }); return { level: 'C', recordId: null }; } };
    const { trace } = await answerWithTrace(libraryWithoutRules(), { stationId: 'S1', text: item('C01').input.text }, { classifier: createChainClassifier({ primary: provider }) });
    const s = byStep(pipelineFromTrace(trace, { kind: 'typed', chars: 12, stationId: 'S1' }, sources));
    expect(s.rules.status).toBe('passed');
    expect(s.classifier).toMatchObject({ status: 'decided', tone: 'ok' });
    expect(field(s.classifier, 'model')).toBe('anthropic · FIXTURE-PRIMARY');
    expect(field(s.classifier, 'tokens')).toBe('1300 / 90');
    expect(field(s.classifier, 'fallback')).toBe('no');
    expect(field(s.question, 'input')).toBe('typed · 12 chars'); // the typed text itself never appears
  });

  it('a timed-out model call is shown as it happened: amber, with the static fallback tier', async () => {
    const slow: Provider = { name: 'anthropic', model: 'FIXTURE-PRIMARY', timeoutMs: 20, call: () => new Promise(() => {}) };
    const { trace } = await answerWithTrace(libraryWithoutRules(), { stationId: 'S1', text: item('C01').input.text }, { classifier: createChainClassifier({ primary: slow }) });
    const s = byStep(pipelineFromTrace(trace, { kind: 'typed', chars: 5, stationId: 'S1' }, sources));
    expect(s.classifier).toMatchObject({ status: 'decided', tone: 'amber' });
    expect(field(s.classifier, 'result')).toBe('timeout');
    expect(field(s.classifier, 'fallback')).toBe('static · timeout');
    expect(field(s.output, 'behaviour')).toBe('fallback');
  });

  it('never lights the classifier without a recorded model call', async () => {
    for (const id of ['F02', 'B08', 'A14', 'C02', 'G01']) expect(byStep((await preset(id)).nodes).classifier.status, id).toBe('skipped');
  });

  it('no red anywhere: tones are ok, neutral or amber only', async () => {
    for (const id of ['F02', 'B08', 'A14']) for (const n of (await preset(id)).nodes) expect(['ok', 'neutral', 'amber']).toContain(n.tone);
  });

  it('replays at a readable pace: at least 400 ms per step', () => {
    expect(REPLAY_MS).toBeGreaterThanOrEqual(400);
  });
});

// Glass-box view (D60): presets are existing active test items; the pipeline shows only what the trace
// shows, step by step; the reply (and any verse card) appears only after the replay; the typed text is
// never stored; links from the evaluation and parent pages; labels approved (D64). Never prints record text.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { pipelineFromTrace } from '@/app/_lib/glass';
import { loadLabels } from '@/app/_lib/labels';
import { replyView } from '@/app/_lib/reply-view';
import { buildStationView } from '@/app/_lib/station-view';
import { item, runtimeLibrary } from '@/app/_lib/test-helpers';
import { answerWithTrace } from '@/app/_lib/trace';
import GlassBox, { type GlassRun } from './GlassBox';
import { PRESET_IDS } from './presets';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const lib = runtimeLibrary();
const labels = loadLabels();
const views = ['S1', 'S2', 'S3'].map((s) => buildStationView(lib, s, () => false)!);
const sources = Object.assign({}, ...views.map((v) => v.sources));
const stations = views.map((v) => ({ id: v.stationId, title: v.stationId, questions: v.ask }));
const testset = JSON.parse(readFileSync(path.join(ROOT, 'eval', 'testset.json'), 'utf8')) as { items: { id: string; category: string; status: string; input: { stationId: string | null; text: string; mutation?: unknown } }[] };
const presets = PRESET_IDS.map((p) => { const it = testset.items.find((i) => i.id === p.id)!; return { ...p, category: it.category, stationId: it.input.stationId }; });

async function runOf(id: string): Promise<GlassRun> {
  const it = item(id);
  const res = await answerWithTrace(lib, { stationId: it.input.stationId, text: it.input.text });
  return { nodes: pipelineFromTrace(res.trace, { kind: 'preset', itemId: id, category: it.category, stationId: it.input.stationId }, sources), reply: replyView(lib, res.reply), latencyMs: res.trace.latencyMs };
}
const render = (run: GlassRun | null, revealed = 0) =>
  renderToString(<GlassBox labels={labels} stations={stations} sources={sources} presets={presets} maxChars={120} initialRun={run} initialRevealed={revealed} />);

describe('presets', () => {
  it('one existing, active, pickable test item per outcome (answer, verse card, referral, fallback)', () => {
    expect(PRESET_IDS.map((p) => p.outcome)).toEqual(['answer', 'verse_card', 'referral', 'fallback']);
    for (const p of PRESET_IDS) {
      const it = testset.items.find((i) => i.id === p.id);
      expect(it, p.id).toBeTruthy();
      expect(it!.status).toBe('approved');
      expect(it!.input.mutation).toBeFalsy();
      expect(it!.input.text).not.toMatch(/^\[GENERATED/);
    }
  });

  it('the rule-path presets give the outcome they are labelled with (F02 referral at level D, B08 fallback out of scope)', async () => {
    const f02 = await runOf('F02');
    expect(f02.reply.behaviour).toBe('referral');
    expect(f02.reply.level).toBe('D');
    const b08 = await runOf('B08');
    expect(b08.reply.behaviour).toBe('fallback');
    expect(b08.reply.level).toBe('OUT_OF_SCOPE');
  });
});

describe('glass view', () => {
  it('before any question: two tabs, four presets, seven pending steps, no reply', () => {
    const html = render(null);
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html.match(/data-glass-preset="/g)).toHaveLength(4);
    expect(html.match(/data-glass-state="pending"/g)).toHaveLength(7);
    expect(html).not.toContain('data-glass-reply');
    expect(html).not.toContain('data-glass-replay');
  });

  it('mid-replay: only the revealed steps carry trace data; the reply and any verse card wait for the end', async () => {
    const run = await runOf('A14');
    const html = render(run, 3);
    expect(html.match(/data-glass-state="pending"/g)).toHaveLength(4);
    expect(html).toContain('data-glass-replay');
    expect(html).not.toContain('data-glass-reply');
    expect(html).not.toContain('data-verse=');
  });

  it('after the replay: every step in its real state, the reply shown, the replay labelled with the real time', async () => {
    const run = await runOf('F02');
    const html = render(run, 7);
    expect(html).toMatch(/data-glass-step="rules" data-glass-state="decided"/);
    expect(html).toMatch(/data-glass-step="classifier" data-glass-state="skipped"/);
    expect(html).toMatch(/data-glass-step="output" data-glass-state="decided" data-glass-tone="amber"/);
    expect(html).toContain('data-glass-not-taken');
    expect(html).toContain('data-glass-reply="referral"');
    expect(html).toContain(`${run.latencyMs} ms`);
    expect(html).not.toMatch(/red-|#f00|rgb\(2[0-9]{2}, ?0, ?0\)/i);
  });

  it('keeps the typed text in component state only: no storage, no logging, no session event', () => {
    const src = readFileSync(path.join(ROOT, 'app', 'glass', 'GlassBox.tsx'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/sessionStorage|localStorage|indexedDB|document\.cookie|addEvents|console\./);
    expect(src).toContain("fetch('/api/try'");
    expect(src).toContain("fetch('/api/ask?judge=1'");
  });

  it('is linked from the evaluation page and, behind the gate, from the parent page', () => {
    expect(readFileSync(path.join(ROOT, 'app', 'evaluation', 'EvaluationContent.tsx'), 'utf8')).toContain('href="/glass"');
    expect(readFileSync(path.join(ROOT, 'app', 'parent', 'page.tsx'), 'utf8')).toMatch(/<ParentGate[^>]*>[\s\S]*href="\/glass"[\s\S]*<\/ParentGate>/);
    expect(readFileSync(path.join(ROOT, 'README.md'), 'utf8')).toMatch(/^2\. .*`\/glass`/m);
  });

  it('its 18 labels are approved (D64) and load; no English placeholder is shown any more', () => {
    const ui = JSON.parse(readFileSync(path.join(ROOT, 'content', 'ui.json'), 'utf8')) as { records: { id: string; text: string; status: string; level: string; reviewer1: unknown }[] };
    const glass = ui.records.filter((r) => r.id.startsWith('UI.GLASS_'));
    expect(glass).toHaveLength(18);
    for (const r of glass) expect(r, r.id).toMatchObject({ status: 'approved', level: 'NA', reviewer1: 'Hussein' });
    expect(glass.find((r) => r.id === 'UI.GLASS_INTRO')!.text).toBe('كل خطوة أدناه مأخوذة من المسار الفعلي الذي أعاده الخادم لهذا السؤال. الخطوات التي لم تحدث تبقى باهتة.');
    for (const k of ['glassTitle', 'glassIntro', 'glassLink', 'glassTabAsk', 'glassTabChild', 'glassPresets', 'glassNodeQuestion', 'glassNodeRules', 'glassNodeClassifier', 'glassNodeLevel', 'glassNodeLibrary', 'glassNodeValidator', 'glassNodeOutput', 'glassNotTaken', 'glassReplay', 'glassRealTime', 'glassChildIntro', 'glassChildCounter'] as const) expect(labels[k], k).toBeTruthy();
    const html = render(null);
    for (const english of ['Glass box', 'Adult question', 'Child mode', 'Test-set examples', 'Fixed rules', 'AI classifier (model)']) expect(html).not.toContain(english);
  });
});

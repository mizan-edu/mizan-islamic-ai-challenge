// Judge panel (A1) on the station ask step: absent unless judge mode is on; under the reply, below the
// step's controls, never inside the reply card or a verse card; the twelve labels are approved (D37).
// Replies are built through the real pipeline from approved questions; never prints record text.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { loadLabels, type Labels } from '@/app/_lib/labels';
import { askStep } from './ask-fixture';
import { initialState, reducer, type FlowAction, type FlowState } from '@/app/_lib/flow';
import { buildStationView } from '@/app/_lib/station-view';
import { runtimeLibrary } from '@/app/_lib/test-helpers';
import ParentGate, { GATE_CODE, gateStep } from './ParentGate';
import StationFlow from './StationFlow';

const labels = loadLabels();
const JUDGE_KEYS: (keyof Labels)[] = ['judgeMode', 'judgeRoute', 'judgeLevel', 'judgeClassifierLevel', 'judgeModel', 'judgeNoModelCall', 'judgeRetrieved', 'judgeCited', 'judgeValidator', 'judgePass', 'judgeBlocked', 'judgeLatency'];

describe('judge panel on the ask step', () => {
  it('the twelve judge-panel labels are approved and load (D37)', () => {
    for (const k of JUDGE_KEYS) expect(labels[k], k).toBeTruthy();
  });

  it.each(['S1', 'S2'])('%s: off by default — no panel, even when a trace is present', async (s) => {
    const { view, state, ask } = await askStep(s);
    const html = renderToString(<StationFlow view={view} labels={labels} initial={state} initialAsk={ask} />);
    expect(html).toContain('data-answer=');
    expect(html).not.toContain('data-judge-panel');
  });

  it.each(['S1', 'S2'])('%s: on — one panel below the controls, outside the reply and away from any verse card', async (s) => {
    const { view, state, ask } = await askStep(s, 'withVerse');
    const html = renderToString(<StationFlow view={view} labels={labels} initial={state} initialAsk={ask} initialJudge />);
    expect(html.match(/data-judge-panel/g)).toHaveLength(1);
    const section = /<section[^>]*data-screen="ask"[\s\S]*<\/section>/.exec(html)![0];
    const panelAt = section.indexOf('data-judge-panel');
    const answer = /<div[^>]*data-answer=[\s\S]*?(?=<button[^>]*data-action="next")/.exec(section)![0];
    expect(answer).not.toContain('data-judge-panel');
    expect(panelAt).toBeGreaterThan(section.indexOf('data-action="next"')); // the Next button sits between
    expect(section.slice(panelAt)).not.toContain('data-verse=');
    expect(section.slice(panelAt)).not.toMatch(/anim-/);
    for (const f of ['route', 'level', 'classifierLevel', 'model', 'retrieved', 'cited', 'validator', 'latency']) expect(section).toContain(`data-judge-field="${f}"`);
    expect(section).toContain(labels.judgeNoModelCall!); // approved questions route without a model call
    expect(section).toContain(labels.judgePass!);
  });
});

describe('AI lens on every step (D54)', () => {
  const lib = runtimeLibrary();
  const t = 1700000000;
  const view = (s: string) => buildStationView(lib, s, () => false)!;
  const at = (s: string, actions: FlowAction[]): FlowState => actions.reduce((st, a) => reducer(view(s), st, a), initialState());
  const toConnect = (s: string): FlowAction[] => [{ type: 'start' }, { type: 'choose', choiceId: view(s).observe!.correctChoiceId, t }, { type: 'next', t }];
  const render = (s: string, state: FlowState, judge: boolean) => renderToString(<StationFlow view={view(s)} labels={labels} initial={state} initialJudge={judge} />);

  it.each(['S1', 'S2', 'S3'])('%s: off by default on every step', (s) => {
    for (const st of [at(s, []), at(s, [{ type: 'start' }]), at(s, toConnect(s))]) expect(render(s, st, false)).not.toContain('data-judge-panel');
  });

  it.each(['S1', 'S2', 'S3'])('%s: on — one panel per step, each decision labelled rule or model, no animation', (s) => {
    for (const st of [at(s, []), at(s, [{ type: 'start' }]), at(s, toConnect(s))]) {
      const html = render(s, st, true);
      expect(html.match(/data-judge-panel/g)).toHaveLength(1);
      const panel = /<details[^>]*data-judge-panel[\s\S]*?<\/details>/.exec(html)![0];
      expect(panel).toMatch(/data-lens-kind="rule"/);
      expect(panel).not.toMatch(/data-lens-kind="(?!rule|model)/);
      expect(panel).not.toMatch(/anim-|transition/);
      for (const f of ['decision', 'records', 'decisionLevel', 'noModel']) expect(panel).toContain(`data-judge-field="${f}"`);
    }
  });

  it.each(['S1', 'S2', 'S3'])('%s connect: the panel sits after the connect section (below its Next button), never inside it or the verse card', (s) => {
    const html = render(s, at(s, toConnect(s)), true);
    const section = /<section[^>]*data-screen="connect"[\s\S]*?<\/section>/.exec(html)![0];
    expect(section).not.toContain('data-judge-panel');
    expect(html.indexOf('data-judge-panel')).toBeGreaterThan(html.indexOf(section) + section.length - 1);
    expect(/<details[^>]*data-judge-panel[\s\S]*?<\/details>/.exec(html)![0]).toContain('data-judge-field="source"');
  });

  it('ask step before any question: the panel lists the offered question IDs', () => {
    const v = view('S1');
    const html = render('S1', at('S1', [...toConnect('S1'), { type: 'next', t }]), true);
    expect(html).toContain('data-lens-code="SCRIPT_ASK_OPTIONS"');
    for (const q of v.ask) expect(html).toContain(q.id);
  });
});

describe('parental gate (D54)', () => {
  it('7, 3, 9 in order opens it; a wrong digit quietly starts again', () => {
    let s = { entered: [] as number[], open: false };
    for (const d of [7, 3, 9]) s = gateStep(s.entered, d);
    expect(s.open).toBe(true);
    expect(gateStep([7, 3], 8)).toEqual({ entered: [], open: false });
    expect(gateStep([7, 3], 7)).toEqual({ entered: [7], open: false });
    expect(gateStep([], 3)).toEqual({ entered: [], open: false });
    expect(GATE_CODE).toEqual([7, 3, 9]);
  });

  it('closed: shows the keypad (80 px keys, 16 px gaps, Western numerals), not what it guards', () => {
    const html = renderToString(<ParentGate prompt="FIXTURE_PROMPT"><span data-guarded /></ParentGate>);
    expect(html).toContain('data-parent-gate');
    expect(html).not.toContain('data-guarded');
    expect(html.match(/data-gate-key="\d"/g)).toHaveLength(9);
    expect(html).toMatch(/class="grid grid-cols-3 gap-4"/);
    for (const k of html.match(/<button[^>]*data-gate-key[^>]*>/g)!) expect(k).toContain('size-20');
    expect(html).not.toMatch(/[٠-٩]/);
  });

  it('the parent page puts the lens switch behind the gate; the six D54 labels are approved (D55) and load', () => {
    const page = readFileSync(path.join(process.cwd(), 'app', 'parent', 'page.tsx'), 'utf8');
    expect(page).toMatch(/<ParentGate[^>]*>[\s\S]*<JudgeSwitch[\s\S]*<\/ParentGate>/);
    const ui = JSON.parse(readFileSync(path.join(process.cwd(), 'content', 'ui.json'), 'utf8')) as { records: { id: string; status: string; level: string; reviewer1: unknown; reviewer2: unknown }[] };
    for (const id of ['UI.GATE_PROMPT', 'UI.JUDGE_DECISION', 'UI.JUDGE_RECORDS', 'UI.JUDGE_SOURCE', 'UI.JUDGE_TOKENS', 'UI.JUDGE_FALLBACK']) {
      const r = ui.records.find((x) => x.id === id);
      expect(r, id).toMatchObject({ status: 'approved', level: 'NA', reviewer1: 'Hussein', reviewer2: null });
    }
    for (const k of ['gatePrompt', 'judgeDecision', 'judgeRecords', 'judgeSource', 'judgeTokens', 'judgeFallback'] as const) expect(labels[k], k).toBeTruthy();
    expect(labels.gatePrompt).not.toMatch(/[٠-٩]/); // Western numerals
  });
});

// Judge panel (A1) on the station ask step: absent unless judge mode is on; under the reply, below the
// step's controls, never inside the reply card or a verse card; the twelve labels are approved (D37).
// Replies are built through the real pipeline from approved questions; never prints record text.

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { loadLabels, type Labels } from '@/app/_lib/labels';
import { askStep } from './ask-fixture';
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

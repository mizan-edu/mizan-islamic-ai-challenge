// Every button and link on the station screens has an accessible name: visible text, or an
// aria-label from the approved UI strings (content/ui.json). Lighthouse button-name / link-name.

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { initialState, reducer, type FlowAction } from '@/app/_lib/flow';
import { loadLabels } from '@/app/_lib/labels';
import { publicFileExists } from '@/app/_lib/media';
import { buildStationView } from '@/app/_lib/station-view';
import { runtimeLibrary } from '@/app/_lib/test-helpers';
import StationFlow from './StationFlow';

const lib = runtimeLibrary();
const labels = loadLabels();
const t = 1700000000;

function unnamed(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const [, tag, attrs, inner] = m;
    // An image's non-empty alt text names its button (picture choices and narration cards).
    const aria = /aria-label="([^"]+)"/.exec(attrs)?.[1]?.trim() || /<img[^>]*\balt="([^"]+)"/.exec(inner)?.[1]?.trim();
    const text = inner.replace(/<span[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '').replace(/<!-- -->/g, '').trim();
    if (!aria && !text) out.push(`${tag} ${/data-(?:action|record|narration|recitation|question)="?[^" ]*"?/.exec(attrs)?.[0] ?? attrs.slice(0, 40)}`);
  }
  return out;
}

describe('accessible names on the station screens', () => {
  it('the five button labels are approved and load', () => {
    for (const k of ['play', 'playRecitation', 'hint', 'next', 'home'] as const) expect(labels[k], k).toBeTruthy();
  });

  it.each(['S1', 'S2', 'S3'])('%s: every button and link in every step is named', (s) => {
    const view = buildStationView(lib, s, publicFileExists)!;
    const o = view.observe!;
    const steps: FlowAction[][] = [[], [{ type: 'start' }]];
    steps.push([...steps[1], { type: 'choose', choiceId: o.correctChoiceId, t }]);
    steps.push([...steps[2], { type: 'next', t }]); // connect
    steps.push([...steps[3], { type: 'next', t }]); // ask
    steps.push([...steps[4], { type: 'next', t }]); // narrate
    for (const actions of steps) {
      const state = actions.reduce((st, a) => reducer(view, st, a), initialState());
      const html = renderToString(<StationFlow view={view} labels={labels} initial={state} />);
      expect(unnamed(html), `${s} step ${state.step}`).toEqual([]);
    }
    const close = { ...initialState(), step: 'close' as const };
    expect(unnamed(renderToString(<StationFlow view={view} labels={labels} initial={close} />)), `${s} close`).toEqual([]);
  });
});

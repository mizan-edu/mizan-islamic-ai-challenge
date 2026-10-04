// Child screens rendered to HTML (server render): no text input anywhere, the verse card comes from
// the library (compared by hash, never printed), feedback after a wrong choice and hints.

import { createHash } from 'node:crypto';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { initialState, reducer, type FlowAction, type FlowState } from '@/app/_lib/flow';
import { buildStationView } from '@/app/_lib/station-view';
import { runtimeLibrary } from '@/app/_lib/test-helpers';
import JourneyMap from './JourneyMap';
import StationFlow from './StationFlow';

const lib = runtimeLibrary();
const S1 = buildStationView(lib, 'S1', () => false)!;
const labels = { parents: 'FIXTURE_PARENTS' };
const t = 1700000000;
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const stateAt = (actions: FlowAction[]): FlowState => actions.reduce((s, a) => reducer(S1, s, a), initialState());
const render = (state: FlowState) => renderToString(<StationFlow view={S1} labels={labels} initial={state} />);

const TO_OBSERVE: FlowAction[] = [{ type: 'start' }];
const TO_CONNECT: FlowAction[] = [...TO_OBSERVE, { type: 'choose', choiceId: 'S1.Q1.c1', t }, { type: 'next', t }];
const TO_ASK: FlowAction[] = [...TO_CONNECT, { type: 'next', t }];
const TO_NARRATE: FlowAction[] = [...TO_ASK, { type: 'next', t }];
const TO_CLOSE: FlowAction[] = [...TO_NARRATE, ...['S1.N1', 'S1.N2', 'S1.N3'].map((cardId) => ({ type: 'pick' as const, cardId, t })), { type: 'next', t }];

const screens: [string, FlowAction[]][] = [
  ['frame', []], ['observe', TO_OBSERVE], ['connect', TO_CONNECT], ['ask', TO_ASK], ['narrate', TO_NARRATE], ['close', TO_CLOSE],
];

describe('no text input on child screens', () => {
  it.each(screens)('%s screen has no input, textarea, select or editable element', (name, actions) => {
    const html = render(stateAt(actions));
    expect(html).toContain(`data-screen="${name}"`);
    expect(html).not.toMatch(/<input|<textarea|<select|contenteditable/i);
  });

  it('journey map has no text input and shows only S1-S3', () => {
    const html = renderToString(<JourneyMap title="FIXTURE" stations={[1, 2, 3].map((n) => ({ id: `S${n}`, number: n, title: `FIXTURE_${n}`, stage: n }))} />);
    expect(html).not.toMatch(/<input|<textarea|<select|contenteditable/i);
    expect(html).toContain('data-station="S1"');
    expect(html).not.toMatch(/data-station="S[45]"/);
    expect(html).toMatch(/data-station="S1" data-open="true"/);
    expect(html).toMatch(/data-station="S2" data-open="false"/);
  });
});

describe('verse card renders from the approved library', () => {
  const html = render(stateAt(TO_CONNECT));
  const verse = lib.byId.get('S1.V1')!;

  it('the verse text is byte-identical to the stored record (hash comparison)', () => {
    const m = /<blockquote[^>]*data-verse-text[^>]*>([\s\S]*?)<\/blockquote>/.exec(html);
    expect(m).not.toBeNull();
    expect(sha(unescape(m![1])) === sha(verse.text)).toBe(true);
    expect(m![0]).toContain('font-quran');
    expect(m![0]).toContain('dir="rtl"');
  });

  it('shows the reference and a recitation button for the real mp3quran audio', () => {
    expect(html).toContain('data-reference');
    expect(html).toContain('>16:10<');
    expect(html).toContain(`data-recitation="${(verse.recitation as { audioUrl: string }).audioUrl}"`);
    expect(html).toMatch(/<audio[^>]+src="https:\/\/server13\.mp3quran\.net\/husr\/016\.mp3#t=198\.457,224\.463"/);
  });

  it('the tafsir appears only inside the parents toggle', () => {
    const tafsir = lib.byId.get('S1.T1')!;
    const details = /<details[^>]*data-parents-toggle[^>]*>([\s\S]*?)<\/details>/.exec(html);
    expect(details).not.toBeNull();
    expect(details![1]).toContain('FIXTURE_PARENTS');
    const inside = unescape(details![1]).includes(tafsir.text);
    const outside = unescape(html.replace(details![0], '')).includes(tafsir.text);
    expect(inside).toBe(true);
    expect(outside).toBe(false);
  });

  it('the explanation follows the verse card', () => {
    expect(html.indexOf('data-verse="S1.V1"')).toBeLessThan(html.indexOf('data-line="S1.E1"'));
  });
});

describe('wrong choice, then hints (rendered)', () => {
  it('greys the chosen card, shows its redirect, never says "wrong", and H5 highlights the answer', () => {
    let html = render(stateAt([...TO_OBSERVE, { type: 'choose', choiceId: 'S1.Q1.c2', t }]));
    expect(html).toMatch(/data-record="S1\.Q1\.c2" data-state="greyed"/);
    expect(html).toContain('data-feedback="S1.R1"');
    expect(html).not.toMatch(/wrong|incorrect|❌|✗|✖/i);
    expect(html).not.toMatch(/text-red|bg-red/);

    html = render(stateAt([...TO_OBSERVE, { type: 'choose', choiceId: 'S1.Q1.c2', t }, ...Array.from({ length: 5 }, () => ({ type: 'hint' as const, t }))]));
    expect(html).toContain('data-feedback="S1.H5"');
    expect(html).toMatch(/data-record="S1\.Q1\.c1" data-state="highlight"/);
    expect(html).toMatch(/data-action="hint"[^>]*disabled/);
  });

  it('missing pictures and narration render as placeholders and disabled play buttons', () => {
    const html = render(stateAt(TO_OBSERVE));
    expect((html.match(/data-placeholder="picture"/g) ?? []).length).toBe(3);
    expect(html).toContain('data-narration="missing"');
    expect(html).not.toContain('data-narration="available"');
  });
});

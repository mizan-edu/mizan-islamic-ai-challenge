// Q3 station screens: verse reference line, nothing moving on or near the verse, step dots, and the
// full-screen moments (decorative, no text). Never prints record text.

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { initialState, reducer, type FlowAction, type FlowState } from '@/app/_lib/flow';
import { publicFileExists } from '@/app/_lib/media';
import { buildStationView } from '@/app/_lib/station-view';
import { runtimeLibrary } from '@/app/_lib/test-helpers';
import { MomentOverlay } from './moments';
import StationFlow from './StationFlow';

const lib = runtimeLibrary();
const t = 1700000000;
const LABELS = { surah: 'FIXTURE_SURAH', ayah: 'FIXTURE_AYAH', verseLabel: 'FIXTURE_LABEL' };
const view = (s: string) => buildStationView(lib, s, () => false)!;
const at = (s: string, actions: FlowAction[]): FlowState => actions.reduce((st, a) => reducer(view(s), st, a), initialState());
const toConnect = (s: string): FlowAction[] => [{ type: 'start' }, { type: 'choose', choiceId: view(s).observe!.correctChoiceId, t }, { type: 'next', t }];
const render = (s: string, state: FlowState) => renderToString(<StationFlow view={view(s)} labels={LABELS} initial={state} />);
const decode = (h: string) => h.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/<!-- -->/g, '');

describe('verse card reference line (KFC surah name and ayah number)', () => {
  it.each(['S1', 'S2', 'S3'])('%s shows «<surah label> <KFC name> · <ayah label> <n>» with Western numerals', (s) => {
    const html = render(s, at(s, toConnect(s)));
    const v = view(s).connect!.verse!;
    const [sura, ayah] = v.reference.split(':').map(Number);
    const m = /<p[^>]*data-reference="[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(html);
    expect(m).not.toBeNull();
    expect(decode(m![1])).toBe(`FIXTURE_SURAH ${lib.surahs.get(sura)} · FIXTURE_AYAH ${ayah}`);
    expect(m![1]).not.toMatch(/[٠-٩]/);
  });

  it('falls back to the plain reference when the labels are missing', () => {
    const html = renderToString(<StationFlow view={view('S1')} labels={{}} initial={at('S1', toConnect('S1'))} />);
    expect(/<p[^>]*data-reference="16:10"[^>]*>16:10<\/p>/.test(html)).toBe(true);
  });
});

describe('nothing moves on or near the verse', () => {
  it.each(['S1', 'S2', 'S3'])('%s connect step: no animation class anywhere in the section', (s) => {
    const html = render(s, at(s, toConnect(s)));
    const section = /<section[^>]*data-screen="connect"[\s\S]*<\/section>/.exec(html)![0];
    expect(section).not.toMatch(/anim-|transition/);
  });
});

describe('step dots', () => {
  it('show the current step (ask shares the connect dot)', () => {
    const steps: [FlowAction[], number][] = [[[], 0], [[{ type: 'start' }], 1], [toConnect('S1'), 2], [[...toConnect('S1'), { type: 'next', t }], 2]];
    for (const [actions, dot] of steps) expect(render('S1', at('S1', actions))).toContain(`data-step-dots="${dot}"`);
  });

  it('S1 shows the S1.N1 scene picture beside the prompt (no question picture of its own)', () => {
    const withFiles = buildStationView(lib, 'S1', publicFileExists)!;
    const html = renderToString(<StationFlow view={withFiles} labels={LABELS} initial={reducer(withFiles, initialState(), { type: 'start' })} />);
    expect(html).toContain('data-scene-picture="S1.N1"');
    expect(html).not.toContain('data-question-picture');
  });
});

describe('moments (full screen, decorative)', () => {
  const pic = (src: string) => ({ src, width: 1168, height: 880 });
  const pics = { scene: pic('/images/S1/S1.N1.webp'), from: pic('/images/S2/S2.Q1.webp'), to: pic('/images/S2/S2.N1.webp') };
  it.each(['S1', 'S2', 'S3'])('%s renders a text-free, aria-hidden overlay', (s) => {
    const html = renderToString(<MomentOverlay stationId={s} pictures={pics} onDone={() => {}} />);
    expect(html).toContain(`data-moment="${s}"`);
    expect(html).toContain('aria-hidden="true"');
    expect(html.replace(/<[^>]+>/g, '').trim()).toBe('');
  });

  it('S3 plays plant stages 1, 2, 3 in sequence; S2 cross-fades S2.Q1 into S2.N1', () => {
    const s3 = renderToString(<MomentOverlay stationId="S3" pictures={pics} onDone={() => {}} />);
    expect([...s3.matchAll(/<img[^>]*plant\/stage-(\d)\.webp/g)].map((m) => m[1])).toEqual(['1', '2', '3']);
    const s2 = renderToString(<MomentOverlay stationId="S2" pictures={pics} onDone={() => {}} />);
    expect(s2.indexOf('S2.Q1.webp')).toBeLessThan(s2.indexOf('S2.N1.webp'));
    expect(s2).toContain('anim-fade-out-late');
  });

  it('is not open on first render of a solved state (it opens only from the tap)', () => {
    expect(render('S1', at('S1', [{ type: 'start' }, { type: 'choose', choiceId: 'S1.Q1.c1', t }]))).not.toContain('data-moment=');
  });
});

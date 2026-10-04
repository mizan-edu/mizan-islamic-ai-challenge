// Station flow state machine on the real, approved S1/S2 views (media files mocked as missing).

import { describe, expect, it } from 'vitest';
import { makeEvent } from './events';
import { initialState, reducer, type FlowAction, type FlowState } from './flow';
import { narrationSrc, recitationSrc } from './media';
import { buildStationView, type StationView } from './station-view';
import { runtimeLibrary } from './test-helpers';

const lib = runtimeLibrary();
const none = () => false;
const S1 = buildStationView(lib, 'S1', none)!;
const S2 = buildStationView(lib, 'S2', none)!;

function run(view: StationView, actions: FlowAction[], from: FlowState = initialState()): FlowState {
  return actions.reduce((s, a) => reducer(view, s, a), from);
}
const t = 1700000000;

describe('S1 view from the approved library', () => {
  it('resolves every step of the S1 script', () => {
    expect(S1.title?.id).toBe('S1.TITLE');
    expect(S1.frame.map((r) => r.id)).toEqual(['S1.F1']);
    expect(S1.observe?.choices.map((c) => c.id)).toEqual(['S1.Q1.c1', 'S1.Q1.c2', 'S1.Q1.c3']);
    expect(S1.observe?.hints.map((h) => h.id)).toEqual(['S1.H1', 'S1.H2', 'S1.H3', 'S1.H4']);
    expect(S1.observe?.together?.id).toBe('S1.H5');
    expect(S1.observe?.highlightChoiceId).toBe('S1.Q1.c1');
    expect(S1.connect?.verse?.id).toBe('S1.V1');
    expect(S1.connect?.tafsir?.id).toBe('S1.T1');
    expect(S1.connect?.explanations[0]?.id).toBe('S1.E1');
    expect(S1.ask.length).toBeGreaterThanOrEqual(2);
    expect(S1.ask.length).toBeLessThanOrEqual(3);
    expect(S1.narrate).toMatchObject({ mode: 'order', expectedOrder: ['S1.N1', 'S1.N2', 'S1.N3'] });
    expect(S1.close).toEqual({ lines: [expect.objectContaining({ id: 'S1.CL1' })], stage: 1 });
    expect(S1.parent.map((r) => r.id)).toEqual(['S1.PS1', 'S1.PS2']);
    expect(S1.nextStationId).toBe('S2');
  });

  it('no verse, tafsir or rejected record leaks into ordinary lines', () => {
    const all = [S1.title, ...S1.frame, S1.observe?.question, ...(S1.observe?.choices ?? []), S1.connect?.bridge, S1.connect?.listen, ...(S1.connect?.explanations ?? []), ...(S1.narrate?.cards ?? [])];
    for (const r of all) expect(['quran', 'tafsir', 'hadith']).not.toContain(r?.type);
    expect(JSON.stringify(S1)).not.toContain('S1.V1-ALT');
  });

  it('missing media: narration buttons have no source and pictures fall back to placeholders', () => {
    expect(S1.frame[0].audio).toBeNull();
    expect(S1.observe?.choices.every((c) => c.image === null)).toBe(true);
    const withFiles = buildStationView(lib, 'S1', () => true)!;
    expect(withFiles.frame[0].audio).toBe('/audio/S1/S1.F1.mp3');
    expect(withFiles.observe?.choices[0].image).toBe('/images/S1/S1.Q1.c1.webp');
  });

  it('R4: a quran record never gets narration, even if a file exists; recitation uses a media fragment', () => {
    const verse = lib.byId.get('S1.V1')!;
    expect(narrationSrc('S1', verse, () => true)).toBeNull();
    expect(recitationSrc('https://example.invalid/016.mp3', 198457, 224463)).toBe('https://example.invalid/016.mp3#t=198.457,224.463');
    expect(S1.connect?.verse?.recitation?.src).toMatch(/^https:\/\/server13\.mp3quran\.net\/husr\/016\.mp3#t=\d+\.\d{3},\d+\.\d{3}$/);
  });
});

describe('S1 happy path', () => {
  it('frame -> observe -> connect -> ask -> narrate -> close, with concept-level events only', () => {
    let s = run(S1, [{ type: 'start' }]);
    expect(s.step).toBe('observe');
    s = run(S1, [{ type: 'choose', choiceId: 'S1.Q1.c1', t }], s);
    expect(s.observe).toMatchObject({ solved: true, feedbackId: 'S1.P1', highlightId: 'S1.Q1.c1' });
    s = run(S1, [{ type: 'next', t }], s);
    expect(s.step).toBe('connect');
    s = run(S1, [{ type: 'next', t }], s);
    expect(s.step).toBe('ask');
    s = run(S1, [{ type: 'next', t }], s);
    expect(s.step).toBe('narrate');
    s = run(S1, ['S1.N1', 'S1.N2', 'S1.N3'].map((cardId) => ({ type: 'pick' as const, cardId, t })), s);
    expect(s.narrate).toMatchObject({ done: true, feedbackId: 'S1.NP' });
    s = run(S1, [{ type: 'next', t }], s);
    expect(s.step).toBe('close');

    const kinds = s.events.map((e) => e.event);
    expect(kinds).toEqual(['answered', 'verse_shown', 'narrated', 'narrated', 'narrated']);
    for (const e of s.events) {
      expect(() => makeEvent(e as unknown as Record<string, unknown>)).not.toThrow();
      expect(JSON.stringify(e)).not.toMatch(/[؀-ۿ]/); // no Arabic text: IDs only
    }
    expect(s.events[0]).toMatchObject({ stationId: 'S1', conceptId: 'S1.C1', choiceId: 'S1.Q1.c1' });
    expect(s.events[1]).toMatchObject({ conceptId: 'S1.C2', sourceIds: ['S1.V1'], level: 'A' });
  });

  it('cannot skip ahead: next is ignored until the observe step is solved and the narration is done', () => {
    let s = run(S1, [{ type: 'start' }, { type: 'next', t }]);
    expect(s.step).toBe('observe');
    s = run(S1, [{ type: 'choose', choiceId: 'S1.Q1.c1', t }, { type: 'next', t }, { type: 'next', t }, { type: 'next', t }, { type: 'next', t }], s);
    expect(s.step).toBe('narrate');
  });
});

describe('S1 wrong choice, then hints', () => {
  it('a wrong choice shows that choice\'s redirect and greys the card; hints step H1->H4, then H5 highlights the answer', () => {
    let s = run(S1, [{ type: 'start' }, { type: 'choose', choiceId: 'S1.Q1.c2', t }]);
    expect(s.observe).toMatchObject({ solved: false, greyed: ['S1.Q1.c2'], feedbackId: 'S1.R1', highlightId: null });
    s = run(S1, [{ type: 'choose', choiceId: 'S1.Q1.c2', t }], s); // a greyed card does nothing
    expect(s.observe.greyed).toEqual(['S1.Q1.c2']);
    const seen: (string | null)[] = [];
    for (let i = 0; i < 5; i++) { s = run(S1, [{ type: 'hint', t }], s); seen.push(s.observe.feedbackId); }
    expect(seen).toEqual(['S1.H1', 'S1.H2', 'S1.H3', 'S1.H4', 'S1.H5']);
    expect(s.observe.highlightId).toBe('S1.Q1.c1');
    const after = run(S1, [{ type: 'hint', t }], s);
    expect(after).toBe(s); // nothing after the last rung
    s = run(S1, [{ type: 'choose', choiceId: 'S1.Q1.c1', t }], s);
    expect(s.observe).toMatchObject({ solved: true, feedbackId: 'S1.P1' });
    expect(s.events.filter((e) => e.event === 'hint_used').map((e) => e.sourceIds[0])).toEqual(['S1.H1', 'S1.H2', 'S1.H3', 'S1.H4', 'S1.H5']);
  });
});

describe('narration', () => {
  const toNarrate = (view: StationView) => {
    const q = view.observe!.correctChoiceId;
    let s = run(view, [{ type: 'start' }, { type: 'choose', choiceId: q, t }]);
    while (s.step !== 'narrate') s = run(view, [{ type: 'next', t }], s);
    return s;
  };

  it('S1 (order mode): a wrong order shows NR and resets; the right order shows NP', () => {
    let s = run(S1, ['S1.N2', 'S1.N1', 'S1.N3'].map((cardId) => ({ type: 'pick' as const, cardId, t })), toNarrate(S1));
    expect(s.narrate).toMatchObject({ done: false, picked: [], feedbackId: 'S1.NR' });
    s = run(S1, ['S1.N1', 'S1.N2', 'S1.N3'].map((cardId) => ({ type: 'pick' as const, cardId, t })), s);
    expect(s.narrate).toMatchObject({ done: true, feedbackId: 'S1.NP' });
  });

  it('S2 (pick_best): the best card from the scoring note shows NP; others show NR', () => {
    expect(S2.narrate).toMatchObject({ mode: 'pick_best', bestCardId: 'S2.N2' });
    let s = run(S2, [{ type: 'pick', cardId: 'S2.N1', t }], toNarrate(S2));
    expect(s.narrate).toMatchObject({ done: false, feedbackId: 'S2.NR' });
    s = run(S2, [{ type: 'pick', cardId: 'S2.N2', t }], s);
    expect(s.narrate).toMatchObject({ done: true, feedbackId: 'S2.NP' });
    expect(s.events.filter((e) => e.event === 'narrated').map((e) => e.choiceId)).toEqual(['S2.N1', 'S2.N2']);
  });
});

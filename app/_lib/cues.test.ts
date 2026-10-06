// Guided cues (D75): the sequencer on the real, approved S1 view (every narration file present).

import { describe, expect, it } from 'vitest';
import { cueReducer, currentCue, initialCueState, LOAD_CAP_MS, NEXT, reciteKey, stationCuePlan, stationScreenKey, watchdogMs, type CueAction, type CueItem, type CueState, type StationScreen } from './cues';
import { initialState, reducer, type FlowAction, type FlowState } from './flow';
import { buildStationView } from './station-view';
import { runtimeLibrary } from './test-helpers';

const S1 = buildStationView(runtimeLibrary(), 'S1', () => true)!;
const S1mute = buildStationView(runtimeLibrary(), 'S1', () => false)!;
const t = 1700000000;
const flow = (actions: FlowAction[]): FlowState => actions.reduce((s, a) => reducer(S1, s, a), initialState());
const UI: StationScreen = { page: null, answerOnly: false, momentPending: false, praiseAuto: false, ask: null };
const audio = (id: string) => S1.frame.concat(S1.close.lines).find((r) => r.id === id)?.audio;
const run = (plan: CueItem[], actions: CueAction[], from = initialCueState('x')): CueState => actions.reduce(cueReducer, from);
const keys = (plan: CueItem[]) => plan.map((p) => p.kind);

const o = S1.observe!;
const wrong = o.choices.find((c) => c.id !== o.correctChoiceId)!.id;
const observe = flow([{ type: 'start' }]);

describe('cue order per screen type', () => {
  it('frame: the speaker, then the start control', () => {
    const plan = stationCuePlan(S1, initialState(), UI);
    expect(plan).toEqual([{ key: audio('S1.F1'), kind: 'speaker' }, { key: NEXT, kind: 'next' }]);
    let s = initialCueState('x');
    expect(currentCue(plan, s)?.kind).toBe('speaker');
    s = run(plan, [{ type: 'tap', key: plan[0].key, plan }], s);
    expect(currentCue(plan, s)).toBeNull(); // playing: nothing glows
    s = run(plan, [{ type: 'end', key: plan[0].key }], s);
    expect(currentCue(plan, s)?.key).toBe(NEXT);
  });

  it('observe: the question speaker, then all answer cards together', () => {
    const plan = stationCuePlan(S1, observe, UI);
    expect(keys(plan)).toEqual(['speaker', 'cards']);
    expect(plan[0].key).toBe(o.question.audio);
    const s = run(plan, [{ type: 'play', key: plan[0].key }, { type: 'end', key: plan[0].key }]);
    expect(currentCue(plan, s)?.kind).toBe('cards'); // one group: the cards, never one card alone
  });

  it('wrong answer: the redirect speaker, then the cards again', () => {
    let plan = stationCuePlan(S1, observe, UI);
    let s = run(plan, [{ type: 'tap', key: plan[1].key, plan }]); // the child taps a card straight away
    expect(currentCue(plan, s)).toBeNull(); // the cards stop glowing the moment one is tapped
    const after = flow([{ type: 'start' }, { type: 'choose', choiceId: wrong, t }]);
    plan = stationCuePlan(S1, after, UI);
    s = cueReducer(s, { type: 'plan' });
    expect(keys(plan)).toEqual(['speaker', 'speaker', 'cards']);
    expect(currentCue(plan, s)?.key).toBe(o.redirects[wrong]!.audio); // the question speaker counts as passed
    s = run(plan, [{ type: 'tap', key: plan[1].key, plan }, { type: 'end', key: plan[1].key }], s);
    expect(currentCue(plan, s)?.kind).toBe('cards');
  });

  it('hint: its speaker, then the cards again', () => {
    const plan = stationCuePlan(S1, flow([{ type: 'start' }, { type: 'hint', t }]), UI);
    expect(plan[1]).toEqual({ key: o.hints[0].audio, kind: 'speaker' });
    expect(plan[2].kind).toBe('cards');
  });

  it('correct answer: nothing during the moment; after it the praise auto-plays, then next', () => {
    const solved = flow([{ type: 'start' }, { type: 'choose', choiceId: o.correctChoiceId!, t }]);
    expect(stationCuePlan(S1, solved, { ...UI, momentPending: true })).toEqual([]);
    const plan = stationCuePlan(S1, solved, { ...UI, praiseAuto: true });
    const s = run(plan, [{ type: 'end', key: plan[0].key }]);
    expect(currentCue(plan, s)).toBeNull(); // the praise is playing on its own
    expect(currentCue(plan, run(plan, [{ type: 'end', key: o.praise!.audio! }], s))?.key).toBe(NEXT);
  });

  it('verse step: line speakers, the recitation, explanations, then next; phone pages split it', () => {
    const connect = flow([{ type: 'start' }, { type: 'choose', choiceId: o.correctChoiceId!, t }, { type: 'next', t }]);
    const plan = stationCuePlan(S1, connect, UI);
    expect(plan.find((p) => p.key === reciteKey('S1.V1'))).toBeTruthy();
    expect(plan.at(-1)?.key).toBe(NEXT);
    expect(stationCuePlan(S1, connect, { ...UI, page: 'verse' })).toEqual([{ key: reciteKey('S1.V1'), kind: 'speaker' }, { key: NEXT, kind: 'next' }]);
    expect(stationScreenKey(connect, { page: 'lines', answerOnly: false })).not.toBe(stationScreenKey(connect, { page: 'verse', answerOnly: false }));
  });

  it('narration: the intro speaker, no glow while arranging, then the finish control', () => {
    const narrate: FlowState = { ...initialState(), step: 'narrate' };
    const plan = stationCuePlan(S1, narrate, UI);
    expect(keys(plan)).toEqual(['speaker', 'quiet']);
    const s = run(plan, [{ type: 'tap', key: 'arrange', plan }]);
    expect(currentCue(plan, s)).toBeNull();
    const done = flow([{ type: 'start' }]);
    const finished: FlowState = { ...done, step: 'narrate', narrate: { picked: ['S1.N1', 'S1.N2', 'S1.N3'], done: true, feedbackId: S1.narrate!.praise!.id } };
    expect(currentCue(stationCuePlan(S1, finished, UI), s)?.key).toBe(NEXT);
  });

  it('close: the line speaker, then the next control', () => {
    const plan = stationCuePlan(S1, { ...initialState(), step: 'close' }, UI);
    expect(plan).toEqual([{ key: audio('S1.CL1'), kind: 'speaker' }, { key: NEXT, kind: 'next' }]);
  });

  it('speakers without audio are skipped', () => {
    expect(stationCuePlan(S1mute, initialState(), UI)).toEqual([{ key: NEXT, kind: 'next' }]);
  });
});

describe('cue state', () => {
  const plan: CueItem[] = [{ key: 'a.mp3', kind: 'speaker' }, { key: 'b.mp3', kind: 'speaker' }, { key: 'cards:0:', kind: 'cards' }];

  it('only one cue is active at a time, in order', () => {
    let s = initialCueState('x');
    const seen: (string | undefined)[] = [];
    for (const k of ['a.mp3', 'b.mp3']) { seen.push(currentCue(plan, s)?.key); s = run(plan, [{ type: 'tap', key: k, plan }, { type: 'end', key: k }], s); }
    seen.push(currentCue(plan, s)?.key);
    expect(seen).toEqual(['a.mp3', 'b.mp3', 'cards:0:']);
  });

  it('a cue stops when its control is tapped; tapping ahead passes the earlier ones', () => {
    const s = run(plan, [{ type: 'tap', key: 'b.mp3', plan }]);
    expect(s.status).toEqual({ 'a.mp3': 'done', 'b.mp3': 'playing' });
    expect(currentCue(plan, s)).toBeNull();
    expect(currentCue(plan, run(plan, [{ type: 'tap', key: 'cards:0:', plan }]))).toBeNull();
  });

  it('audio failure moves to the next cue (the failure reports end)', () => {
    const s = run(plan, [{ type: 'tap', key: 'a.mp3', plan }, { type: 'end', key: 'a.mp3' }]);
    expect(currentCue(plan, s)?.key).toBe('b.mp3');
  });

  it('pausing the recitation ends it as a cue', () => {
    const verse: CueItem[] = [{ key: reciteKey('S1.V1'), kind: 'speaker' }, { key: NEXT, kind: 'next' }];
    const s = run(verse, [{ type: 'tap', key: verse[0].key, plan: verse }, { type: 'play', key: verse[0].key }]);
    expect(currentCue(verse, s)).toBeNull();
    expect(currentCue(verse, cueReducer(s, { type: 'end', key: verse[0].key }))?.key).toBe(NEXT);
  });

  it('a new screen starts with nothing played', () => {
    const s = run(plan, [{ type: 'tap', key: 'a.mp3', plan }, { type: 'end', key: 'a.mp3' }]);
    expect(cueReducer(s, { type: 'screen', screen: 'x' })).toBe(s);
    expect(currentCue(plan, cueReducer(s, { type: 'screen', screen: 'y' }))?.key).toBe('a.mp3');
  });

  it('watchdog: the clip length + 2 s, or a cap when the length is unknown', () => {
    expect(watchdogMs(3.5)).toBe(5500);
    expect(watchdogMs(3.5, 1)).toBe(4500);
    expect(watchdogMs(null)).toBe(LOAD_CAP_MS);
    expect(watchdogMs(Number.NaN)).toBe(LOAD_CAP_MS);
  });
});

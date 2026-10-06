// Guided cues (D75): on each child screen exactly one group of controls glows to show where to tap
// next — a speaker, then the answer cards (all together, never the right one alone), then the
// control that moves on. Pure: the plan is derived from what the screen shows, the state from what
// the child and the audio did. Cues guide and never gate: nothing here disables a control. State
// lives in component memory only (no storage, no events, no network).

import type { FlowState } from './flow';
import type { StationView } from './station-view';

// One cue target on a screen, in the order the child meets them.
// speaker: a narration or recitation button (key = its audio, or `recite:<verse id>`);
// cards: every answer card of the question; next: the control that moves on;
// quiet: the child is busy (arranging narration cards) — nothing glows, later items wait.
export type CueKind = 'speaker' | 'cards' | 'next' | 'quiet';
export interface CueItem { key: string; kind: CueKind; autoplay?: boolean }
export type SpeakerStatus = 'playing' | 'done';

export interface CueState {
  screen: string;
  status: Record<string, SpeakerStatus>; // speakers on this screen; absent = not played yet
  tapped: string | null; // a cards/next target the child just tapped: its glow stops at once
}

export type CueAction =
  | { type: 'screen'; screen: string } // a new screen: nothing played on it yet
  | { type: 'plan' } // the screen's targets changed (a new strip, a card set aside)
  | { type: 'tap'; key: string; plan: readonly CueItem[] }
  | { type: 'play'; key: string }
  | { type: 'end'; key: string }; // ended, paused/stopped, failed, or no 'ended' in time

export const initialCueState = (screen = ''): CueState => ({ screen, status: {}, tapped: null });

export function cueReducer(s: CueState, a: CueAction): CueState {
  switch (a.type) {
    case 'screen':
      return a.screen === s.screen ? s : initialCueState(a.screen);
    case 'plan':
      return s.tapped ? { ...s, tapped: null } : s;
    case 'tap': {
      // Tapping a target means the child has moved on past everything before it.
      const i = a.plan.findIndex((p) => p.key === a.key);
      const status = { ...s.status };
      for (const p of a.plan.slice(0, Math.max(i, 0))) if (p.kind === 'speaker') status[p.key] = 'done';
      const item = a.plan[i];
      if (item?.kind === 'speaker') { status[a.key] = 'playing'; return { ...s, status, tapped: null }; }
      return { ...s, status, tapped: i >= 0 ? a.key : s.tapped };
    }
    case 'play':
      return s.status[a.key] === 'playing' ? s : { ...s, status: { ...s.status, [a.key]: 'playing' } };
    case 'end':
      return { ...s, status: { ...s.status, [a.key]: 'done' }, tapped: null };
    default:
      return s;
  }
}

// The one active cue: the first target not yet done. A speaker that is playing (or auto-playing)
// holds the cue back until it ends; a target just tapped stops glowing.
export function currentCue(plan: readonly CueItem[], s: CueState): CueItem | null {
  for (const p of plan) {
    if (p.kind === 'speaker') {
      const st = s.status[p.key] ?? (p.autoplay ? 'playing' : undefined);
      if (st === 'done') continue;
      return st === 'playing' ? null : p;
    }
    if (p.kind === 'quiet') return null;
    return s.tapped === p.key ? null : p;
  }
  return null;
}

export const reciteKey = (verseId: string) => `recite:${verseId}`;
export const NEXT = 'next';
const speaker = (audio: string | null | undefined, autoplay = false): CueItem[] => (audio ? [{ key: audio, kind: 'speaker', ...(autoplay ? { autoplay } : {}) }] : []);

export interface StationScreen {
  page: 'lines' | 'verse' | 'more' | null; // the verse-step page on phones; null = one page
  answerOnly: boolean; // portrait phones: the ask reply in its own view
  momentPending: boolean; // the moment is on its way or on screen: nothing glows
  praiseAuto: boolean; // the praise line auto-plays after the moment
  ask: { id: string; verses: { id: string; recitation: boolean }[] } | null; // the reply on screen
}

// Screen identity: a speaker counts as played only on the screen where it was played.
export const stationScreenKey = (state: FlowState, ui: Pick<StationScreen, 'page' | 'answerOnly'>) =>
  `${state.step}:${ui.page ?? ''}:${ui.answerOnly ? 'answer' : ''}`;

// The targets of a station screen, in order, from what it shows (StationFlow renders the same).
export function stationCuePlan(view: StationView, state: FlowState, ui: StationScreen): CueItem[] {
  const shows = (p: 'lines' | 'verse' | 'more') => ui.page === null || ui.page === p;
  switch (state.step) {
    case 'frame':
      return [...speaker(view.frame[0]?.audio), { key: NEXT, kind: 'next' }];
    case 'observe': {
      const o = view.observe;
      if (!o) return [];
      const q = speaker(o.question.audio);
      if (state.observe.solved) {
        if (ui.momentPending) return [];
        return [...q, ...speaker(o.praise?.audio, ui.praiseAuto), { key: NEXT, kind: 'next' }];
      }
      // A hint or a redirect after a set-aside card: its speaker first, then the cards again.
      const f = state.observe.feedbackId;
      const strip = f ? [o.together, ...o.hints, ...Object.values(o.redirects)].find((r) => r?.id === f) : null;
      return [...q, ...speaker(strip?.audio), { key: `cards:${state.observe.greyed.length}:${f ?? ''}`, kind: 'cards' }];
    }
    case 'connect': {
      const c = view.connect;
      if (!c) return [];
      return [
        ...(shows('lines') ? [...c.science, c.bridge, c.listen].flatMap((r) => speaker(r?.audio)) : []),
        ...(shows('verse') && c.verse?.recitation ? [{ key: reciteKey(c.verse.id), kind: 'speaker' as const }] : []),
        ...(shows('more') ? c.explanations.flatMap((r) => speaker(r.audio)) : []),
        { key: NEXT, kind: 'next' },
      ];
    }
    case 'ask': {
      const reply = ui.ask && (ui.page === null || ui.answerOnly) ? ui.ask.verses.filter((v) => v.recitation).map((v) => ({ key: reciteKey(v.id), kind: 'speaker' as const })) : [];
      return [...reply, { key: NEXT, kind: 'next' }];
    }
    case 'narrate': {
      const n = view.narrate;
      if (!n) return [];
      const intro = speaker(n.intro?.audio);
      // No glow on the narration cards; the finish control once the arrangement is complete.
      if (state.narrate.done) return [...intro, { key: NEXT, kind: 'next' }];
      const retry = state.narrate.feedbackId ? speaker(n.retry?.id === state.narrate.feedbackId ? n.retry.audio : null) : [];
      return [...intro, ...retry, { key: 'arrange', kind: 'quiet' }];
    }
    case 'close':
    case 'done':
      return [...view.close.lines.flatMap((r) => speaker(r.audio)), { key: NEXT, kind: 'next' }];
    default:
      return [];
  }
}

// Fallback so a child is never stuck: no 'ended' within the clip's duration + 2 s moves the cue on;
// LOAD_CAP_MS bounds the wait when the duration never becomes known (audio that never loads).
export const END_GRACE_MS = 2000;
export const LOAD_CAP_MS = 10000;
export const watchdogMs = (durationS: number | null, elapsedS = 0): number =>
  durationS !== null && Number.isFinite(durationS) && durationS > 0 ? Math.max(Math.round((durationS - elapsedS) * 1000), 0) + END_GRACE_MS : LOAD_CAP_MS;

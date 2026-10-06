// Station flow as a pure state machine (frame -> observe -> connect -> ask -> narrate -> close).
// Feedback is always a record ID from the station view; events are concept-level only (CLAUDE.md §6).
// No step ever accepts free text from the child.

import type { StationView } from './station-view';

export type Step = 'frame' | 'observe' | 'connect' | 'ask' | 'narrate' | 'close' | 'done';

export interface EventInput {
  stationId: string;
  conceptId?: string;
  event: 'answered' | 'hint_used' | 'verse_shown' | 'narrated' | 'referred' | 'safety_referral';
  choiceId?: string;
  level?: 'A' | 'B' | 'C' | 'D' | 'OUT_OF_SCOPE';
  sourceIds: string[];
  t: number;
}

export interface FlowState {
  step: Step;
  observe: { greyed: string[]; solved: boolean; hintIndex: number; feedbackId: string | null; highlightId: string | null };
  narrate: { picked: string[]; done: boolean; feedbackId: string | null };
  events: EventInput[]; // to flush into the on-device session log
}

export type FlowAction =
  | { type: 'start' }
  | { type: 'choose'; choiceId: string; t: number }
  | { type: 'hint'; t: number }
  // deferVerse (phones, D67): entering the verse step does not log verse_shown yet; the verse card
  // shows on a later page of the step, which dispatches 'verseShown' when it appears.
  | { type: 'next'; t: number; deferVerse?: boolean }
  | { type: 'verseShown'; t: number }
  | { type: 'pick'; cardId: string; t: number }
  | { type: 'retry' }
  | { type: 'flushed' };

export function initialState(): FlowState {
  return {
    step: 'frame',
    observe: { greyed: [], solved: false, hintIndex: -1, feedbackId: null, highlightId: null },
    narrate: { picked: [], done: false, feedbackId: null },
    events: [],
  };
}

const ORDER: Step[] = ['frame', 'observe', 'connect', 'ask', 'narrate', 'close', 'done'];

function nextStep(view: StationView, from: Step): Step {
  let i = ORDER.indexOf(from) + 1;
  for (; i < ORDER.length; i++) {
    const s = ORDER[i];
    if (s === 'observe' && !view.observe) continue;
    if (s === 'connect' && !view.connect) continue;
    if (s === 'ask' && !view.ask.length) continue;
    if (s === 'narrate' && !view.narrate) continue;
    return s;
  }
  return 'done';
}

export function reducer(view: StationView, state: FlowState, action: FlowAction): FlowState {
  const ev = (e: Omit<EventInput, 'stationId'>): EventInput[] => [...state.events, { stationId: view.stationId, ...e }];

  switch (action.type) {
    case 'flushed':
      return { ...state, events: [] };

    case 'start':
      return state.step === 'frame' ? { ...state, step: nextStep(view, 'frame') } : state;

    case 'choose': {
      const o = view.observe;
      if (state.step !== 'observe' || !o || state.observe.solved || state.observe.greyed.includes(action.choiceId)) return state;
      if (!o.choices.some((c) => c.id === action.choiceId)) return state;
      const conceptId = o.conceptId ?? undefined;
      if (action.choiceId === o.correctChoiceId) {
        return {
          ...state,
          observe: { ...state.observe, solved: true, feedbackId: o.praise?.id ?? null, highlightId: o.correctChoiceId },
          events: ev({ event: 'answered', conceptId, choiceId: action.choiceId, sourceIds: [o.question.id], t: action.t }),
        };
      }
      return {
        ...state,
        observe: { ...state.observe, greyed: [...state.observe.greyed, action.choiceId], feedbackId: o.redirects[action.choiceId]?.id ?? null },
        events: ev({ event: 'answered', conceptId, choiceId: action.choiceId, sourceIds: [o.question.id], t: action.t }),
      };
    }

    case 'hint': {
      const o = view.observe;
      if (state.step !== 'observe' || !o || state.observe.solved || state.observe.hintIndex >= o.hints.length) return state;
      const i = state.observe.hintIndex + 1;
      if (i < o.hints.length) {
        return { ...state, observe: { ...state.observe, hintIndex: i, feedbackId: o.hints[i].id }, events: ev({ event: 'hint_used', conceptId: o.conceptId ?? undefined, sourceIds: [o.hints[i].id], t: action.t }) };
      }
      if (o.together) {
        return {
          ...state,
          observe: { ...state.observe, hintIndex: o.hints.length, feedbackId: o.together.id, highlightId: o.highlightChoiceId },
          events: ev({ event: 'hint_used', conceptId: o.conceptId ?? undefined, sourceIds: [o.together.id], t: action.t }),
        };
      }
      return state;
    }

    case 'next': {
      if (state.step === 'observe' && !state.observe.solved) return state;
      if (state.step === 'narrate' && !state.narrate.done) return state;
      if (state.step === 'frame' || state.step === 'done') return state;
      const step = nextStep(view, state.step);
      let events = state.events;
      if (step === 'connect' && view.connect?.verse && !action.deferVerse) {
        events = ev({ event: 'verse_shown', conceptId: view.connect.conceptId ?? undefined, level: 'A', sourceIds: [view.connect.verse.id], t: action.t });
      }
      return { ...state, step, events };
    }

    case 'verseShown':
      if (state.step !== 'connect' || !view.connect?.verse) return state;
      return { ...state, events: ev({ event: 'verse_shown', conceptId: view.connect.conceptId ?? undefined, level: 'A', sourceIds: [view.connect.verse.id], t: action.t }) };

    case 'pick': {
      const n = view.narrate;
      if (state.step !== 'narrate' || !n || state.narrate.done || !n.cards.some((c) => c.id === action.cardId)) return state;
      const events = ev({ event: 'narrated', choiceId: action.cardId, sourceIds: [action.cardId], t: action.t });
      if (n.mode === 'pick_best') {
        const best = action.cardId === n.bestCardId;
        return { ...state, narrate: { picked: [action.cardId], done: best, feedbackId: (best ? n.praise : n.retry)?.id ?? null }, events };
      }
      if (state.narrate.picked.includes(action.cardId)) return state;
      const picked = [...state.narrate.picked, action.cardId];
      if (picked.length < n.cards.length) return { ...state, narrate: { picked, done: false, feedbackId: null }, events };
      const right = JSON.stringify(picked) === JSON.stringify(n.expectedOrder ?? n.cards.map((c) => c.id));
      return { ...state, narrate: { picked: right ? picked : [], done: right, feedbackId: (right ? n.praise : n.retry)?.id ?? null }, events };
    }

    case 'retry':
      return state.step === 'narrate' && !state.narrate.done ? { ...state, narrate: { picked: [], done: false, feedbackId: null } } : state;

    default:
      return state;
  }
}

// Static story mode (D47): the pilot's control condition. The SAME approved script, pictures and audio
// as the station, in a fixed order with no interaction: frame narration -> the question line -> the
// correct answer with its praise line (and the moment) -> the correct narration cards in order -> the
// verse card with the real recitation -> the explanations -> the close lines. Built from the station
// view, so no new wording exists anywhere in story mode.

import type { RecordView, StationView, VerseView } from './station-view';

export type StoryStep =
  | { kind: 'frame'; record: RecordView }
  | { kind: 'question'; record: RecordView; picture: RecordView | null }
  | { kind: 'answer'; choice: RecordView; praise: RecordView | null }
  | { kind: 'card'; record: RecordView; order: number }
  | { kind: 'verse'; verse: VerseView }
  | { kind: 'explanation'; record: RecordView }
  | { kind: 'close'; record: RecordView };

// The narration cards the station counts as correct: the expected order, or the best card.
export function correctCards(view: StationView): RecordView[] {
  const n = view.narrate;
  if (!n) return [];
  const ids = n.mode === 'order' ? n.expectedOrder ?? [] : n.bestCardId ? [n.bestCardId] : [];
  return ids.map((id) => n.cards.find((c) => c.id === id)).filter((c): c is RecordView => Boolean(c));
}

export function buildStorySteps(view: StationView): StoryStep[] {
  const steps: StoryStep[] = [];
  for (const r of view.frame) steps.push({ kind: 'frame', record: r });
  const o = view.observe;
  if (o) {
    // The station shows the question's own picture, or the first narration card as the scene (S1).
    const scene = o.question.image ? o.question : view.narrate?.cards[0]?.image ? view.narrate.cards[0] : null;
    steps.push({ kind: 'question', record: o.question, picture: scene });
    const choice = o.choices.find((c) => c.id === o.correctChoiceId);
    if (choice) steps.push({ kind: 'answer', choice, praise: o.praise });
  }
  correctCards(view).forEach((record, i) => steps.push({ kind: 'card', record, order: i + 1 }));
  if (view.connect?.verse) steps.push({ kind: 'verse', verse: view.connect.verse });
  for (const r of view.connect?.explanations ?? []) steps.push({ kind: 'explanation', record: r });
  for (const r of view.close.lines) steps.push({ kind: 'close', record: r });
  return steps;
}

// "kind:id" per step, for tests and the page's data attributes.
export const stepKey = (s: StoryStep): string =>
  `${s.kind}:${s.kind === 'answer' ? s.choice.id : s.kind === 'verse' ? s.verse.id : s.record.id}`;

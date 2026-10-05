// Test fixture (A1): a station's ask step with the reply to one of its approved questions, as
// /api/ask?judge=1 sends it (built through the real pipeline). Used by the judge and a11y tests.

import { initialState, reducer, type FlowAction } from '@/app/_lib/flow';
import { publicFileExists } from '@/app/_lib/media';
import { buildStationView, toVerseView } from '@/app/_lib/station-view';
import { runtimeLibrary } from '@/app/_lib/test-helpers';
import { answerWithTrace } from '@/app/_lib/trace';
import type { AskState } from './StationFlow';

const lib = runtimeLibrary();
const t = 1700000000;

// The ask step of a station with the reply to one of its approved questions (as /api/ask?judge=1 sends it).
export async function askStep(stationId: string, pick: 'withVerse' | 'first' = 'first') {
  const view = buildStationView(lib, stationId, publicFileExists)!;
  const o = view.observe!;
  const actions: FlowAction[] = [{ type: 'start' }, { type: 'choose', choiceId: o.correctChoiceId, t }, { type: 'next', t }, { type: 'next', t }];
  const state = actions.reduce((s, a) => reducer(view, s, a), initialState());
  const questions = lib.stations.get(stationId)!.anticipatedQuestions.filter((q) => view.ask.some((v) => v.id === q.id));
  let ask: AskState | null = null;
  for (const q of questions) {
    const res = await answerWithTrace(lib, { stationId, text: q.childQuestion });
    const verses = res.reply.segments.filter((s) => s.kind === 'verse').map((s) => toVerseView(lib.byId.get(s.recordId)!, lib.surahs));
    ask = { id: q.id, busy: false, reply: { segments: res.reply.segments.map((s) => ({ kind: s.kind, recordId: s.recordId, text: s.text })), verses, event: null, trace: res.trace } };
    if (pick === 'first' || verses.length) break;
  }
  return { view, state, ask: ask! };
}

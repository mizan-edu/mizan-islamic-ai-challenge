// Server-side view of a station for the child screens: the station script resolved against the
// approved-only library, plus media availability. Anything not approved is simply absent.

import type { ContentRecord, ScriptStep } from './content';
import type { Library } from './library';
import { narrationSrc, pictureSrc, publicFileExists, recitationSrc, type FileExists } from './media';
import { placeholderValues, resolveText, type PlaceholderValues } from './placeholders';

export interface RecordView {
  id: string;
  type: string;
  role: string | null;
  level: string;
  text: string;
  audio: string | null; // pre-rendered narration, when the file exists
  image: string | null; // picture, when the file exists
}

export interface VerseView {
  id: string;
  text: string;
  reference: string;
  platformId: string;
  recitation: { src: string; audioUrl: string; startMs: number; endMs: number } | null;
}

export interface StationView {
  stationId: string;
  title: RecordView | null;
  frame: RecordView[];
  observe: {
    conceptId: string | null;
    question: RecordView;
    choices: RecordView[];
    correctChoiceId: string;
    praise: RecordView | null;
    redirects: Record<string, RecordView>;
    hints: RecordView[];
    together: RecordView | null;
    highlightChoiceId: string | null;
  } | null;
  connect: {
    conceptId: string | null;
    science: RecordView[];
    bridge: RecordView | null;
    listen: RecordView | null;
    verse: VerseView | null;
    tafsir: { id: string; text: string; reference: string; platformId: string } | null;
    explanation: RecordView | null;
  } | null;
  ask: { id: string; text: string }[];
  narrate: {
    intro: RecordView | null;
    cards: RecordView[];
    mode: 'pick_best' | 'order';
    bestCardId: string | null;
    expectedOrder: string[] | null;
    praise: RecordView | null;
    retry: RecordView | null;
  } | null;
  close: { lines: RecordView[]; stage: number };
  parent: RecordView[];
  nextStationId: string | null;
}

const MAX_QUESTIONS = 3;

// "S2.N2 = 3 (...); S2.N1 = 2 ..." -> the card with the highest score.
export function bestCardFromNote(note: unknown, cardIds: string[]): string | null {
  if (typeof note !== 'string') return null;
  let best: { id: string; score: number } | null = null;
  for (const m of note.matchAll(/(S\d+\.N\d+)\s*=\s*(\d)/g)) {
    const score = Number(m[2]);
    if (cardIds.includes(m[1]) && (!best || score > best.score)) best = { id: m[1], score };
  }
  return best?.id ?? null;
}

export const stageFromMarker = (marker: unknown): number => {
  const m = typeof marker === 'string' ? /(\d+)$/.exec(marker) : null;
  return m ? Number(m[1]) : 0;
};

export function buildStationView(
  lib: Library,
  stationId: string,
  exists: FileExists = publicFileExists,
  values: PlaceholderValues = placeholderValues(lib, stationId),
): StationView | null {
  const station = lib.stations.get(stationId);
  if (!station) return null;
  const view = (id: unknown): RecordView | null => {
    const r = typeof id === 'string' ? lib.byId.get(id) : undefined;
    if (!r || r.station !== stationId || r.type === 'quran' || r.type === 'tafsir' || r.type === 'hadith') return null;
    // Placeholders resolve at render time; a line that cannot be fully resolved is not shown.
    const text = resolveText(r.text, values);
    return text === null ? null : { ...toView(stationId, r, exists), text };
  };
  const views = (ids: unknown): RecordView[] => (Array.isArray(ids) ? ids.map(view).filter((v): v is RecordView => v !== null) : []);
  const step = (name: string): ScriptStep | undefined => station.script.find((s) => s.step === name);
  const concept = (s: ScriptStep | undefined): string | null => (Array.isArray(s?.conceptIds) && s!.conceptIds![0]) || null;

  const frame = step('frame');
  const observe = step('observe');
  const connect = step('connect');
  const narrate = step('narrate');
  const close = step('close');
  const titleId = station.records.find((r) => r.role === 'title')?.id ?? null;

  const question = view(observe?.questionId);
  const choices = views(observe?.choiceIds);
  const redirects: Record<string, RecordView> = {};
  for (const [choiceId, recId] of Object.entries((observe?.redirectIds as Record<string, string>) ?? {})) {
    const v = view(recId);
    if (v) redirects[choiceId] = v;
  }
  const together = view(observe?.togetherId);
  const togetherRec = together ? lib.byId.get(together.id) : undefined;

  const vc = (connect?.verseCard ?? {}) as { quranId?: string; tafsirId?: string; explanationId?: string };
  const verseRec = vc.quranId ? lib.byId.get(vc.quranId) : undefined;
  const tafsirRec = vc.tafsirId ? lib.byId.get(vc.tafsirId) : undefined;

  const cards = views(narrate?.narrationCardIds);
  const mode = narrate?.mode === 'order' ? 'order' : 'pick_best';

  const ids = [...lib.stations.keys()].sort();
  const next = ids[ids.indexOf(stationId) + 1] ?? null;

  return {
    stationId,
    title: view(titleId),
    frame: views(frame?.recordIds).filter((r) => r.id !== titleId),
    observe: question && choices.length && typeof observe?.correctChoiceId === 'string'
      ? {
        conceptId: concept(observe),
        question,
        choices,
        correctChoiceId: observe.correctChoiceId as string,
        praise: view(observe.praiseId),
        redirects,
        hints: views(observe.hintLadder),
        together,
        highlightChoiceId: typeof togetherRec?.highlightChoiceId === 'string' ? togetherRec.highlightChoiceId : (observe.correctChoiceId as string),
      }
      : null,
    connect: connect
      ? {
        conceptId: concept(connect),
        science: views(connect.scienceIds),
        bridge: view(connect.bridgeId),
        listen: view(connect.listenId),
        verse: verseRec?.type === 'quran' ? toVerseView(verseRec) : null,
        tafsir: tafsirRec?.type === 'tafsir' ? { id: tafsirRec.id, text: tafsirRec.text, reference: String(tafsirRec.reference), platformId: String(tafsirRec.platformId) } : null,
        explanation: view(vc.explanationId),
      }
      : null,
    ask: station.anticipatedQuestions.slice(0, MAX_QUESTIONS).map((q) => ({ id: q.id, text: q.childQuestion })),
    narrate: cards.length
      ? {
        intro: view(narrate?.introId),
        cards,
        mode,
        bestCardId: mode === 'pick_best' ? bestCardFromNote(narrate?.scoringNote, cards.map((c) => c.id)) : null,
        expectedOrder: mode === 'order' && Array.isArray(narrate?.expectedOrder) ? (narrate!.expectedOrder as string[]).filter((id) => cards.some((c) => c.id === id)) : null,
        praise: view(narrate?.praiseId),
        retry: view(narrate?.retryId),
      }
      : null,
    close: { lines: views(close?.recordIds), stage: stageFromMarker(close?.progressMarker) },
    parent: views(close?.parentSummaryIds),
    nextStationId: next,
  };
}

function toView(stationId: string, r: ContentRecord, exists: FileExists): RecordView {
  return { id: r.id, type: r.type, role: r.role ?? null, level: r.level, text: r.text, audio: narrationSrc(stationId, r, exists), image: pictureSrc(stationId, r, exists) };
}

export function toVerseView(r: ContentRecord): VerseView {
  const rc = r.recitation as { audioUrl?: unknown; startMs?: unknown; endMs?: unknown } | undefined;
  const ok = rc && typeof rc.audioUrl === 'string' && Number.isInteger(rc.startMs) && Number.isInteger(rc.endMs);
  return {
    id: r.id,
    text: r.text,
    reference: String(r.reference),
    platformId: String(r.platformId),
    recitation: ok ? { src: recitationSrc(rc!.audioUrl as string, rc!.startMs as number, rc!.endMs as number), audioUrl: rc!.audioUrl as string, startMs: rc!.startMs as number, endMs: rc!.endMs as number } : null,
  };
}

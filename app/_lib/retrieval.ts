// Deterministic retrieval over the approved library (CLAUDE.md §5 Retrieval). No model.
// Order: anticipated-question match first, then the station's own records.

import type { AnticipatedQuestion, ContentRecord } from './content';
import type { Library } from './library';
import { containment, tokens } from './normalize';

export const AQ_MIN_SCORE = 0.75; // share of the anticipated question's topic words present in the input
export const AQ_MIN_SHARED = 2;
export const VERSE_MIN_SCORE = 0.6; // share of a verse's words present in the input
export const VERSE_MIN_WORDS = 4;
export const MAX_CANDIDATES = 8;

export interface AqMatch { question: AnticipatedQuestion; record: ContentRecord; score: number }
export interface VerseMatch { record: ContentRecord; score: number; exact: boolean }
export interface Retrieval {
  aq: AqMatch | null;
  verse: VerseMatch | null;
  candidates: ContentRecord[]; // approved answerable records, best first
}

const ANSWERABLE = new Set(['answer', 'explanation']);

export function matchAnticipated(lib: Library, stationId: string | null, text: string): AqMatch | null {
  const station = stationId ? lib.stations.get(stationId) : undefined;
  if (!station) return null;
  const q = tokens(text);
  let best: AqMatch | null = null;
  for (const aq of station.anticipatedQuestions) {
    const record = lib.byId.get(aq.responseRecordId);
    if (!record) continue;
    const { score, shared } = containment(q, tokens(aq.childQuestion));
    if (score >= AQ_MIN_SCORE && shared >= AQ_MIN_SHARED && (!best || score > best.score)) best = { question: aq, record, score };
  }
  return best;
}

// Detects a pasted or quoted verse (possibly altered). `exact` = the stored text appears byte-for-byte.
export function matchVerse(lib: Library, stationId: string | null, text: string): VerseMatch | null {
  const q = tokens(text);
  const ordered = [...lib.verses].sort((a, b) => Number(b.station === stationId) - Number(a.station === stationId) || a.id.localeCompare(b.id));
  let best: VerseMatch | null = null;
  for (const v of ordered) {
    const vt = tokens(v.text);
    if (vt.length < VERSE_MIN_WORDS) continue;
    const { score } = containment(q, vt);
    if (score >= VERSE_MIN_SCORE && (!best || score > best.score)) best = { record: v, score, exact: text.includes(v.text) };
  }
  return best;
}

export function stationCandidates(lib: Library, stationId: string | null, text: string, onScreen: string[] = []): ContentRecord[] {
  const station = stationId ? lib.stations.get(stationId) : undefined;
  if (!station) return [];
  const q = tokens(text);
  const answerable = station.records
    .filter((r) => ANSWERABLE.has(r.type))
    .map((r) => ({ r, s: containment(q, tokens(r.text)).score }))
    .sort((a, b) => b.s - a.s || a.r.id.localeCompare(b.r.id))
    .map((x) => x.r);
  const shown = onScreen.map((id) => lib.byId.get(id)).filter((r): r is ContentRecord => Boolean(r) && r!.type === 'quran');
  return [...shown, ...answerable].slice(0, MAX_CANDIDATES);
}

export function retrieve(lib: Library, stationId: string | null, text: string, onScreen: string[] = []): Retrieval {
  return {
    aq: matchAnticipated(lib, stationId, text),
    verse: matchVerse(lib, stationId, text),
    candidates: stationCandidates(lib, stationId, text, onScreen),
  };
}

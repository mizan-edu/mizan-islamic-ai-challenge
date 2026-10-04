// Generation (CLAUDE.md §5.1 step 4). Replies are assembled from approved library records only.
// Verse cards render the stored text with real recitation audio; they are never spoken by TTS (R4).
// The only model step allowed is rephrasing NA science/UI lines for a 4-6-year-old.

import type { ContentRecord } from './content';
import type { RouteLevel } from './levels';
import { fallbackFor, sourcesOf, type Library } from './library';
import type { Behaviour, RouteResult } from './router';

export interface Recitation { audioUrl: string; startMs: number; endMs: number }

export interface Segment {
  kind: 'text' | 'verse';
  recordId: string;
  text: string;
  source: 'library' | 'generated';
  speakable: boolean; // false for every verse segment
  reference?: string | null;
  recitation?: Recitation | null;
}

export interface Reply {
  stationId: string | null;
  level: RouteLevel;
  behaviour: Behaviour;
  citations: string[]; // every library record the reply relies on
  segments: Segment[];
}

const textSegment = (r: ContentRecord): Segment => ({ kind: 'text', recordId: r.id, text: r.text, source: 'library', speakable: r.tts !== false });

export function verseSegment(r: ContentRecord): Segment {
  const rc = r.recitation as { audioUrl?: unknown; startMs?: unknown; endMs?: unknown } | undefined;
  const recitation = rc && typeof rc.audioUrl === 'string' && Number.isInteger(rc.startMs) && Number.isInteger(rc.endMs)
    ? { audioUrl: rc.audioUrl, startMs: rc.startMs as number, endMs: rc.endMs as number }
    : null;
  return { kind: 'verse', recordId: r.id, text: r.text, source: 'library', speakable: false, reference: (r.reference as string) ?? null, recitation };
}

// Sources of a record, one level deep through cited explanations (an answer -> E1 -> verse/tafsir).
function citationsFor(lib: Library, r: ContentRecord): string[] {
  const out = new Set<string>();
  for (const id of sourcesOf(lib, r)) {
    out.add(id);
    const s = lib.byId.get(id);
    if (s && s.type === 'explanation') for (const id2 of sourcesOf(lib, s)) out.add(id2);
  }
  return [...out];
}

export function fallbackReply(lib: Library, stationId: string | null, level: RouteLevel = 'OUT_OF_SCOPE'): Reply {
  const fb = fallbackFor(lib, stationId);
  return { stationId, level, behaviour: 'fallback', citations: fb ? [fb.id] : [], segments: fb ? [textSegment(fb)] : [] };
}

export function buildReply(lib: Library, stationId: string | null, routed: RouteResult): Reply {
  const rec = routed.recordId ? lib.byId.get(routed.recordId) : undefined;
  if (!rec) return fallbackReply(lib, stationId, routed.level);
  const base = { stationId, level: routed.level, behaviour: routed.behaviour };

  if (routed.behaviour === 'verse_card' || routed.behaviour === 'correction') {
    // Tafsir for the same ayah is cited (shown to parents), never mixed into the verse text.
    const tafsir = [...lib.byId.values()].filter((t) => t.type === 'tafsir' && t.reference === rec.reference).map((t) => t.id);
    return { ...base, citations: [rec.id, ...tafsir], segments: [verseSegment(rec)] };
  }
  if (routed.behaviour === 'answer') {
    const citations = citationsFor(lib, rec);
    const verses = citations.map((id) => lib.byId.get(id)).filter((r): r is ContentRecord => r?.type === 'quran');
    return { ...base, citations: [rec.id, ...citations], segments: [textSegment(rec), ...verses.map(verseSegment)] };
  }
  return { ...base, citations: [rec.id], segments: [textSegment(rec)] };
}

// ---------- rephrasing (NA science/UI lines only) ----------

export type Rephraser = (text: string, ctx: { recordId: string; role?: string }) => Promise<string | null>;

export const isRephrasable = (r: ContentRecord | undefined): boolean =>
  Boolean(r) && r!.level === 'NA' && (r!.type === 'ui' || r!.type === 'answer');

export async function applyRephrase(lib: Library, reply: Reply, rephraser: Rephraser): Promise<Reply> {
  const segments: Segment[] = [];
  for (const s of reply.segments) {
    const r = lib.byId.get(s.recordId);
    if (s.kind !== 'text' || !isRephrasable(r)) { segments.push(s); continue; }
    const out = await rephraser(s.text, { recordId: s.recordId, role: r!.role });
    segments.push(out ? { ...s, text: out, source: 'generated' } : s);
  }
  return { ...reply, segments };
}

// The reply as the client shows it: segments (IDs and approved text) and verse cards built from the
// stored verse records (shown verbatim with the KFC surah name and ayah number). Shared by /api/ask and
// /api/try so both render a reply exactly as a child sees it.

import type { Library } from './library';
import type { Reply } from './reply';
import { toVerseView, type VerseView } from './station-view';

export interface ReplyView {
  behaviour: Reply['behaviour'];
  level: Reply['level'];
  segments: { kind: 'text' | 'verse'; recordId: string; text: string }[];
  verses: VerseView[];
}

export function replyView(lib: Library, reply: Reply): ReplyView {
  const verses = reply.segments
    .filter((s) => s.kind === 'verse')
    .map((s) => lib.byId.get(s.recordId))
    .filter((r) => r?.type === 'quran')
    .map((r) => toVerseView(r!, lib.surahs));
  return { behaviour: reply.behaviour, level: reply.level, segments: reply.segments.map((s) => ({ kind: s.kind, recordId: s.recordId, text: s.text })), verses };
}

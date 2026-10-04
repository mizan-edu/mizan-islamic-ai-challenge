// Concept-level events, on the device only (CLAUDE.md §6, R8). The schema is fixed:
// { stationId, conceptId?, event, choiceId?, level?, sourceIds, t } — IDs, a level and a timestamp.
// No free text, no names, no audio: unknown keys and non-ID values are rejected.

import type { Reply } from './reply';

export type EventName = 'answered' | 'hint_used' | 'verse_shown' | 'narrated' | 'referred' | 'safety_referral';
export type EventLevel = 'A' | 'B' | 'C' | 'D' | 'OUT_OF_SCOPE';

export interface SessionEvent {
  stationId: string;
  conceptId?: string;
  event: EventName;
  choiceId?: string;
  level?: EventLevel;
  sourceIds: string[];
  t: number;
}

const EVENTS = new Set<EventName>(['answered', 'hint_used', 'verse_shown', 'narrated', 'referred', 'safety_referral']);
const LEVELS = new Set<EventLevel>(['A', 'B', 'C', 'D', 'OUT_OF_SCOPE']);
const ALLOWED = new Set(['stationId', 'conceptId', 'event', 'choiceId', 'level', 'sourceIds', 't']);
const ID = /^[A-Z][A-Z0-9]*(\.[A-Za-z0-9-]+)*$/; // e.g. S1, S1.C2, S1.Q2.c3, S3.V1-ALT

export class EventError extends Error {}

export function makeEvent(input: Record<string, unknown>): SessionEvent {
  for (const k of Object.keys(input)) if (!ALLOWED.has(k)) throw new EventError(`field not allowed: ${k}`);
  const { stationId, conceptId, event, choiceId, level, sourceIds, t } = input;
  if (typeof stationId !== 'string' || !/^S\d+$/.test(stationId)) throw new EventError('stationId');
  if (conceptId !== undefined && (typeof conceptId !== 'string' || !ID.test(conceptId))) throw new EventError('conceptId');
  if (typeof event !== 'string' || !EVENTS.has(event as EventName)) throw new EventError('event');
  if (choiceId !== undefined && (typeof choiceId !== 'string' || !ID.test(choiceId))) throw new EventError('choiceId');
  if (level !== undefined && (typeof level !== 'string' || !LEVELS.has(level as EventLevel))) throw new EventError('level');
  if (!Array.isArray(sourceIds) || !sourceIds.every((s) => typeof s === 'string' && ID.test(s))) throw new EventError('sourceIds');
  if (typeof t !== 'number' || !Number.isInteger(t) || t < 0) throw new EventError('t');
  return {
    stationId, event: event as EventName, sourceIds: [...sourceIds] as string[], t,
    ...(conceptId !== undefined ? { conceptId: conceptId as string } : {}),
    ...(choiceId !== undefined ? { choiceId: choiceId as string } : {}),
    ...(level !== undefined ? { level: level as EventLevel } : {}),
  };
}

const EVENT_FOR: Record<Reply['behaviour'], EventName> = {
  answer: 'answered', verse_card: 'verse_shown', correction: 'verse_shown', referral: 'referred', fallback: 'referred',
};

// The event for a reply: IDs and level only — never the question text.
export function eventForReply(reply: Reply, stationId: string, nowSeconds: number): SessionEvent {
  return makeEvent({
    stationId,
    event: EVENT_FOR[reply.behaviour],
    ...(reply.level !== 'NA' ? { level: reply.level } : {}),
    sourceIds: reply.citations,
    t: nowSeconds,
  });
}

// In-memory session log (the client mirrors it to sessionStorage; cleared by the parent button).
export class SessionLog {
  private events: SessionEvent[] = [];
  add(input: Record<string, unknown>): SessionEvent { const e = makeEvent(input); this.events.push(e); return e; }
  list(): readonly SessionEvent[] { return this.events; }
  clear(): void { this.events = []; }
}

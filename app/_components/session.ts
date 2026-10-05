'use client';

// On-device session only (CLAUDE.md §6): concept-level events and completed station IDs in
// sessionStorage. Nothing is sent to the server. Storage may be unavailable; failures are ignored.

import { makeEvent, type SessionEvent } from '@/app/_lib/events';
import type { EventInput } from '@/app/_lib/flow';

const EVENTS_KEY = 'mizan.events';
const PROGRESS_KEY = 'mizan.progress';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the journey still works, nothing is kept */
  }
}

export function addEvents(inputs: (EventInput | Record<string, unknown>)[]): void {
  const valid: SessionEvent[] = [];
  for (const i of inputs) {
    try { valid.push(makeEvent(i as Record<string, unknown>)); } catch { /* reject anything outside the §6 schema */ }
  }
  if (valid.length) write(EVENTS_KEY, [...read<SessionEvent[]>(EVENTS_KEY, []), ...valid]);
}

export const completedStations = (): string[] => read<string[]>(PROGRESS_KEY, []);

// The concept-level events of this session (parent summary, D54 Phase 4): read on the device only.
export const sessionEvents = (): SessionEvent[] => read<SessionEvent[]>(EVENTS_KEY, []);

// Fired on window after the session is cleared, so an open parent summary can refresh.
export const SESSION_CLEARED = 'mizan:session-cleared';

export function markCompleted(stationId: string): void {
  const done = completedStations();
  if (!done.includes(stationId)) write(PROGRESS_KEY, [...done, stationId]);
}

export function clearSession(): void {
  try { window.sessionStorage.removeItem(EVENTS_KEY); window.sessionStorage.removeItem(PROGRESS_KEY); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(SESSION_CLEARED)); } catch { /* no window */ }
}

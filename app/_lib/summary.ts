// Parent summary card (D54, Phase 4): built on the device from the session's existing concept-level
// events and completed-station list only. No score, no new event, nothing sent anywhere. For each
// completed station: how many hint rungs the child opened in the observe step (the only step with
// hints), whether the last rung ("let's find it together") was reached, and how many of the child's
// pre-written questions were answered with a referral to the parents. Separately, whether any
// safety_referral event exists (CLAUDE.md §5.2: shown prominently). Client-safe.

import type { SessionEvent } from './events';

export interface SummaryStation {
  id: string;
  hintIds: string[]; // the observe step's hint ladder, in order, then the "together" rung
}

export interface StationSummary {
  id: string;
  hintsUsed: number; // distinct hint rungs opened
  hintsTotal: number;
  together: boolean; // the last rung was reached
  referred: number; // replies that referred the question to the parents
}

export interface SessionSummary {
  completed: StationSummary[]; // in journey order
  safetyReferral: boolean;
}

export function summarize(events: readonly SessionEvent[], completed: readonly string[], stations: readonly SummaryStation[]): SessionSummary {
  const done = stations.filter((s) => completed.includes(s.id));
  return {
    completed: done.map((s) => {
      const mine = events.filter((e) => e.stationId === s.id);
      const opened = new Set(mine.flatMap((e) => (e.event === 'hint_used' ? e.sourceIds.filter((id) => s.hintIds.includes(id)) : [])));
      const last = s.hintIds.at(-1);
      return {
        id: s.id,
        hintsUsed: opened.size,
        hintsTotal: s.hintIds.length,
        together: last !== undefined && opened.has(last),
        referred: mine.filter((e) => e.event === 'referred').length,
      };
    }),
    safetyReferral: events.some((e) => e.event === 'safety_referral'),
  };
}

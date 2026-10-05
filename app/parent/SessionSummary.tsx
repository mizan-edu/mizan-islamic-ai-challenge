'use client';

// Parent summary card (D54, Phase 4): this session's journey, read on the device after mount from the
// existing session events and completed-station list (sessionStorage). Shows the stations completed,
// the hint rungs opened in each one's observe step, any question referred to the parents, and the
// approved parent-summary lines (PS records) of the completed stations. No score and no generated
// prose: every line is approved wording or a count. A safety_referral event is shown first and
// prominently (CLAUDE.md §5.2). Nothing is sent anywhere; «إعادة البدء» clears it at once.

import { useCallback, useEffect, useState } from 'react';
import type { RecordView } from '@/app/_lib/station-view';
import { summarize, type SessionSummary as Summary, type SummaryStation } from '@/app/_lib/summary';
import { completedStations, SESSION_CLEARED, sessionEvents } from '@/app/_components/session';
import { SUMMARY } from './text';

export interface SummaryCardStation extends SummaryStation { title: string; parent: RecordView[] }

export default function SessionSummary({ stations, initial = null }: { stations: SummaryCardStation[]; initial?: Summary | null }) {
  const [summary, setSummary] = useState<Summary | null>(initial);
  const refresh = useCallback(() => setSummary(summarize(sessionEvents(), completedStations(), stations)), [stations]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    window.addEventListener(SESSION_CLEARED, refresh);
    return () => window.removeEventListener(SESSION_CLEARED, refresh);
  }, [refresh]);

  const byId = new Map(stations.map((s) => [s.id, s]));
  return (
    <section className="card flex flex-col gap-4 p-6" data-session-summary={summary?.completed.length ?? 0}>
      <h2 className="font-display text-2xl text-ink">{SUMMARY.heading}</h2>
      {summary?.safetyReferral && (
        <p role="alert" className="rounded-2xl border-s-8 border-sun bg-sun-soft px-4 py-3 text-xl leading-relaxed text-ink" data-summary-safety>{SUMMARY.safety}</p>
      )}
      <p className="text-lg text-ink-2">{SUMMARY.privacy}</p>
      {summary && summary.completed.length === 0 && <p className="text-xl text-ink" data-summary-empty>{SUMMARY.empty}</p>}
      {summary && summary.completed.length > 0 && (
        <>
          <p className="font-display text-xl text-ink" data-summary-count>{SUMMARY.completed(summary.completed.length, stations.length)}</p>
          <ul className="flex flex-col gap-4">
            {summary.completed.map((c) => {
              const s = byId.get(c.id)!;
              return (
                <li key={c.id} className="flex flex-col gap-2 rounded-2xl bg-sky-soft px-4 py-3" data-summary-station={c.id} data-hints={c.hintsUsed} data-referred={c.referred}>
                  <h3 className="font-display text-xl leading-relaxed text-ink">{s.title}</h3>
                  <p className="text-lg text-ink" data-summary-hints>
                    {c.hintsUsed === 0 ? SUMMARY.noHints : `${SUMMARY.hints(c.hintsUsed, c.hintsTotal)}${c.together ? ` ${SUMMARY.together}` : ''}`}
                  </p>
                  {c.referred > 0 && <p className="text-lg text-ink" data-summary-referred>{SUMMARY.referred(c.referred)}</p>}
                  {s.parent.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <p className="font-display text-lg text-ink-2">{SUMMARY.learned}</p>
                      {s.parent.map((r) => <p key={r.id} className="text-lg leading-relaxed text-ink" data-summary-line={r.id}>{r.text}</p>)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

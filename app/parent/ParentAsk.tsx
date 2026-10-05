'use client';

// Parent Ask (D54, Phase 3), behind the parental gate on /parent. The parent picks a station and types
// a question; it goes to POST /api/try exactly as the evaluation page sends it ({ stationId, text }),
// through the same classification, retrieval and validation as a child's question. The reply is the
// approved answer, referral or fallback record, shown as a child would see it, with its behaviour,
// level, decision kind (rule or model) and sources (platform + ID). With the AI lens on, the full
// decision and trace follow.
// Privacy (D54): the typed text lives only in this component's state. It is never written to storage,
// never added to the session events, never logged; /api/try returns no event. Leaving the page drops it.
// No animation: a reply may carry a verse card, and nothing moves on or near the verse (D26).

import { useEffect, useState } from 'react';
import JudgePanel from '@/app/_components/JudgePanel';
import { VerseCard } from '@/app/_components/media';
import { judgeEnabled } from '@/app/_lib/judge';
import type { Labels } from '@/app/_lib/labels';
import { sourcesOf, traceDecision, type LensSource } from '@/app/_lib/lens';
import type { ReplyView } from '@/app/_lib/reply-view';
import type { RecordSource } from '@/app/_lib/station-view';
import type { Trace } from '@/app/_lib/trace';
import { T } from '@/app/evaluation/text';
import { PARENT_ASK } from './text';

export type ParentAskResult = ReplyView & { trace: Trace | null };
type Status = 'idle' | 'busy' | 'rate_limited' | 'error';

// The request body: the station and the question text, nothing else (no ID, no session, no event).
export const askBody = (stationId: string, text: string) => ({ stationId, text });

const chip = 'inline-flex items-center gap-2 rounded-full bg-sky-soft px-3 py-1 text-base text-ink';

function SourceChip({ s }: { s: LensSource }) {
  return (
    <li className={chip} data-source-chip={s.id}>
      <code dir="ltr" className="font-mono text-sm">{s.id}</code>
      <span>{s.platform ? <span dir="ltr">{`${s.platform}${s.platformId ? ` · ${s.platformId}` : ''}`}</span> : PARENT_ASK.library}</span>
    </li>
  );
}

export default function ParentAsk({ stations, sources, labels, maxChars, initialResult = null, initialJudge = false }: {
  stations: { id: string; title: string }[];
  sources: Record<string, RecordSource>;
  labels: Labels;
  maxChars: number;
  initialResult?: ParentAskResult | null; // tests
  initialJudge?: boolean; // tests
}) {
  const [station, setStation] = useState(stations[0]?.id ?? '');
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [capReached, setCapReached] = useState(false);
  const [result, setResult] = useState<ParentAskResult | null>(initialResult);
  const [judge, setJudge] = useState(initialJudge);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (judgeEnabled()) setJudge(true); }, []);

  const send = async () => {
    setStatus('busy');
    try {
      const res = await fetch('/api/try', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(askBody(station, typed)), signal: AbortSignal.timeout(15000) });
      const json = (await res.json()) as ParentAskResult & { error?: string };
      if (res.status === 429 && json.error === 'daily_cap') { setCapReached(true); setStatus('idle'); return; }
      if (res.status === 429) { setStatus('rate_limited'); return; }
      if (!res.ok) { setStatus('error'); return; }
      setResult(json);
      setStatus('idle');
      setTyped('');
    } catch {
      setStatus('error');
    }
  };

  const decision = result?.trace ? traceDecision({ sources }, result.trace, null) : null;
  const cited = result?.trace?.cited ?? result?.segments.map((s) => s.recordId) ?? [];
  const field = 'w-full rounded-xl border border-stone bg-card px-4 py-3 text-lg text-ink';
  const button = 'pill min-h-12 self-start bg-leaf-dark px-6 py-2 font-display text-lg text-white disabled:opacity-50';
  return (
    <section className="card flex flex-col gap-5 p-6" data-parent-ask>
      <h2 className="font-display text-2xl text-ink">{PARENT_ASK.heading}</h2>
      <p className="text-lg leading-relaxed text-ink-2">{PARENT_ASK.intro}</p>
      <label className="flex flex-col gap-2">
        <span className="font-display text-lg text-ink">{T.try.station}</span>
        <select className={field} value={station} onChange={(e) => setStation(e.target.value)} data-ask-station>
          {stations.map((s) => <option key={s.id} value={s.id}>{`${s.id} · ${s.title}`}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-display text-lg text-ink">{PARENT_ASK.question}</span>
        <textarea className={`${field} min-h-24`} value={typed} maxLength={maxChars} rows={2} disabled={capReached}
          onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} data-ask-text aria-describedby="ask-hint" />
        <span id="ask-hint" className="text-sm text-ink-2">{T.try.typedHint(maxChars)} · <span dir="ltr">{[...typed].length}/{maxChars}</span></span>
      </label>
      <button type="button" className={button} disabled={capReached || status === 'busy' || !typed.trim()} onClick={() => void send()} data-ask-send>{T.try.sendTyped}</button>

      <div aria-live="polite" className="flex flex-col gap-2">
        {capReached && <p className="rounded-xl bg-sun-soft px-4 py-3 text-lg text-ink" data-ask-cap>{T.try.capReached}</p>}
        {status === 'busy' && <p className="text-ink-2">{T.try.busy}</p>}
        {status === 'rate_limited' && <p className="rounded-xl bg-sun-soft px-4 py-3 text-ink" data-ask-rate>{T.try.rateLimited}</p>}
        {status === 'error' && <p className="rounded-xl bg-sun-soft px-4 py-3 text-ink" data-ask-error>{T.try.error}</p>}
      </div>

      {result && (
        <div className="flex flex-col gap-3" data-ask-result={result.behaviour}>
          <div className="card flex flex-col gap-4 p-5" aria-label={T.try.replyLabel} data-ask-reply>
            {result.segments.filter((s) => s.kind === 'text').map((s) => <p key={s.recordId} className="font-display text-2xl leading-relaxed text-ink" data-line={s.recordId}>{s.text}</p>)}
            {result.verses.map((v) => <VerseCard key={v.id} verse={v} playLabel={labels.playRecitation} label={labels.verseLabel} surahLabel={labels.surah} ayahLabel={labels.ayah} />)}
          </div>
          <ul className="flex flex-wrap items-center gap-2" data-ask-meta>
            <li className={`${chip} bg-leaf-soft`} data-ask-behaviour={result.behaviour}>{PARENT_ASK.behaviour[result.behaviour]}</li>
            <li className={chip} data-ask-level={result.level}>{labels.judgeLevel && <span>{labels.judgeLevel}</span>}<code dir="ltr" className="font-mono text-sm">{result.level}</code></li>
            {decision && <li className={`${chip} ${decision.kind === 'model' ? 'bg-sun-soft' : ''}`} data-ask-kind={decision.kind}>{labels.judgeDecision && <span>{labels.judgeDecision}</span>}<span>{PARENT_ASK.kind[decision.kind]}</span></li>}
          </ul>
          {cited.length > 0 && (
            <div className="flex flex-col gap-2">
              {labels.judgeSource && <span className="font-display text-lg text-ink">{labels.judgeSource}</span>}
              <ul className="flex flex-wrap gap-2" data-ask-sources>{sourcesOf(sources, cited).map((s, i) => <SourceChip key={`${s.id}-${i}`} s={s} />)}</ul>
            </div>
          )}
          {judge && result.trace && decision && <JudgePanel decisions={[decision]} trace={result.trace} labels={labels} />}
        </div>
      )}
    </section>
  );
}

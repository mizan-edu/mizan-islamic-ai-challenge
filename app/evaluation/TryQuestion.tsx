'use client';

// «جرّب سؤالًا» (Runbook 3.7): pick a station, then an active test item or a typed question (at most
// MAX_CHARS characters). The reply is shown exactly as a child sees it, with the judge trace open
// beneath it. Typed text lives only in this component's state: never stored, never logged, no events.

import { useMemo, useState } from 'react';
import JudgePanel from '@/app/_components/JudgePanel';
import { VerseCard } from '@/app/_components/media';
import type { Labels } from '@/app/_lib/labels';
import type { ReplyView } from '@/app/_lib/reply-view';
import type { Trace } from '@/app/_lib/trace';
import { T } from './text';

export interface PickItem { id: string; category: string; stationId: string | null; text: string }
type Result = ReplyView & { trace: Trace | null };
type Status = 'idle' | 'busy' | 'rate_limited' | 'error';

export default function TryQuestion({ stations, items, excluded, labels, maxChars, initialCapReached = false, initialResult = null }: {
  stations: { id: string; title: string }[];
  items: PickItem[];
  excluded: string[];
  labels: Labels;
  maxChars: number;
  initialCapReached?: boolean; // tests
  initialResult?: Result | null; // tests
}) {
  const [station, setStation] = useState(stations[0]?.id ?? '');
  const own = useMemo(() => items.filter((i) => i.stationId === station), [items, station]);
  const general = useMemo(() => items.filter((i) => i.stationId === null), [items]);
  const [itemId, setItemId] = useState('');
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [capReached, setCapReached] = useState(initialCapReached);
  const [result, setResult] = useState<Result | null>(initialResult);
  const chosen = own.some((i) => i.id === itemId) || general.some((i) => i.id === itemId) ? itemId : (own[0] ?? general[0])?.id ?? '';

  const ask = async (body: Record<string, string>, typedQuestion: boolean) => {
    setStatus('busy');
    try {
      const res = await fetch('/api/try', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stationId: station, ...body }), signal: AbortSignal.timeout(15000) });
      const json = (await res.json()) as Result & { error?: string };
      if (res.status === 429 && json.error === 'daily_cap') { setCapReached(true); setStatus('idle'); return; }
      if (res.status === 429) { setStatus('rate_limited'); return; }
      if (!res.ok) { setStatus('error'); return; }
      setResult(json);
      setStatus('idle');
      if (typedQuestion) setTyped('');
    } catch {
      setStatus('error');
    }
  };

  const field = 'w-full rounded-xl border border-stone bg-card px-4 py-3 text-lg text-ink';
  const button = 'pill min-h-12 self-start bg-leaf-dark px-6 py-2 font-display text-lg text-white disabled:opacity-50';
  return (
    <div className="flex flex-col gap-5" data-try>
      <p className="text-lg leading-relaxed text-ink-2">{T.try.intro}</p>
      <label className="flex flex-col gap-2">
        <span className="font-display text-lg text-ink">{T.try.station}</span>
        <select className={field} value={station} onChange={(e) => { setStation(e.target.value); setItemId(''); }} data-try-station>
          {stations.map((s) => <option key={s.id} value={s.id}>{`${s.id} · ${s.title}`}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-display text-lg text-ink">{T.try.item}</span>
        <select className={field} value={chosen} onChange={(e) => setItemId(e.target.value)} data-try-item>
          {own.map((i) => <option key={i.id} value={i.id}>{`${i.id} · ${i.text}`}</option>)}
          {general.length > 0 && (
            <optgroup label={T.try.general}>
              {general.map((i) => <option key={i.id} value={i.id}>{`${i.id} · ${i.text}`}</option>)}
            </optgroup>
          )}
        </select>
      </label>
      <button type="button" className={button} disabled={status === 'busy' || !chosen} onClick={() => void ask({ itemId: chosen }, false)} data-try-show>{T.try.showItem}</button>
      {excluded.length > 0 && <p className="text-sm text-ink-2">{T.try.excluded(excluded.join('، '))}</p>}

      <label className="flex flex-col gap-2">
        <span className="font-display text-lg text-ink">{T.try.typed}</span>
        <textarea className={`${field} min-h-24`} value={typed} maxLength={maxChars} rows={2} disabled={capReached}
          onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} data-try-text aria-describedby="try-hint" />
        <span id="try-hint" className="text-sm text-ink-2">{T.try.typedHint(maxChars)} · <span dir="ltr">{[...typed].length}/{maxChars}</span></span>
      </label>
      <button type="button" className={button} disabled={capReached || status === 'busy' || !typed.trim()} onClick={() => void ask({ text: typed }, true)} data-try-send>{T.try.sendTyped}</button>

      <div aria-live="polite" className="flex flex-col gap-2">
        {capReached && <p className="rounded-xl bg-sun-soft px-4 py-3 text-lg text-ink" data-try-cap>{T.try.capReached}</p>}
        {status === 'busy' && <p className="text-ink-2">{T.try.busy}</p>}
        {status === 'rate_limited' && <p className="rounded-xl bg-sun-soft px-4 py-3 text-ink" data-try-rate>{T.try.rateLimited}</p>}
        {status === 'error' && <p className="rounded-xl bg-sun-soft px-4 py-3 text-ink">{T.try.error}</p>}
      </div>

      {result && (
        <div className="flex flex-col" data-try-result>
          <div className="card flex flex-col gap-4 p-5" aria-label={T.try.replyLabel} data-try-reply>
            {result.segments.filter((s) => s.kind === 'text').map((s) => <p key={s.recordId} className="font-display text-2xl leading-relaxed text-ink" data-line={s.recordId}>{s.text}</p>)}
            {result.verses.map((v) => <VerseCard key={v.id} verse={v} playLabel={labels.playRecitation} label={labels.verseLabel} surahLabel={labels.surah} ayahLabel={labels.ayah} />)}
          </div>
          {result.trace && <JudgePanel trace={result.trace} labels={labels} />}
        </div>
      )}
    </div>
  );
}

'use client';

// Glass-box view (D60) for judges and parents. Left on a laptop (below on a tablet): the input side —
// test-set examples and a typed question (POST /api/try, the existing route and daily cap), or the
// child path (POST /api/ask?judge=1 with a pre-written question, the child's own route). Right: the
// seven-step pipeline, built only from the real trace the server returned (app/_lib/glass.ts) and
// replayed one step per REPLAY_MS ms, labelled as a replay at a readable pace, with the real server
// time beside it. Steps the trace shows did not happen stay dim; restricted paths are amber, never red.
// Privacy: the typed text lives only in this component's state; nothing is stored or logged, and the
// child route's session event is ignored here. The reply (and any verse card) appears only after the
// replay ends, so nothing moves near a verse. Reduced motion: steps change state without movement.

import { useEffect, useState } from 'react';
import { VerseCard } from '@/app/_components/media';
import { GLASS_STEPS, pipelineFromTrace, REPLAY_MS, type GlassInput, type GlassKey, type GlassNode, type GlassStep } from '@/app/_lib/glass';
import type { Labels } from '@/app/_lib/labels';
import type { ReplyView } from '@/app/_lib/reply-view';
import type { RecordSource } from '@/app/_lib/station-view';
import type { Trace } from '@/app/_lib/trace';
import { TRY } from '@/app/evaluation/try-text';
import { PARENT_ASK } from '@/app/parent/text';
import type { GlassOutcome } from './presets';

export interface GlassPreset { id: string; outcome: GlassOutcome; category: string; stationId: string | null }
export interface GlassStation { id: string; title: string; questions: { id: string; text: string }[] }
export interface GlassRun { nodes: GlassNode[]; reply: ReplyView; latencyMs: number }
type Status = 'idle' | 'busy' | 'rate_limited' | 'error';

const STEP_LABEL: Record<GlassStep, [keyof Labels, string]> = {
  question: ['glassNodeQuestion', 'Question'],
  rules: ['glassNodeRules', 'Fixed rules'],
  classifier: ['glassNodeClassifier', 'AI classifier (model)'],
  level: ['glassNodeLevel', 'Level gate A–D'],
  library: ['glassNodeLibrary', 'Approved library'],
  validator: ['glassNodeValidator', 'Verse validator (KFC ID)'],
  output: ['glassNodeOutput', 'Output'],
};
const FIELD_LABEL: Record<GlassKey, (l: Labels) => string> = {
  input: () => 'input', station: () => TRY.station, route: (l) => l.judgeRoute ?? 'route', rules: () => 'rules',
  model: (l) => l.judgeModel ?? 'model', latency: (l) => l.judgeLatency ?? 'latency', tokens: (l) => l.judgeTokens ?? 'tokens',
  result: () => 'result', fallback: (l) => l.judgeFallback ?? 'fallback', level: (l) => l.judgeLevel ?? 'level',
  classifierLevel: (l) => l.judgeClassifierLevel ?? 'classifier level', floor: () => 'floor', category: () => 'category',
  records: (l) => l.judgeRecords ?? 'records', sources: (l) => l.judgeSource ?? 'source', validator: (l) => l.judgeValidator ?? 'validator',
  verses: () => 'verses', behaviour: (l) => l.judgeDecision ?? 'behaviour',
};

const CARD: Record<string, string> = {
  ok: 'border-leaf bg-leaf-soft', amber: 'border-sun bg-sun-soft', neutral: 'border-water-light bg-card',
  skipped: 'border-stone bg-stone', pending: 'border-stone bg-card',
};

function Dot({ state, tone }: { state: 'pending' | 'active' | GlassNode['status']; tone: GlassNode['tone'] }) {
  const fill = state === 'decided' ? (tone === 'amber' ? 'var(--color-sun)' : tone === 'ok' ? 'var(--color-leaf)' : 'var(--color-water-light)') : 'none';
  const stroke = state === 'skipped' ? 'var(--color-ink-2)' : state === 'pending' ? 'var(--color-stone)' : tone === 'amber' ? 'var(--color-sun)' : 'var(--color-water)';
  return (
    <svg viewBox="0 0 28 28" className="size-7 shrink-0" aria-hidden="true">
      {state === 'active' && <circle cx="14" cy="14" r="9" className="glass-pulse" fill="var(--color-water-light)" />}
      <circle cx="14" cy="14" r="9" fill={fill} stroke={stroke} strokeWidth="2.5" strokeDasharray={state === 'skipped' ? '3 3' : undefined} />
    </svg>
  );
}

function Pipeline({ nodes, revealed, labels }: { nodes: GlassNode[] | null; revealed: number; labels: Labels }) {
  return (
    <ol className="flex flex-col" data-glass-pipeline data-revealed={revealed}>
      {GLASS_STEPS.map((step, i) => {
        const node = nodes?.[i] ?? null;
        const shown = node && i < revealed;
        const state = !shown ? 'pending' : node.status;
        const active = shown && i === revealed - 1 && revealed < GLASS_STEPS.length;
        const look = !shown ? CARD.pending : node.status === 'skipped' ? CARD.skipped : node.status === 'passed' ? CARD.neutral : CARD[node.tone];
        const [labelKey, fallback] = STEP_LABEL[step];
        const lit = Boolean(nodes && i + 1 < revealed);
        return (
          <li key={step} className="flex gap-3" data-glass-step={step} data-glass-state={state} data-glass-tone={shown ? node.tone : 'pending'}>
            <div className="flex w-7 shrink-0 flex-col items-center">
              <Dot state={active ? 'active' : state} tone={node?.tone ?? 'neutral'} />
              {i < GLASS_STEPS.length - 1 && (
                <div className="relative w-1 flex-1 rounded-full bg-stone" aria-hidden="true">
                  <div className={`absolute inset-0 rounded-full transition-opacity duration-300 ${nodes?.[i + 1]?.tone === 'amber' ? 'bg-sun' : 'bg-leaf'} ${lit ? 'opacity-100' : 'opacity-0'}`} />
                  {lit && <div key={`flow-${revealed}-${i}`} className="glass-flow absolute inset-x-0 top-0 h-full"><span className="block size-2 -translate-x-0.5 rounded-full bg-water" /></div>}
                </div>
              )}
            </div>
            <div className={`mb-3 flex flex-1 flex-col gap-1 rounded-2xl border-s-4 px-4 py-2 ${look}`}>
              <h3 dir="auto" className="font-display text-lg text-ink">{labels[labelKey] ?? fallback}</h3>
              {shown && node.status === 'skipped' && <p dir="auto" className="text-base text-ink-2" data-glass-not-taken>{labels.glassNotTaken ?? 'not used for this reply'}</p>}
              {shown && node.fields.length > 0 && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                  {node.fields.map((x, k) => (
                    <div key={k} className="contents" data-glass-field={x.key}>
                      <dt className="text-ink-2">{FIELD_LABEL[x.key](labels)}</dt>
                      <dd dir="ltr" className="break-all text-end font-mono text-xs text-ink">{x.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function GlassBox({ labels, stations, sources, presets, maxChars, initialRun = null, initialRevealed = 0 }: {
  labels: Labels; stations: GlassStation[]; sources: Record<string, RecordSource>; presets: GlassPreset[]; maxChars: number;
  initialRun?: GlassRun | null; initialRevealed?: number; // tests
}) {
  const [tab, setTab] = useState<'ask' | 'child'>('ask');
  const [station, setStation] = useState(stations[0]?.id ?? '');
  const [childStation, setChildStation] = useState(stations[0]?.id ?? '');
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [capReached, setCapReached] = useState(false);
  const [run, setRun] = useState<GlassRun | null>(initialRun);
  const [revealed, setRevealed] = useState(initialRevealed);
  const [childCalls, setChildCalls] = useState(0);
  const [childTaps, setChildTaps] = useState(0);

  // Replay: one step per REPLAY_MS, from the real trace only.
  useEffect(() => {
    if (!run || revealed >= GLASS_STEPS.length) return;
    const t = window.setTimeout(() => setRevealed((n) => n + 1), revealed === 0 ? 50 : REPLAY_MS);
    return () => window.clearTimeout(t);
  }, [run, revealed]);

  const start = (trace: Trace | null | undefined, reply: ReplyView, input: GlassInput) => {
    if (!trace) { setStatus('error'); return; }
    setRun({ nodes: pipelineFromTrace(trace, input, sources), reply, latencyMs: trace.latencyMs });
    setRevealed(0);
    setStatus('idle');
  };

  const ask = async (body: Record<string, string>, input: GlassInput) => {
    setStatus('busy');
    setRun(null);
    try {
      const res = await fetch('/api/try', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      const json = (await res.json()) as ReplyView & { trace?: Trace | null; error?: string };
      if (res.status === 429 && json.error === 'daily_cap') { setCapReached(true); setStatus('idle'); return; }
      if (res.status === 429) { setStatus('rate_limited'); return; }
      if (!res.ok) { setStatus('error'); return; }
      if (input.kind === 'typed') setTyped('');
      start(json.trace, json, input);
    } catch {
      setStatus('error');
    }
  };

  const askChild = async (questionId: string) => {
    setStatus('busy');
    setRun(null);
    try {
      const res = await fetch('/api/ask?judge=1', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stationId: childStation, questionId }), signal: AbortSignal.timeout(15000) });
      if (!res.ok) { setStatus('error'); return; }
      const json = (await res.json()) as ReplyView & { trace?: Trace | null }; // the session event in the response is ignored
      setChildTaps((n) => n + 1);
      setChildCalls((n) => n + (json.trace?.modelCalls?.length ?? 0));
      start(json.trace, json, { kind: 'child', questionId, stationId: childStation });
    } catch {
      setStatus('error');
    }
  };

  const field = 'w-full rounded-xl border border-stone bg-card px-4 py-3 text-lg text-ink';
  const button = 'pill min-h-12 px-5 py-2 font-display text-lg disabled:opacity-50';
  const done = run && revealed >= GLASS_STEPS.length;
  const childQuestions = stations.find((s) => s.id === childStation)?.questions ?? [];
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-8" data-screen="glass">
      <header className="flex flex-col gap-2">
        <h1 dir="auto" className="font-display text-3xl text-ink">{labels.glassTitle ?? 'Glass box'}</h1>
        <p dir="auto" className="text-lg leading-relaxed text-ink-2">{labels.glassIntro ?? 'Every step below comes from the real server trace of this question; steps that did not happen stay dim.'}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 min-[1180px]:grid-cols-2">
        {/* Input side: first in the DOM (on top on a tablet); on a laptop it sits on the left. */}
        <section className="card flex flex-col gap-4 p-5 min-[1180px]:order-2" data-glass-input>
          <div role="tablist" aria-label={labels.glassTitle ?? 'Glass box'} className="flex gap-3">
            {(['ask', 'child'] as const).map((t) => (
              <button key={t} type="button" role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls={`panel-${t}`} onClick={() => setTab(t)}
                className={`${button} ${tab === t ? 'bg-ink-2 text-white' : 'bg-card text-ink'}`} data-glass-tab={t}>
                {t === 'ask' ? labels.glassTabAsk ?? 'Adult question' : labels.glassTabChild ?? 'Child mode'}
              </button>
            ))}
          </div>

          {tab === 'ask' && (
            <div role="tabpanel" id="panel-ask" aria-labelledby="tab-ask" className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h2 dir="auto" className="font-display text-lg text-ink">{labels.glassPresets ?? 'Test-set examples'}</h2>
                <div className="flex flex-wrap gap-3">
                  {presets.map((p) => (
                    <button key={p.id} type="button" disabled={status === 'busy'} data-glass-preset={p.id} data-outcome={p.outcome}
                      onClick={() => void ask({ stationId: p.stationId ?? stations[0]?.id ?? 'S1', itemId: p.id }, { kind: 'preset', itemId: p.id, category: p.category, stationId: p.stationId })}
                      className={`${button} ${p.outcome === 'referral' || p.outcome === 'fallback' ? 'bg-sun-soft' : 'bg-leaf-soft'} text-ink`}>
                      <span>{PARENT_ASK.behaviour[p.outcome]}</span> <code dir="ltr" className="font-mono text-sm">{p.id}</code>
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex flex-col gap-2">
                <span className="font-display text-lg text-ink">{TRY.station}</span>
                <select className={field} value={station} onChange={(e) => setStation(e.target.value)} data-glass-station>
                  {stations.map((s) => <option key={s.id} value={s.id}>{`${s.id} · ${s.title}`}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-display text-lg text-ink">{PARENT_ASK.question}</span>
                <textarea className={`${field} min-h-20`} value={typed} maxLength={maxChars} rows={2} disabled={capReached}
                  onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} data-glass-text aria-describedby="glass-hint" />
                <span id="glass-hint" className="text-sm text-ink-2">{TRY.typedHint(maxChars)} · <span dir="ltr">{[...typed].length}/{maxChars}</span></span>
              </label>
              <button type="button" className={`${button} self-start bg-leaf-dark text-white`} disabled={capReached || status === 'busy' || !typed.trim()}
                onClick={() => void ask({ stationId: station, text: typed }, { kind: 'typed', chars: [...typed.trim()].length, stationId: station })} data-glass-send>{TRY.sendTyped}</button>
            </div>
          )}

          {tab === 'child' && (
            <div role="tabpanel" id="panel-child" aria-labelledby="tab-child" className="flex flex-col gap-4">
              <p dir="auto" className="text-lg leading-relaxed text-ink-2">{labels.glassChildIntro ?? 'A child taps pre-written questions; fixed rules answer them without a model call.'}</p>
              <p dir="auto" className="font-display rounded-2xl bg-leaf-soft px-4 py-3 text-xl text-ink" aria-live="polite" data-child-calls={childCalls} data-child-taps={childTaps}>
                {labels.glassChildCounter ?? 'Model calls in the child session'}: <span dir="ltr">{childCalls}</span>
              </p>
              <label className="flex flex-col gap-2">
                <span className="font-display text-lg text-ink">{TRY.station}</span>
                <select className={field} value={childStation} onChange={(e) => setChildStation(e.target.value)} data-glass-child-station>
                  {stations.map((s) => <option key={s.id} value={s.id}>{`${s.id} · ${s.title}`}</option>)}
                </select>
              </label>
              <div className="flex flex-wrap gap-3">
                {childQuestions.map((q) => (
                  <button key={q.id} type="button" disabled={status === 'busy'} onClick={() => void askChild(q.id)} data-glass-question={q.id}
                    className={`${button} bg-card text-ink ring-2 ring-stone`}>{q.text}</button>
                ))}
              </div>
            </div>
          )}

          <div aria-live="polite" className="flex flex-col gap-2">
            {capReached && <p className="rounded-xl bg-sun-soft px-4 py-3 text-lg text-ink" data-glass-cap>{TRY.capReached}</p>}
            {status === 'busy' && <p className="text-ink-2">{TRY.busy}</p>}
            {status === 'rate_limited' && <p className="rounded-xl bg-sun-soft px-4 py-3 text-ink">{TRY.rateLimited}</p>}
            {status === 'error' && <p className="rounded-xl bg-sun-soft px-4 py-3 text-ink" data-glass-error>{TRY.error}</p>}
          </div>

          {/* The reply as a child sees it, only once the replay has ended (nothing moves near a verse). */}
          {done && (
            <div className="flex flex-col gap-3" data-glass-reply={run.reply.behaviour}>
              <h2 className="font-display text-lg text-ink">{TRY.replyLabel}</h2>
              <div className="card flex flex-col gap-4 p-5">
                {run.reply.segments.filter((s) => s.kind === 'text').map((s) => <p key={s.recordId} className="font-display text-2xl leading-relaxed text-ink" data-line={s.recordId}>{s.text}</p>)}
                {run.reply.verses.map((v) => <VerseCard key={v.id} verse={v} playLabel={labels.playRecitation} label={labels.verseLabel} surahLabel={labels.surah} ayahLabel={labels.ayah} />)}
              </div>
            </div>
          )}
        </section>

        {/* Pipeline: below the input on a tablet; on the right on a laptop. */}
        <section className="card flex flex-col gap-4 p-5 min-[1180px]:order-1" data-glass-pipeline-section>
          {run && (
            <p dir="auto" className="text-base text-ink-2" data-glass-replay>
              {labels.glassReplay ?? 'replay at a readable pace'} · {labels.glassRealTime ?? 'actual time'}: <span dir="ltr">{run.latencyMs} ms</span>
            </p>
          )}
          <Pipeline nodes={run?.nodes ?? null} revealed={run ? revealed : 0} labels={labels} />
        </section>
      </div>
    </main>
  );
}

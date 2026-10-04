'use client';

// Station screens: frame -> observe -> connect -> ask -> narrate -> close. Every word on screen is
// an approved library record from the station view; feedback is a record ID chosen by the flow
// state machine. Tap input only: there is no text input anywhere on these screens.

import Link from 'next/link';
import { useEffect, useMemo, useReducer, useState } from 'react';
import { initialState, reducer, type FlowState } from '@/app/_lib/flow';
import type { Labels } from '@/app/_lib/labels';
import type { RecordView, StationView, VerseView } from '@/app/_lib/station-view';
import { NarrationButton, PictureCard, Seedling, VerseCard } from './media';
import { addEvents, markCompleted } from './session';

const now = () => Math.floor(Date.now() / 1000);

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" className="size-10 -scale-x-100" aria-hidden="true"><path d="M5 12h12m-5-6 6 6-6 6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const BulbIcon = () => (
  <svg viewBox="0 0 24 24" className="size-9" aria-hidden="true"><path d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
);
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" className="size-8" aria-hidden="true"><path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z" fill="currentColor" /></svg>
);

function Line({ record, labels, size = 'text-2xl' }: { record: RecordView | null; labels: Labels; size?: string }) {
  if (!record) return null;
  return (
    <div className="flex items-center gap-4" data-line={record.id}>
      <NarrationButton src={record.audio} label={labels.play} />
      <p className={`${size} leading-relaxed`}>{record.text}</p>
    </div>
  );
}

function NextButton({ onClick, label, disabled = false }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} data-action="next"
      className="flex min-h-20 min-w-32 items-center justify-center self-center rounded-full bg-leaf px-10 text-white shadow disabled:opacity-30">
      <ArrowIcon />
    </button>
  );
}

function ParentsToggle({ label, children }: { label?: string; children: React.ReactNode }) {
  if (!label) return null;
  return (
    <details className="self-start rounded-2xl bg-white/70 px-4 py-2" data-parents-toggle>
      <summary className="min-h-16 cursor-pointer py-4 text-base text-muted">{label}</summary>
      <div className="pb-3">{children}</div>
    </details>
  );
}

interface AskReply {
  segments: { kind: 'text' | 'verse'; recordId: string; text: string }[];
  verses: VerseView[];
  event: Record<string, unknown> | null;
}

export default function StationFlow({ view, labels, initial }: { view: StationView; labels: Labels; initial?: FlowState }) {
  const [state, dispatch] = useReducer((s: FlowState, a: Parameters<typeof reducer>[2]) => reducer(view, s, a), initial ?? initialState());
  const [ask, setAsk] = useState<{ id: string; reply: AskReply | null; busy: boolean } | null>(null);
  const byId = useMemo(() => {
    const m = new Map<string, RecordView>();
    const add = (r: RecordView | null | undefined) => { if (r) m.set(r.id, r); };
    view.frame.forEach(add);
    if (view.observe) { add(view.observe.praise); add(view.observe.together); view.observe.hints.forEach(add); Object.values(view.observe.redirects).forEach(add); }
    if (view.narrate) { add(view.narrate.praise); add(view.narrate.retry); }
    return m;
  }, [view]);

  // Flush concept-level events into the on-device session log.
  useEffect(() => {
    if (state.events.length) { addEvents(state.events); dispatch({ type: 'flushed' }); }
  }, [state.events]);

  useEffect(() => {
    if (state.step === 'close') markCompleted(view.stationId);
  }, [state.step, view.stationId]);

  const askQuestion = async (questionId: string) => {
    setAsk({ id: questionId, reply: null, busy: true });
    try {
      const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stationId: view.stationId, questionId }) });
      const reply = (await res.json()) as AskReply;
      if (reply.event) addEvents([reply.event]);
      setAsk({ id: questionId, reply, busy: false });
    } catch {
      setAsk({ id: questionId, reply: null, busy: false });
    }
  };

  const feedback = (id: string | null) => (id ? byId.get(id) ?? null : null);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-8" data-step={state.step} data-station={view.stationId}>
      <header className="flex items-center justify-between gap-4">
        <Link href="/" aria-label={labels.home} className="flex size-16 items-center justify-center rounded-full bg-white text-water shadow-sm"><HomeIcon /></Link>
        {view.title && <h1 className="text-3xl font-bold leading-relaxed">{view.title.text}</h1>}
        <Seedling stage={state.step === 'close' || state.step === 'done' ? view.close.stage : Math.max(view.close.stage - 1, 0)} />
      </header>

      {state.step === 'frame' && (
        <section className="flex flex-col items-center gap-8 text-center" data-screen="frame">
          {view.frame[0] && <NarrationButton src={view.frame[0].audio} label={labels.play} big />}
          {view.frame.map((r) => <p key={r.id} data-line={r.id} className="text-3xl leading-relaxed">{r.text}</p>)}
          <button type="button" onClick={() => dispatch({ type: 'start' })} aria-label={labels.start} data-action="start"
            className="flex min-h-24 min-w-48 items-center justify-center rounded-full bg-leaf px-12 text-white shadow-lg"><ArrowIcon /></button>
        </section>
      )}

      {state.step === 'observe' && view.observe && (
        <section className="flex flex-col gap-6" data-screen="observe">
          <Line record={view.observe.question} labels={labels} size="text-3xl" />
          {view.observe.question.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.observe.question.image} alt="" className="max-h-64 w-full rounded-3xl object-cover" />
          )}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {view.observe.choices.map((c) => (
              <PictureCard key={c.id} record={c}
                state={state.observe.highlightId === c.id ? 'highlight' : state.observe.greyed.includes(c.id) ? 'greyed' : 'idle'}
                onTap={state.observe.solved ? undefined : () => dispatch({ type: 'choose', choiceId: c.id, t: now() })} />
            ))}
          </div>
          <div className="min-h-16" aria-live="polite" data-feedback={state.observe.feedbackId ?? ''}>
            <Line record={feedback(state.observe.feedbackId)} labels={labels} />
          </div>
          <div className="flex items-center justify-between gap-4">
            {!state.observe.solved && (
              <button type="button" onClick={() => dispatch({ type: 'hint', t: now() })} aria-label={labels.hint} data-action="hint"
                disabled={state.observe.hintIndex >= view.observe.hints.length}
                className="flex size-20 items-center justify-center rounded-full bg-sand text-ink shadow-sm disabled:opacity-30"><BulbIcon /></button>
            )}
            {state.observe.solved && <NextButton onClick={() => dispatch({ type: 'next', t: now() })} label={labels.next} />}
          </div>
        </section>
      )}

      {state.step === 'connect' && view.connect && (
        <section className="flex flex-col gap-6" data-screen="connect">
          {view.connect.science.map((r) => <Line key={r.id} record={r} labels={labels} />)}
          <Line record={view.connect.bridge} labels={labels} />
          <Line record={view.connect.listen} labels={labels} />
          {view.connect.verse && <VerseCard verse={view.connect.verse} playLabel={labels.playRecitation} />}
          <Line record={view.connect.explanation} labels={labels} />
          {view.connect.tafsir && (
            <ParentsToggle label={labels.parents}>
              <p dir="rtl" lang="ar" className="text-lg leading-loose" data-tafsir={view.connect.tafsir.id}>{view.connect.tafsir.text}</p>
              <p dir="ltr" className="text-sm text-muted">{view.connect.tafsir.platformId}</p>
            </ParentsToggle>
          )}
          <NextButton onClick={() => dispatch({ type: 'next', t: now() })} label={labels.next} />
        </section>
      )}

      {state.step === 'ask' && (
        <section className="flex flex-col gap-6" data-screen="ask">
          <div className="flex flex-wrap gap-4">
            {view.ask.map((q) => (
              <button key={q.id} type="button" data-question={q.id} onClick={() => askQuestion(q.id)} disabled={ask?.busy}
                className={`min-h-16 rounded-full px-6 py-3 text-2xl shadow-sm ${ask?.id === q.id ? 'bg-water text-white' : 'bg-white'}`}>{q.text}</button>
            ))}
          </div>
          {ask?.reply && (
            <div className="flex flex-col gap-4" aria-live="polite" data-answer={ask.id}>
              {ask.reply.segments.filter((s) => s.kind === 'text').map((s) => <p key={s.recordId} className="text-2xl leading-relaxed" data-line={s.recordId}>{s.text}</p>)}
              {ask.reply.verses.map((v) => <VerseCard key={v.id} verse={v} playLabel={labels.playRecitation} />)}
            </div>
          )}
          <NextButton onClick={() => dispatch({ type: 'next', t: now() })} label={labels.next} />
        </section>
      )}

      {state.step === 'narrate' && view.narrate && (
        <section className="flex flex-col gap-6" data-screen="narrate" data-mode={view.narrate.mode}>
          <Line record={view.narrate.intro} labels={labels} size="text-3xl" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {view.narrate.cards.map((c) => {
              const pos = state.narrate.picked.indexOf(c.id);
              const highlight = state.narrate.done && (view.narrate!.mode === 'order' || c.id === view.narrate!.bestCardId);
              return (
                <PictureCard key={c.id} record={c}
                  state={highlight ? 'highlight' : pos >= 0 ? 'picked' : 'idle'}
                  order={view.narrate!.mode === 'order' && pos >= 0 ? pos + 1 : undefined}
                  onTap={state.narrate.done ? undefined : () => dispatch({ type: 'pick', cardId: c.id, t: now() })} />
              );
            })}
          </div>
          <div className="min-h-16" aria-live="polite" data-feedback={state.narrate.feedbackId ?? ''}>
            <Line record={feedback(state.narrate.feedbackId)} labels={labels} />
          </div>
          {state.narrate.done && <NextButton onClick={() => dispatch({ type: 'next', t: now() })} label={labels.next} />}
        </section>
      )}

      {(state.step === 'close' || state.step === 'done') && (
        <section className="flex flex-col items-center gap-8 text-center" data-screen="close">
          <Seedling stage={view.close.stage} />
          {view.close.lines.map((r) => <Line key={r.id} record={r} labels={labels} size="text-3xl" />)}
          <div className="flex gap-6">
            <Link href="/" aria-label={labels.home} className="flex size-20 items-center justify-center rounded-full bg-white text-water shadow"><HomeIcon /></Link>
            {view.nextStationId && (
              <Link href={`/stations/${view.nextStationId}`} aria-label={labels.nextStation} data-action="next-station"
                className="flex min-h-20 min-w-32 items-center justify-center rounded-full bg-leaf px-10 text-white shadow"><ArrowIcon /></Link>
            )}
          </div>
          {labels.parents && (
            <Link href={`/parent#${view.stationId}`} className="min-h-16 py-4 text-base text-muted underline" data-parents-link>{labels.parents}</Link>
          )}
        </section>
      )}
    </main>
  );
}

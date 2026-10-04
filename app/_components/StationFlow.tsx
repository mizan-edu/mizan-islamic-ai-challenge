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
import { Moment } from './moments';
import { addEvents, markCompleted } from './session';

const now = () => Math.floor(Date.now() / 1000);

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" className="size-9 -scale-x-100" aria-hidden="true"><path d="M5 12h12m-5-6 6 6-6 6" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const BulbIcon = () => (
  <svg viewBox="0 0 24 24" className="size-9" aria-hidden="true"><path d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
);
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" className="size-8" aria-hidden="true"><path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z" fill="currentColor" /></svg>
);

function Line({ record, labels, size = 'text-2xl', big = false }: { record: RecordView | null; labels: Labels; size?: string; big?: boolean }) {
  if (!record) return null;
  return (
    <div className="flex items-center gap-4" data-line={record.id}>
      <NarrationButton src={record.audio} label={labels.play} big={big} />
      <p className={`font-display ${size} leading-relaxed text-ink`}>{record.text}</p>
    </div>
  );
}

// Feedback strip under the choices: praise is leafy, hints are sunny, a redirect after a wrong
// choice is a soft blue strip. Never red, never "wrong".
const STRIP = { praise: 'bg-leaf-soft border-leaf', hint: 'bg-sun-soft border-sun', redirect: 'bg-sky border-water-light', none: '' } as const;
function Strip({ kind, record, labels }: { kind: keyof typeof STRIP; record: RecordView | null; labels: Labels }) {
  if (!record) return null;
  return (
    <div className={`anim-rise rounded-[28px] border-s-8 px-4 py-3 ${STRIP[kind]}`} data-strip={kind} key={record.id}>
      <Line record={record} labels={labels} />
    </div>
  );
}

function NextButton({ onClick, label, disabled = false }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} data-action="next"
      className="pill flex min-h-20 min-w-36 items-center justify-center self-center bg-leaf-dark px-10 text-white disabled:opacity-30">
      <ArrowIcon />
    </button>
  );
}

function ParentsToggle({ label, children }: { label?: string; children: React.ReactNode }) {
  if (!label) return null;
  return (
    <details className="card self-stretch px-5 py-1" data-parents-toggle>
      <summary className="font-display flex min-h-16 cursor-pointer items-center text-lg text-ink-2">{label}</summary>
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
  const o = view.observe;
  const observeKind = (id: string | null): 'praise' | 'hint' | 'redirect' | 'none' => {
    if (!id || !o) return 'none';
    if (id === o.praise?.id) return 'praise';
    if (id === o.together?.id || o.hints.some((h) => h.id === id)) return 'hint';
    return 'redirect';
  };
  const narrateKind = (id: string | null): 'praise' | 'redirect' | 'none' => (!id ? 'none' : id === view.narrate?.praise?.id ? 'praise' : 'redirect');
  const finished = state.step === 'close' || state.step === 'done';
  // S3's moment stays mounted from observe to close so it grows one stage per step.
  const persistentMoment = view.stationId === 'S3' && state.step !== 'frame';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 py-5 sm:px-8" data-step={state.step} data-station={view.stationId}>
      <header className="flex items-center justify-between gap-4">
        <Link href="/" aria-label={labels.home} className="pill flex size-16 shrink-0 items-center justify-center bg-card text-water"><HomeIcon /></Link>
        {view.title && <h1 className="font-display text-center text-2xl leading-snug text-ink md:text-4xl">{view.title.text}</h1>}
        <Seedling stage={finished ? view.close.stage : Math.max(view.close.stage - 1, 0)} className="h-16 w-14 shrink-0 md:h-20 md:w-16" />
      </header>

      {persistentMoment && <Moment stationId={view.stationId} step={state.step} solved={state.observe.solved} />}

      {state.step === 'frame' && (
        <section className="card anim-rise flex flex-col items-center gap-6 px-6 py-8 text-center" data-screen="frame">
          {view.frame[0] && <NarrationButton src={view.frame[0].audio} label={labels.play} big />}
          {view.frame.map((r) => <p key={r.id} data-line={r.id} className="font-display text-3xl leading-relaxed text-ink">{r.text}</p>)}
          <button type="button" onClick={() => dispatch({ type: 'start' })} aria-label={labels.start} data-action="start"
            className="pill font-display flex min-h-20 min-w-48 items-center justify-center gap-3 bg-leaf-dark px-10 text-2xl text-white">
            {labels.start && <span aria-hidden="true">{labels.start}</span>}<ArrowIcon />
          </button>
        </section>
      )}

      {state.step === 'observe' && o && (
        <section className="flex flex-col gap-5" data-screen="observe">
          <div className={`grid items-center gap-5 ${persistentMoment ? '' : 'md:grid-cols-[1fr_minmax(0,18rem)]'}`}>
            <div className="card flex items-center gap-5 p-5">
              <NarrationButton src={o.question.audio} label={labels.play} big />
              <p className="font-display text-3xl leading-relaxed text-ink" data-line={o.question.id}>{o.question.text}</p>
            </div>
            {!persistentMoment && <Moment stationId={view.stationId} step={state.step} solved={state.observe.solved} />}
          </div>
          {o.question.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.question.image} alt="" className="max-h-64 w-full rounded-[28px] object-cover" />
          )}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {o.choices.map((c) => (
              <PictureCard key={c.id} record={c}
                state={state.observe.highlightId === c.id ? 'highlight' : state.observe.greyed.includes(c.id) ? 'greyed' : 'idle'}
                celebrate={state.observe.solved}
                onTap={state.observe.solved ? undefined : () => dispatch({ type: 'choose', choiceId: c.id, t: now() })} />
            ))}
          </div>
          <div className="min-h-16" aria-live="polite" data-feedback={state.observe.feedbackId ?? ''}>
            <Strip kind={observeKind(state.observe.feedbackId)} record={feedback(state.observe.feedbackId)} labels={labels} />
          </div>
          <div className="flex items-center justify-between gap-4">
            {!state.observe.solved && (
              <button type="button" onClick={() => dispatch({ type: 'hint', t: now() })} aria-label={labels.hint} data-action="hint"
                disabled={state.observe.hintIndex >= o.hints.length}
                className="pill flex size-20 items-center justify-center bg-sun text-ink disabled:opacity-40"><BulbIcon /></button>
            )}
            {state.observe.solved && <NextButton onClick={() => dispatch({ type: 'next', t: now() })} label={labels.next} />}
          </div>
        </section>
      )}

      {state.step === 'connect' && view.connect && (
        <section className="flex flex-col gap-6" data-screen="connect">
          {(view.connect.science.length > 0 || view.connect.bridge || view.connect.listen) && (
            <div className="card flex flex-col gap-4 p-5">
              {view.connect.science.map((r) => <Line key={r.id} record={r} labels={labels} />)}
              <Line record={view.connect.bridge} labels={labels} />
              <Line record={view.connect.listen} labels={labels} />
            </div>
          )}
          {view.connect.verse && <VerseCard verse={view.connect.verse} playLabel={labels.playRecitation} label={labels.verseLabel} />}
          {view.connect.explanations.length > 0 && (
            <div className="card flex flex-col gap-4 p-5" data-explanations>
              {view.connect.explanations.map((r) => <Line key={r.id} record={r} labels={labels} />)}
            </div>
          )}
          {view.connect.tafsir && (
            <ParentsToggle label={labels.tafsirToggle ?? labels.parents}>
              <p dir="rtl" lang="ar" className="text-lg leading-loose text-ink" data-tafsir={view.connect.tafsir.id}>{view.connect.tafsir.text}</p>
              <p dir="ltr" className="pb-3 text-sm text-ink-2">{view.connect.tafsir.platformId}</p>
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
                className={`pill font-display min-h-16 px-6 py-3 text-2xl text-ink ${ask?.id === q.id ? 'bg-sky ring-4 ring-water' : 'bg-card'}`}>{q.text}</button>
            ))}
          </div>
          {ask?.reply && (
            <div className="card anim-rise flex flex-col gap-4 p-5" aria-live="polite" data-answer={ask.id}>
              {ask.reply.segments.filter((s) => s.kind === 'text').map((s) => <p key={s.recordId} className="font-display text-2xl leading-relaxed text-ink" data-line={s.recordId}>{s.text}</p>)}
              {ask.reply.verses.map((v) => <VerseCard key={v.id} verse={v} playLabel={labels.playRecitation} label={labels.verseLabel} />)}
            </div>
          )}
          <NextButton onClick={() => dispatch({ type: 'next', t: now() })} label={labels.next} />
        </section>
      )}

      {state.step === 'narrate' && view.narrate && (
        <section className="flex flex-col gap-5" data-screen="narrate" data-mode={view.narrate.mode}>
          <div className="card p-5"><Line record={view.narrate.intro} labels={labels} size="text-3xl" big /></div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {view.narrate.cards.map((c) => {
              const pos = state.narrate.picked.indexOf(c.id);
              const highlight = state.narrate.done && (view.narrate!.mode === 'order' || c.id === view.narrate!.bestCardId);
              return (
                <PictureCard key={c.id} record={c}
                  state={highlight ? 'highlight' : pos >= 0 ? 'picked' : 'idle'}
                  celebrate={state.narrate.done}
                  order={view.narrate!.mode === 'order' && pos >= 0 ? pos + 1 : undefined}
                  onTap={state.narrate.done ? undefined : () => dispatch({ type: 'pick', cardId: c.id, t: now() })} />
              );
            })}
          </div>
          <div className="min-h-16" aria-live="polite" data-feedback={state.narrate.feedbackId ?? ''}>
            <Strip kind={narrateKind(state.narrate.feedbackId)} record={feedback(state.narrate.feedbackId)} labels={labels} />
          </div>
          {state.narrate.done && <NextButton onClick={() => dispatch({ type: 'next', t: now() })} label={labels.next} />}
        </section>
      )}

      {finished && (
        <section className="card flex flex-col items-center gap-6 px-6 py-8 text-center" data-screen="close">
          <Seedling stage={view.close.stage} pop className="h-48 w-40" />
          {view.close.lines.map((r) => <Line key={r.id} record={r} labels={labels} size="text-3xl" />)}
          <div className="flex flex-wrap items-center justify-center gap-5">
            <Link href="/" aria-label={labels.home} className="pill flex size-20 items-center justify-center bg-sky text-water"><HomeIcon /></Link>
            {view.nextStationId && (
              <Link href={`/stations/${view.nextStationId}`} aria-label={labels.nextStation} data-action="next-station"
                className="pill font-display flex min-h-20 items-center gap-3 bg-leaf-dark px-10 text-2xl text-white">
                {labels.nextStation && <span aria-hidden="true">{labels.nextStation}</span>}<ArrowIcon />
              </Link>
            )}
          </div>
          {labels.parents && (
            <Link href={`/parent#${view.stationId}`} className="py-4 text-base text-ink-2 underline" data-parents-link>{labels.parents}</Link>
          )}
        </section>
      )}
    </main>
  );
}

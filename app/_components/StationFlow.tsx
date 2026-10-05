'use client';

// Station screens: frame -> observe -> connect -> ask -> narrate -> close. Every word on screen is
// an approved library record from the station view; feedback is a record ID chosen by the flow
// state machine. Tap input only: there is no text input anywhere on these screens.

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { initialState, reducer, type FlowState } from '@/app/_lib/flow';
import { judgeEnabled } from '@/app/_lib/judge';
import { stepDecisions } from '@/app/_lib/lens';
import type { Labels } from '@/app/_lib/labels';
import type { Trace } from '@/app/_lib/trace';
import type { RecordView, StationView, VerseView } from '@/app/_lib/station-view';
import JudgePanel from './JudgePanel';
import { NarrationButton, PictureCard, PlantMarker, VerseCard } from './media';
import { sfx } from '@/app/_lib/sfx';
import { MOMENT, MomentOverlay, prefersReducedMotion, type MomentPicture } from './moments';
import { addEvents, markCompleted } from './session';

const now = () => Math.floor(Date.now() / 1000);
export const ASK_TIMEOUT_MS = 15000;

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" className="size-9 -scale-x-100" aria-hidden="true"><path d="M5 12h12m-5-6 6 6-6 6" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const BulbIcon = () => (
  <svg viewBox="0 0 24 24" className="size-9" aria-hidden="true"><path d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
);
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" className="size-8" aria-hidden="true"><path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z" fill="currentColor" /></svg>
);

function Line({ record, labels, size = 'text-2xl', big = false, autoPlay = false }: { record: RecordView | null; labels: Labels; size?: string; big?: boolean; autoPlay?: boolean }) {
  if (!record) return null;
  return (
    <div className="flex items-center gap-4" data-line={record.id}>
      <NarrationButton src={record.audio} label={labels.play} big={big} autoPlay={autoPlay} />
      <p className={`font-display ${size} leading-relaxed text-ink`}>{record.text}</p>
    </div>
  );
}

// Feedback strip under the choices: praise is leafy, hints are sunny, a redirect after a wrong
// choice is a soft blue strip. Never red, never "wrong".
const STRIP = { praise: 'bg-leaf-soft border-leaf', hint: 'bg-sun-soft border-sun', redirect: 'bg-sky border-water-light', none: '' } as const;
function Strip({ kind, record, labels, autoPlay = false }: { kind: keyof typeof STRIP; record: RecordView | null; labels: Labels; autoPlay?: boolean }) {
  if (!record) return null;
  return (
    <div className={`anim-rise rounded-[28px] border-s-8 px-4 py-3 ${STRIP[kind]}`} data-strip={kind} key={record.id}>
      <Line record={record} labels={labels} autoPlay={autoPlay} />
    </div>
  );
}

function NextButton({ onClick, label, disabled = false }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={() => { sfx.play('tap'); onClick(); }} disabled={disabled} aria-label={label} data-action="next"
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

// Step progress dots (frame, observe, connect, narrate, close); the ask step shares connect's dot.
const DOTS = ['frame', 'observe', 'connect', 'narrate', 'close'] as const;
const DOT_OF: Record<FlowState['step'], number> = { frame: 0, observe: 1, connect: 2, ask: 2, narrate: 3, close: 4, done: 4 };
function StepDots({ step }: { step: FlowState['step'] }) {
  const at = DOT_OF[step];
  return (
    <ol className="flex items-center justify-center gap-2" aria-hidden="true" data-step-dots={at}>
      {DOTS.map((d, i) => (
        <li key={d} data-dot={d} className={`h-3 rounded-full transition-all duration-200 ${i === at ? 'w-8 bg-water' : i < at ? 'w-3 bg-leaf' : 'w-3 bg-stone'}`} />
      ))}
    </ol>
  );
}

export interface AskReply {
  segments: { kind: 'text' | 'verse'; recordId: string; text: string }[];
  verses: VerseView[];
  event: Record<string, unknown> | null;
  llmEvent?: Record<string, unknown> | null; // A4: secondary provider or static tier answered
  trace?: Trace | null; // judge mode only (A1)
}
export interface AskState { id: string; reply: AskReply | null; busy: boolean }

export default function StationFlow({ view, labels, initial, initialAsk = null, initialJudge = false, sfxCues = [] }: {
  view: StationView; labels: Labels; initial?: FlowState; initialAsk?: AskState | null; initialJudge?: boolean; sfxCues?: readonly string[];
}) {
  const [state, dispatch] = useReducer((s: FlowState, a: Parameters<typeof reducer>[2]) => reducer(view, s, a), initial ?? initialState());
  const [ask, setAsk] = useState<AskState | null>(initialAsk);
  // Judge mode (A1): off unless ?judge=1 or the parent-page switch turned it on for this session.
  const [judge, setJudge] = useState(initialJudge);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (judgeEnabled()) setJudge(true); }, []);
  // Moment sequence (D38): correct tap -> green ring -> after 700 ms the full-screen scene -> back,
  // then the praise line with its narration. momentPending holds the praise back meanwhile.
  const [momentPending, setMomentPending] = useState(false);
  const [moment, setMoment] = useState(false);
  const [praiseAuto, setPraiseAuto] = useState(false);
  const momentTimer = useRef<number | null>(null);
  const endMoment = useCallback(() => { setMoment(false); setMomentPending(false); setPraiseAuto(true); }, []);
  useEffect(() => () => { if (momentTimer.current) window.clearTimeout(momentTimer.current); }, []);
  useEffect(() => { sfx.setAvailable(sfxCues); }, [sfxCues]);
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
    if (state.step === 'close') { markCompleted(view.stationId); sfx.play('close'); }
  }, [state.step, view.stationId]);

  const askQuestion = async (questionId: string) => {
    setAsk({ id: questionId, reply: null, busy: true });
    try {
      // The server's provider chain answers within 14 s; the child never waits more than ASK_TIMEOUT_MS.
      const res = await fetch(judge ? '/api/ask?judge=1' : '/api/ask', { signal: AbortSignal.timeout(ASK_TIMEOUT_MS), method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stationId: view.stationId, questionId }) });
      const reply = (await res.json()) as AskReply;
      addEvents([reply.event, reply.llmEvent].filter((e): e is Record<string, unknown> => Boolean(e)));
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
  // AI lens (D54): the decisions behind the step on screen, in judge mode only.
  const decisions = judge ? stepDecisions(view, state, ask ? { id: ask.id, trace: ask.reply?.trace ?? null } : null) : [];
  // Scene picture beside the prompt: the question's own picture (S2, S3), else the first narration
  // card's picture (S1: S1.N1). Moment pictures: S1 scene = S1.N1; S2 from S2.Q1 to S2.N1.
  const firstCard = view.narrate?.cards[0] ?? null;
  const picture = (r: RecordView | null | undefined): MomentPicture | null =>
    r?.image && r.imageSize ? { src: r.image, width: r.imageSize.width, height: r.imageSize.height } : null;
  const tap = () => sfx.play('tap');
  const choose = (choiceId: string) => {
    dispatch({ type: 'choose', choiceId, t: now() });
    if (!o || state.observe.solved) return;
    if (choiceId !== o.correctChoiceId) { sfx.play('tryAgain'); return; }
    sfx.play('correct');
    if (prefersReducedMotion()) return; // no overlay; the praise shows at once, as before
    setMomentPending(true);
    momentTimer.current = window.setTimeout(() => setMoment(true), MOMENT.delayMs);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 overflow-x-clip px-4 py-5 sm:px-8" data-step={state.step} data-station={view.stationId}>
      <header className="flex items-center justify-between gap-4">
        <Link href="/" aria-label={labels.home} className="pill flex size-16 shrink-0 items-center justify-center bg-card text-water"><HomeIcon /></Link>
        {view.title && <h1 className="font-display text-center text-2xl leading-snug text-ink md:text-4xl">{view.title.text}</h1>}
        <PlantMarker done={finished ? view.close.stage : Math.max(view.close.stage - 1, 0)} className="size-16 shrink-0 md:size-20" />
      </header>

      <StepDots step={state.step} />

      {moment && <MomentOverlay stationId={view.stationId} pictures={{ scene: picture(firstCard), from: picture(o?.question), to: picture(firstCard) }} onDone={endMoment} />}

      {state.step === 'frame' && (
        <section className="card anim-step flex flex-col items-center gap-6 px-6 py-8 text-center" data-screen="frame">
          {view.frame[0] && <NarrationButton src={view.frame[0].audio} label={labels.play} big />}
          {view.frame.map((r) => <p key={r.id} data-line={r.id} className="font-display text-3xl leading-relaxed text-ink">{r.text}</p>)}
          <button type="button" onClick={() => { tap(); dispatch({ type: 'start' }); }} aria-label={labels.start} data-action="start"
            className="pill font-display flex min-h-20 min-w-48 items-center justify-center gap-3 bg-leaf-dark px-10 text-2xl text-white">
            {labels.start && <span aria-hidden="true">{labels.start}</span>}<ArrowIcon />
          </button>
        </section>
      )}

      {state.step === 'observe' && o && (
        <section className="anim-step flex flex-col gap-4" data-screen="observe">
          <div className="flex items-stretch gap-3">
            <div className="card flex flex-1 items-center gap-4 p-4">
              <NarrationButton src={o.question.audio} label={labels.play} big />
              <p className="font-display flex-1 text-2xl leading-relaxed text-ink md:text-3xl" data-line={o.question.id}>{o.question.text}</p>
              {o.question.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.question.image} alt={o.question.text} width={o.question.imageSize?.width} height={o.question.imageSize?.height}
                  className="hidden w-40 shrink-0 rounded-[20px] bg-sky-soft object-contain sm:block md:w-48" data-question-picture
                  style={o.question.imageSize ? { aspectRatio: `${o.question.imageSize.width} / ${o.question.imageSize.height}` } : undefined} />
              ) : firstCard?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={firstCard.image} alt="" width={firstCard.imageSize?.width} height={firstCard.imageSize?.height}
                  className="hidden w-40 shrink-0 rounded-[20px] bg-sky-soft object-contain sm:block md:w-48" data-scene-picture={firstCard.id}
                  style={firstCard.imageSize ? { aspectRatio: `${firstCard.imageSize.width} / ${firstCard.imageSize.height}` } : undefined} />
              ) : null}
            </div>
            <div className="flex shrink-0 items-center">
              {!state.observe.solved ? (
                <button type="button" onClick={() => { tap(); dispatch({ type: 'hint', t: now() }); }} aria-label={labels.hint} data-action="hint"
                  disabled={state.observe.hintIndex >= o.hints.length}
                  className="pill flex size-20 items-center justify-center bg-sun text-ink disabled:opacity-40"><BulbIcon /></button>
              ) : (
                <NextButton onClick={() => dispatch({ type: 'next', t: now() })} label={labels.next} />
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {o.choices.map((c, i) => (
              <PictureCard key={c.id} record={c} index={i}
                state={state.observe.highlightId === c.id ? 'highlight' : state.observe.greyed.includes(c.id) ? 'greyed' : 'idle'}
                celebrate={state.observe.solved}
                onTap={state.observe.solved ? undefined : () => choose(c.id)} />
            ))}
          </div>
          <div className="min-h-16" aria-live="polite" data-feedback={state.observe.feedbackId ?? ''}>
            {!momentPending && <Strip kind={observeKind(state.observe.feedbackId)} record={feedback(state.observe.feedbackId)} labels={labels} autoPlay={praiseAuto && observeKind(state.observe.feedbackId) === 'praise'} />}
          </div>
        </section>
      )}

      {state.step === 'connect' && view.connect && (
        // No step animation here: nothing moves on or near the verse.
        <section className="flex flex-col gap-6" data-screen="connect">
          {(view.connect.science.length > 0 || view.connect.bridge || view.connect.listen) && (
            <div className="card flex flex-col gap-4 p-5">
              {view.connect.science.map((r) => <Line key={r.id} record={r} labels={labels} />)}
              <Line record={view.connect.bridge} labels={labels} />
              <Line record={view.connect.listen} labels={labels} />
            </div>
          )}
          {view.connect.verse && <VerseCard verse={view.connect.verse} playLabel={labels.playRecitation} label={labels.verseLabel} surahLabel={labels.surah} ayahLabel={labels.ayah} />}
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
        <section className="anim-step flex flex-col gap-6" data-screen="ask">
          <div className="flex flex-wrap gap-4">
            {view.ask.map((q) => (
              <button key={q.id} type="button" data-question={q.id} onClick={() => { tap(); void askQuestion(q.id); }} disabled={ask?.busy}
                className={`pill font-display min-h-16 px-6 py-3 text-2xl text-ink ${ask?.id === q.id ? 'bg-sky ring-4 ring-water' : 'bg-card'}`}>{q.text}</button>
            ))}
          </div>
          {ask?.reply && (
            <div className={`card flex flex-col gap-4 p-5 ${ask.reply.verses.length ? '' : 'anim-rise'}`} aria-live="polite" data-answer={ask.id}>
              {ask.reply.segments.filter((s) => s.kind === 'text').map((s) => <p key={s.recordId} className="font-display text-2xl leading-relaxed text-ink" data-line={s.recordId}>{s.text}</p>)}
              {ask.reply.verses.map((v) => <VerseCard key={v.id} verse={v} playLabel={labels.playRecitation} label={labels.verseLabel} surahLabel={labels.surah} ayahLabel={labels.ayah} />)}
            </div>
          )}
          <NextButton onClick={() => dispatch({ type: 'next', t: now() })} label={labels.next} />
          {/* Judge panel: below the controls, away from the reply and any verse card in it. */}
          {judge && <JudgePanel decisions={decisions} trace={ask?.reply?.trace ?? null} labels={labels} />}
        </section>
      )}

      {state.step === 'narrate' && view.narrate && (
        <section className="anim-step flex flex-col gap-5" data-screen="narrate" data-mode={view.narrate.mode}>
          <div className="card p-5"><Line record={view.narrate.intro} labels={labels} size="text-3xl" big /></div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {view.narrate.cards.map((c, i) => {
              const pos = state.narrate.picked.indexOf(c.id);
              const highlight = state.narrate.done && (view.narrate!.mode === 'order' || c.id === view.narrate!.bestCardId);
              return (
                <PictureCard key={c.id} record={c} index={i}
                  state={highlight ? 'highlight' : pos >= 0 ? 'picked' : 'idle'}
                  celebrate={state.narrate.done}
                  order={view.narrate!.mode === 'order' && pos >= 0 ? pos + 1 : undefined}
                  onTap={state.narrate.done ? undefined : () => { tap(); dispatch({ type: 'pick', cardId: c.id, t: now() }); }} />
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
        <section className="card anim-step flex flex-col items-center gap-6 px-6 py-8 text-center" data-screen="close">
          <PlantMarker done={view.close.stage} grow className="size-56 md:size-64" />
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

      {/* AI lens on every other step (D54): after the step's section and its controls; on the connect
          step that puts it below the Next button, away from the verse card. */}
      {judge && state.step !== 'ask' && <JudgePanel decisions={decisions} labels={labels} />}
    </main>
  );
}

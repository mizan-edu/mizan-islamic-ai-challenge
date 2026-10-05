'use client';

// Static story mode (D47, pilot control condition). One big play button, then the station's approved
// script plays in order with no interaction: each step plays its pre-rendered narration and waits
// STEP_GAP_MS after it ends; the answer step shows the green ring, the moment, then the praise line; the
// verse step plays the real recitation (never a synthetic voice; no effects while it plays). No
// choices, hints or questions; no progress saved; the only event is the existing verse_shown.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Labels } from '@/app/_lib/labels';
import { sfx } from '@/app/_lib/sfx';
import type { RecordView, StationView } from '@/app/_lib/station-view';
import { stepKey, type StoryStep } from '@/app/_lib/story';
import { VerseCard } from './media';
import type { VideoSources } from '@/app/_lib/media';
import { MOMENT, MomentOverlay, type MomentPicture } from './moments';
import { addEvents } from './session';

export const STEP_GAP_MS = 1000; // after each step's audio ends
export const NO_AUDIO_MS = 3000; // a step whose audio is missing or cannot play

const picture = (r: RecordView | null | undefined): MomentPicture | null =>
  r?.image && r.imageSize ? { src: r.image, width: r.imageSize.width, height: r.imageSize.height } : null;

function Picture({ record, ring = false }: { record: RecordView; ring?: boolean }) {
  if (!record.image) return null;
  return (
    <figure className={`mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-[28px] bg-card p-4 ${ring ? 'ring-8 ring-leaf anim-correct' : ''}`} data-story-picture={record.id}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={record.image} alt={record.text} width={record.imageSize?.width} height={record.imageSize?.height}
        className="w-full rounded-[20px] bg-sky-soft object-contain" style={record.imageSize ? { aspectRatio: `${record.imageSize.width} / ${record.imageSize.height}` } : undefined} />
    </figure>
  );
}

const Line = ({ record }: { record: RecordView | null }) =>
  record ? <p className="font-display text-center text-3xl leading-relaxed text-ink" data-line={record.id}>{record.text}</p> : null;

export default function StoryPlayer({ view, steps, labels, sfxCues = [], initialIndex = -1, video = null }: {
  view: StationView; steps: StoryStep[]; labels: Labels; sfxCues?: readonly string[]; initialIndex?: number; video?: VideoSources | null;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [phase, setPhase] = useState<'ring' | 'moment' | 'praise'>('ring'); // answer step only
  const audio = useRef<HTMLAudioElement>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => { sfx.setAvailable(sfxCues); sfx.install(); }, [sfxCues]);

  const after = useCallback((ms: number, fn: () => void) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, ms);
  }, []);
  const next = useCallback(() => { setPhase('ring'); setIndex((i) => i + 1); }, []);
  const speak = useCallback((src: string | null) => {
    const a = audio.current;
    if (!src || !a) { after(NO_AUDIO_MS, next); return; }
    a.src = src;
    void a.play().catch(() => after(NO_AUDIO_MS, next));
  }, [after, next]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); audio.current?.pause(); }, []);

  const step = index >= 0 && index < steps.length ? steps[index] : null;
  // D65 hard mute, as in the stations: no effect on the verse step; whatever plays stops when it starts.
  useEffect(() => { sfx.setVerseStep(step?.kind === 'verse'); }, [step]);
  useEffect(() => () => sfx.setVerseStep(false), []);
  useEffect(() => {
    if (!step) return;
    if (step.kind === 'verse') {
      addEvents([{ stationId: view.stationId, event: 'verse_shown', level: 'A', sourceIds: [step.verse.id], t: Math.floor(Date.now() / 1000), ...(view.connect?.conceptId ? { conceptId: view.connect.conceptId } : {}) }]);
      return; // VerseCard plays the recitation and calls onDone
    }
    if (step.kind === 'answer') {
      if (phase === 'ring') {
        sfx.play('correct');
        // Reduced motion too: the moment shows as the still picture with an opacity fade (Phase 1c).
        after(MOMENT.delayMs, () => setPhase('moment'));
      } else if (phase === 'praise') speak(step.praise?.audio ?? null);
      return;
    }
    speak(step.record.audio);
  }, [step, phase, view, after, speak]);

  const key = index < 0 ? 'start' : step ? stepKey(step) : 'done';
  const firstCard = view.narrate?.cards[0] ?? null;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 overflow-x-clip px-4 py-6 sm:px-8" data-screen="story" data-story-step={key} data-story-index={index}>
      <header className="flex items-center justify-between gap-4">
        {view.title && <h1 className="font-display text-3xl text-ink">{view.title.text}</h1>}
        <Link href="/" aria-label={labels.home} className="pill flex size-16 shrink-0 items-center justify-center bg-card text-water">
          <svg viewBox="0 0 24 24" className="size-8" aria-hidden="true"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" fill="currentColor" /></svg>
        </Link>
      </header>

      {index < 0 && (
        <div className="flex flex-1 items-center justify-center">
          <button type="button" aria-label={labels.play} data-story-start onClick={() => { sfx.play('tap'); setIndex(0); }}
            className="pill flex size-40 items-center justify-center bg-leaf-dark text-white">
            <svg viewBox="0 0 24 24" className="size-20" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
          </button>
        </div>
      )}

      {step && (step.kind === 'frame' || step.kind === 'explanation' || step.kind === 'close') && (
        <section className="card flex flex-col gap-6 p-6"><Picture record={step.record} /><Line record={step.record} /></section>
      )}
      {step?.kind === 'question' && (
        <section className="card flex flex-col gap-6 p-6">{step.picture && <Picture record={step.picture} />}<Line record={step.record} /></section>
      )}
      {step?.kind === 'answer' && (
        <section className="card flex flex-col gap-6 p-6">
          <Picture record={step.choice} ring />
          {phase === 'praise' && <Line record={step.praise} />}
          {phase === 'moment' && (
            <MomentOverlay stationId={view.stationId} pictures={{ scene: picture(firstCard), from: picture(view.observe?.question), to: picture(firstCard) }} onDone={() => setPhase('praise')} video={video} />
          )}
        </section>
      )}
      {step?.kind === 'card' && (
        <section className="card flex flex-col gap-6 p-6"><Picture record={step.record} /><Line record={step.record} /></section>
      )}
      {step?.kind === 'verse' && (
        <VerseCard key={step.verse.id} verse={step.verse} playLabel={labels.playRecitation} label={labels.verseLabel} surahLabel={labels.surah} ayahLabel={labels.ayah}
          autoPlay onDone={() => after(STEP_GAP_MS, next)} />
      )}
      {index >= steps.length && steps.length > 0 && steps[steps.length - 1].kind === 'close' && (
        <section className="card flex flex-col gap-6 p-6" data-story-done><Line record={(steps[steps.length - 1] as { record: RecordView }).record} /></section>
      )}

      {/* Narration for every non-verse step; never used for the verse (real recitation only). */}
      <audio ref={audio} preload="auto" onPlay={() => sfx.narrationStarted()} onPause={() => sfx.narrationStopped()}
        onEnded={() => { sfx.narrationStopped(); after(STEP_GAP_MS, next); }} data-story-audio />
    </main>
  );
}

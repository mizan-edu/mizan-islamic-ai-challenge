'use client';

// Narration button, picture card, verse card, seedling. No browser TTS anywhere: narration plays
// pre-rendered files only; verses play the real mp3quran recitation (R4).

import { useRef, useState } from 'react';
import type { RecordView, VerseView } from '@/app/_lib/station-view';

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className="size-8" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
);

// Plays /audio/<station>/<id>.mp3 when it exists; otherwise the button is shown disabled.
export function NarrationButton({ src, label, big = false }: { src: string | null; label?: string; big?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const size = big ? 'size-24' : 'size-16';
  return (
    <>
      <button
        type="button"
        disabled={!src}
        aria-label={label}
        data-narration={src ? 'available' : 'missing'}
        onClick={() => { const a = ref.current; if (a) { a.currentTime = 0; void a.play(); } }}
        className={`flex ${size} shrink-0 items-center justify-center rounded-full ${src ? 'bg-water text-white shadow' : 'bg-muted/25 text-muted'} `}
      >
        <PlayIcon />
      </button>
      {src && <audio ref={ref} src={src} preload="none" />}
    </>
  );
}

// A picture choice or narration card. Missing picture: a neutral placeholder showing the record's text.
export function PictureCard({ record, state, onTap, order }: {
  record: RecordView;
  state: 'idle' | 'greyed' | 'highlight' | 'picked';
  onTap?: () => void;
  order?: number;
}) {
  const ring = state === 'highlight' ? 'ring-8 ring-leaf/70' : state === 'picked' ? 'ring-8 ring-water/60' : '';
  const dim = state === 'greyed' ? 'opacity-40 grayscale' : '';
  return (
    <button
      type="button"
      data-record={record.id}
      data-state={state}
      disabled={state === 'greyed' || !onTap}
      onClick={onTap}
      className={`relative flex min-h-48 flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl bg-white p-4 text-center shadow-sm transition ${ring} ${dim}`}
    >
      {record.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={record.image} alt="" className="h-36 w-full rounded-2xl object-cover" />
      ) : (
        <span data-placeholder="picture" className="flex h-36 w-full items-center justify-center rounded-2xl bg-sand/50 px-3 text-2xl leading-relaxed">{record.text}</span>
      )}
      {record.image && <span className="text-xl leading-relaxed">{record.text}</span>}
      {order !== undefined && <span className="absolute start-3 top-3 flex size-10 items-center justify-center rounded-full bg-water text-xl font-bold text-white">{order}</span>}
    </button>
  );
}

// Verse card: stored text in the KFC font, the reference, and the real recitation limited to the ayah.
export function VerseCard({ verse, playLabel }: { verse: VerseView; playLabel?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const rc = verse.recitation;

  const play = () => {
    const a = ref.current;
    if (!a || !rc) return;
    const start = rc.startMs / 1000;
    // The tap itself starts playback (required on iPad/Android); seek as soon as metadata is known.
    if (a.readyState >= 1) a.currentTime = start;
    else a.addEventListener('loadedmetadata', () => { a.currentTime = start; }, { once: true });
    void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };
  const onTime = () => {
    const a = ref.current;
    if (a && rc && a.currentTime >= rc.endMs / 1000) { a.pause(); setPlaying(false); }
  };

  return (
    <figure data-verse={verse.id} className="flex flex-col gap-4 rounded-3xl border-2 border-sand bg-white p-6 shadow-sm">
      <blockquote dir="rtl" lang="ar" className="font-quran text-4xl leading-[2.2] md:text-5xl" data-verse-text>{verse.text}</blockquote>
      <figcaption className="flex items-center justify-between gap-4">
        <span dir="ltr" className="text-xl text-muted" data-reference>{verse.reference}</span>
        {rc && (
          <button type="button" aria-label={playLabel} onClick={play} data-recitation={rc.audioUrl}
            className={`flex size-16 items-center justify-center rounded-full text-white shadow ${playing ? 'bg-leaf' : 'bg-water'}`}>
            <PlayIcon />
          </button>
        )}
      </figcaption>
      {rc && <audio ref={ref} src={rc.src} preload="none" onTimeUpdate={onTime} onPause={() => setPlaying(false)} />}
    </figure>
  );
}

// Seedling progress marker: one leaf pair per completed stage (no text).
export function Seedling({ stage }: { stage: number }) {
  const leaves = Math.max(0, Math.min(stage, 3));
  return (
    <svg viewBox="0 0 120 140" className="h-36 w-32" aria-hidden="true" data-seedling={leaves}>
      <path d="M20 125 h80" stroke="#8a6d3b" strokeWidth="8" strokeLinecap="round" />
      <path d="M60 122 V60" stroke="#3f8a4f" strokeWidth="6" strokeLinecap="round" />
      {Array.from({ length: leaves }).map((_, i) => (
        <g key={i} transform={`translate(0 ${-i * 22})`}>
          <path d="M60 100 C40 95 32 80 34 70 C48 72 58 82 60 100" fill="#3f8a4f" />
          <path d="M60 100 C80 95 88 80 86 70 C72 72 62 82 60 100" fill="#5aa86a" />
        </g>
      ))}
    </svg>
  );
}

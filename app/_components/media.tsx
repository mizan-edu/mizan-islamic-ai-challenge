'use client';

// Narration button, picture card, verse card, seedling pot («حديقة الآيات» design). No browser TTS
// anywhere: narration plays pre-rendered files only; verses play the real mp3quran recitation (R4).
// Decoration is nature only (no faces or characters) and every animation is CSS, switched off by
// prefers-reduced-motion (globals.css).

import { useRef, useState } from 'react';
import type { RecordView, VerseView } from '@/app/_lib/station-view';

const SpeakerIcon = ({ className = 'size-8' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);
const PlayIcon = ({ className = 'size-10' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
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
        className={`pill flex ${size} shrink-0 items-center justify-center ${src ? 'bg-water text-white' : 'bg-sky text-ink-2/60 shadow-none'}`}
      >
        <SpeakerIcon className={big ? 'size-12' : 'size-8'} />
      </button>
      {src && <audio ref={ref} src={src} preload="none" />}
    </>
  );
}

// Leaf and droplet burst around a correct card (decorative).
const BURST: { x: number; y: number; kind: 'leaf' | 'drop'; d: number }[] = [
  { x: -110, y: -70, kind: 'leaf', d: 0 }, { x: 110, y: -80, kind: 'drop', d: 40 }, { x: -130, y: 20, kind: 'drop', d: 80 },
  { x: 130, y: 10, kind: 'leaf', d: 20 }, { x: -60, y: -120, kind: 'drop', d: 60 }, { x: 70, y: -120, kind: 'leaf', d: 100 },
  { x: -90, y: 90, kind: 'leaf', d: 30 }, { x: 95, y: 85, kind: 'drop', d: 70 },
];

function Burst() {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true" data-burst>
      {BURST.map((p, i) => (
        <span key={i} className="anim-burst absolute" style={{ '--bx': `${p.x}px`, '--by': `${p.y}px`, animationDelay: `${p.d}ms` } as React.CSSProperties}>
          {p.kind === 'leaf' ? (
            <svg viewBox="0 0 24 24" className="size-8"><path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16z" fill="#3BA55C" /><path d="M4 20 15 9" stroke="#1F6B3A" strokeWidth="1.5" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-7"><path d="M12 3c4 5.5 6 8.8 6 11.5a6 6 0 0 1-12 0C6 11.8 8 8.5 12 3z" fill="#4FA3DD" /></svg>
          )}
        </span>
      ))}
    </span>
  );
}

// A picture choice or narration card. Missing picture: a soft panel showing the record's text.
// highlight + celebrate = the child's correct answer (green ring and burst); highlight alone = the
// last hint pointing at the right card (soft yellow glow). Wrong choices grey out; never red.
// Pictures are never cropped (object-contain): choices share one square frame and narration cards
// one 4:3 frame (a wider picture such as the S3.N2 strip is letterboxed inside it), so no card's
// frame or size hints at the answer; question pictures keep their own aspect ratio.
export function PictureCard({ record, state, onTap, order, celebrate = false }: {
  record: RecordView;
  state: 'idle' | 'greyed' | 'highlight' | 'picked';
  onTap?: () => void;
  order?: number;
  celebrate?: boolean;
}) {
  const size = record.imageSize;
  const frame = record.role === 'choice' ? 'square' : record.role === 'narration_card' ? 'card' : 'natural';
  const look = state === 'highlight'
    ? (celebrate ? 'ring-8 ring-leaf' : 'ring-4 ring-sun anim-glow')
    : state === 'picked' ? 'ring-8 ring-water-light'
      : state === 'greyed' ? 'opacity-45 grayscale shadow-none' : '';
  return (
    <button
      type="button"
      data-record={record.id}
      data-state={state}
      disabled={state === 'greyed' || !onTap}
      onClick={onTap}
      className={`press relative flex min-h-56 flex-col items-center justify-center gap-3 rounded-[28px] bg-card p-4 text-center ${look}`}
    >
      {record.image ? (
        <span className={`flex w-full items-center justify-center overflow-hidden rounded-[20px] bg-sky-soft ${frame === 'square' ? 'mx-auto aspect-square max-w-56' : frame === 'card' ? 'aspect-[4/3]' : ''}`}
          style={frame !== 'natural' || !size ? undefined : { aspectRatio: `${size.width} / ${size.height}` }} data-picture-frame={frame}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={record.image} alt={record.text} width={size?.width} height={size?.height} className="size-full object-contain" />
        </span>
      ) : (
        <span data-placeholder="picture" className="font-display flex h-40 w-full items-center justify-center rounded-[20px] bg-sky-soft px-3 text-2xl leading-relaxed text-ink">{record.text}</span>
      )}
      {record.image && <span aria-hidden="true" className="font-display text-xl leading-relaxed text-ink">{record.text}</span>}
      {order !== undefined && <span className="font-display absolute start-3 top-3 flex size-11 items-center justify-center rounded-full bg-sun text-xl text-ink">{order}</span>}
      {state === 'highlight' && celebrate && <Burst />}
    </button>
  );
}

// Eight-point star (two overlapping squares), gold, for the verse card corners.
const Star = ({ className }: { className: string }) => (
  <svg viewBox="0 0 24 24" className={`absolute size-6 ${className}`} aria-hidden="true">
    <rect x="5" y="5" width="14" height="14" fill="none" stroke="#C9A44C" strokeWidth="1.4" />
    <rect x="5" y="5" width="14" height="14" fill="none" stroke="#C9A44C" strokeWidth="1.4" transform="rotate(45 12 12)" />
    <circle cx="12" cy="12" r="2" fill="#C9A44C" />
  </svg>
);

// Verse card: calm and still. Stored text in the KFC font (never animated), the reference, and the
// real recitation limited to the ayah. Only the recitation button moves, and only while playing.
export function VerseCard({ verse, playLabel, label }: { verse: VerseView; playLabel?: string; label?: string }) {
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
    <figure data-verse={verse.id} className="card flex flex-col gap-5 border border-gold p-3">
      <div className="relative flex flex-col gap-4 rounded-[24px] border border-gold/60 px-6 py-8 md:px-12">
        <Star className="start-2 top-2" /><Star className="end-2 top-2" /><Star className="bottom-2 start-2" /><Star className="bottom-2 end-2" />
        {label && <p className="font-display text-center text-xl text-ink-2" data-verse-label>{label}</p>}
        <blockquote dir="rtl" lang="ar" className="font-quran text-center text-4xl leading-[2.2] text-ink md:text-5xl" data-verse-text>{verse.text}</blockquote>
        <p dir="ltr" className="text-center text-lg text-ink-2" data-reference>{verse.reference}</p>
      </div>
      {rc && (
        <figcaption className="flex justify-center pb-3">
          <span className="relative flex size-28 items-center justify-center">
            {playing && (
              <svg viewBox="0 0 112 112" className="anim-spin absolute inset-0 size-28" aria-hidden="true" data-recitation-ring>
                <circle cx="56" cy="56" r="52" fill="none" stroke="#C9A44C" strokeWidth="3" strokeDasharray="10 8" strokeLinecap="round" />
              </svg>
            )}
            <button type="button" aria-label={playLabel} onClick={play} data-recitation={rc.audioUrl} data-playing={playing}
              className="pill flex size-24 items-center justify-center bg-leaf-dark text-white">
              <PlayIcon className="size-12" />
            </button>
          </span>
        </figcaption>
      )}
      {rc && <audio ref={ref} src={rc.src} preload="none" onTimeUpdate={onTime} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />}
    </figure>
  );
}

// Seedling in a pot: one leaf per completed stage (max 3, no text). `pop` animates the newest leaf.
const LEAVES = [
  'M60 92 C44 90 36 80 37 70 C50 71 58 80 60 92',
  'M60 76 C76 74 85 63 83 52 C70 54 62 63 60 76',
  'M60 60 C45 57 38 47 40 37 C52 39 59 48 60 60',
];
export function Seedling({ stage, pop = false, className = 'h-28 w-24' }: { stage: number; pop?: boolean; className?: string }) {
  const leaves = Math.max(0, Math.min(stage, 3));
  const top = [104, 90, 74, 58][leaves];
  return (
    <svg viewBox="0 0 120 150" className={className} aria-hidden="true" data-seedling={leaves}>
      <path d={`M60 112 V${top}`} stroke="#1F6B3A" strokeWidth="5" strokeLinecap="round" />
      {LEAVES.slice(0, leaves).map((d, i) => (
        <path key={i} d={d} fill={i % 2 ? '#3BA55C' : '#2E8F4C'} className={pop && i === leaves - 1 ? 'anim-pop' : undefined} />
      ))}
      <path d="M28 108 h64 l-8 36 h-48 z" fill="#C97B4A" />
      <rect x="22" y="100" width="76" height="14" rx="5" fill="#B4693B" />
      <ellipse cx="60" cy="102" rx="30" ry="4" fill="#6B4226" />
    </svg>
  );
}

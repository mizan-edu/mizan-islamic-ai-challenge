'use client';

// Narration button, picture card, verse card, seedling pot («حديقة الآيات» design). No browser TTS
// anywhere: narration plays pre-rendered files only; verses play the real mp3quran recitation (R4).
// Decoration is nature only (no faces or characters) and every animation is CSS, switched off by
// prefers-reduced-motion (globals.css).

import { useEffect, useRef, useState } from 'react';
import { sfx } from '@/app/_lib/sfx';
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

// While narration plays, <html data-narrating> pauses the idle float of the cards (Phase 1b).
const narrating = (on: boolean) => { try { document.documentElement.toggleAttribute('data-narrating', on); } catch { /* no DOM */ } };

// Plays /audio/<station>/<id>.mp3 when it exists; otherwise the button is shown disabled. While it
// plays, sound effects are lowered (D38). autoPlay: play once on mount (the praise after a moment).
export function NarrationButton({ src, label, big = false, autoPlay = false }: { src: string | null; label?: string; big?: boolean; autoPlay?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const size = big ? 'size-24' : 'size-16';
  useEffect(() => {
    const a = ref.current;
    if (autoPlay && a) { a.currentTime = 0; void a.play().catch(() => { /* autoplay refused: the button still works */ }); }
  }, [autoPlay]);
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
      {src && <audio ref={ref} src={src} preload={autoPlay ? 'auto' : 'none'} onPlay={() => { sfx.narrationStarted(); narrating(true); }} onPause={() => { sfx.narrationStopped(); narrating(false); }} />}
    </>
  );
}

// Particles (Phase 1b): 12 abstract shapes burst outward from the centre and fade. Raindrops for
// Station 1, round water droplets for Station 2, small leaves for Station 3 and the close moment.
// Shapes only: no figures, no text. Fixed layout (no randomness). Transform and opacity only.
export type ParticleKind = 'rain' | 'drop' | 'leaf';
export const PARTICLE_COUNT = 12;
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + ((i * 7) % 5) * 0.06;
  const dist = 105 + ((i * 37) % 45);
  return { x: Math.round(Math.cos(angle) * dist), y: Math.round(Math.sin(angle) * dist * 0.85), r: (i * 47) % 360, d: (i * 23) % 90 };
});
const SHAPE: Record<ParticleKind, React.ReactNode> = {
  rain: <svg viewBox="0 0 12 18" className="h-6 w-4"><path d="M6 0c3 5 6 9 6 12a6 6 0 0 1-12 0C0 9 3 5 6 0z" className="fill-water-light" /></svg>,
  drop: <svg viewBox="0 0 24 24" className="size-5"><path d="M12 3c4 5.5 6 8.8 6 11.5a6 6 0 0 1-12 0C6 11.8 8 8.5 12 3z" className="fill-water" /></svg>,
  leaf: <svg viewBox="0 0 24 24" className="size-6"><path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16z" className="fill-leaf" /><path d="M4 20 15 9" className="stroke-leaf-dark" strokeWidth="1.5" /></svg>,
};

export function Particles({ kind, delayMs = 150 }: { kind: ParticleKind; delayMs?: number }) {
  return (
    <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" aria-hidden="true" data-particles={kind}>
      {PARTICLES.map((p, i) => (
        <span key={i} className="particle absolute"
          style={{ '--px': `${p.x}px`, '--py': `${p.y}px`, '--pr': `${p.r}deg`, animationDelay: `${delayMs + p.d}ms` } as React.CSSProperties}>
          {SHAPE[kind]}
        </span>
      ))}
    </span>
  );
}

// Tilt toward the touch point (Phase 1b): the pointer position sets --rx / --ry (at most `max`
// degrees); globals.css applies them while the card is pressed, and the card springs back on release.
function tiltTo(e: React.PointerEvent<HTMLElement>, max: number) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const x = Math.min(Math.max((e.clientX - r.left) / r.width - 0.5, -0.5), 0.5);
  const y = Math.min(Math.max((e.clientY - r.top) / r.height - 0.5, -0.5), 0.5);
  el.style.setProperty('--rx', `${(-y * 2 * max).toFixed(2)}deg`); // pressing the top edge tips it away
  el.style.setProperty('--ry', `${(x * 2 * max).toFixed(2)}deg`);
}
function untilt(e: React.PointerEvent<HTMLElement>) {
  e.currentTarget.style.setProperty('--rx', '0deg');
  e.currentTarget.style.setProperty('--ry', '0deg');
}

// A picture choice or narration card. Missing picture: a soft panel showing the record's text.
// highlight + celebrate = the child's correct answer (the hero moment); highlight alone = the last
// hint pointing at the right card (soft yellow glow). Wrong choices grey out; never red.
// Pictures are never cropped (object-contain): choices share one square frame and narration cards
// one 4:3 frame (a wider picture such as the S3.N2 strip is letterboxed inside it), so no card's
// frame or size hints at the answer; question pictures keep their own aspect ratio.
// Motion (D54, Phase 1b; transform and opacity only, globals.css):
// - entrance: `index` makes the card rise in turn (DOM order = right to left in the RTL grid);
// - press: a choice tilts toward the finger (up to 6 degrees), presses to 0.96 and lowers its
//   shadow; a narration card lifts instead (3 degrees, deeper shadow); both spring back on release;
// - idle: an unchosen card's picture and label float by 2 px inside it (paused while narration
//   plays or a finger is down); the card itself, the tap target, never moves while waiting for a tap;
// - set aside: the card dips with a slight 3D turn and springs back, then greys;
// - hero (correct): the others recede, this card lifts with a 3D settle, a ring pulses once, a sheen
//   sweeps once and `particles` burst; `heroDelayMs` staggers several heroes (narration order);
// - placed narration card: springs into place, and its order number lands with a small pop.
export function PictureCard({ record, state, onTap, order, celebrate = false, index, particles, heroDelayMs = 0 }: {
  record: RecordView;
  state: 'idle' | 'greyed' | 'highlight' | 'picked';
  onTap?: () => void;
  order?: number;
  celebrate?: boolean;
  index?: number;
  particles?: ParticleKind;
  heroDelayMs?: number;
}) {
  const size = record.imageSize;
  const frame = record.role === 'choice' ? 'square' : record.role === 'narration_card' ? 'card' : 'natural';
  const narration = record.role === 'narration_card';
  const hero = state === 'highlight' && celebrate;
  const entered = index !== undefined ? 'anim-card-in' : '';
  const look = hero ? 'ring-8 ring-leaf anim-hero'
    : state === 'highlight' ? 'ring-4 ring-sun'
      : state === 'greyed' ? `opacity-45 grayscale shadow-none ${celebrate ? 'anim-recede' : 'anim-settle'}`
        : celebrate ? 'anim-recede'
          : state === 'picked' ? `ring-8 ring-water-light ${entered} anim-place`
            : entered;
  const floating = state === 'idle' && !celebrate && Boolean(onTap);
  return (
    <div className="stage-3d grid" style={index !== undefined ? ({ '--i': index } as React.CSSProperties) : undefined} data-card-wrap={state}>
      <button
        type="button"
        data-record={record.id}
        data-state={state}
        disabled={state === 'greyed' || !onTap}
        onClick={onTap}
        onPointerDown={onTap ? (e) => { tiltTo(e, narration ? 3 : 6); sfx.play('tap'); } : undefined}
        onPointerUp={untilt}
        onPointerCancel={untilt}
        onPointerLeave={untilt}
        className={`tactile ${narration ? 'tactile-lift' : ''} flex min-h-56 flex-col items-center justify-center gap-3 rounded-[28px] bg-card p-4 text-center ${look}`}
        style={hero && heroDelayMs ? ({ '--hd': `${heroDelayMs}ms` } as React.CSSProperties) : undefined}
      >
        <span className="elev" aria-hidden="true" />
        <span className="elev-lift" aria-hidden="true" />
        <span className={`flex w-full flex-col items-center gap-3 ${floating ? 'anim-float' : ''}`} data-card-face>
          {record.image ? (
            <span className={`flex w-full items-center justify-center overflow-hidden rounded-[20px] bg-sky-soft ${frame === 'square' ? 'mx-auto aspect-square max-w-[min(18rem,34dvh)]' : frame === 'card' ? 'aspect-[4/3]' : ''}`}
              style={frame !== 'natural' || !size ? undefined : { aspectRatio: `${size.width} / ${size.height}` }} data-picture-frame={frame}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={record.image} alt={record.text} width={size?.width} height={size?.height} className="size-full object-contain" />
            </span>
          ) : (
            <span data-placeholder="picture" className="font-display flex h-40 w-full items-center justify-center rounded-[20px] bg-sky-soft px-3 text-2xl leading-relaxed text-ink">{record.text}</span>
          )}
          {record.image && <span aria-hidden="true" className="font-display text-xl leading-relaxed text-ink">{record.text}</span>}
        </span>
        {order !== undefined && <span key={order} className="anim-badge font-display absolute start-3 top-3 flex size-11 items-center justify-center rounded-full bg-sun text-xl text-ink" data-order={order}>{order}</span>}
        {state === 'highlight' && !celebrate && <span className="hint-glow" aria-hidden="true" />}
        {hero && (
          <>
            <span className="hero-ring" aria-hidden="true" data-hero-ring />
            <span className="sheen" aria-hidden="true" data-sheen />
            {particles && <Particles kind={particles} delayMs={150 + heroDelayMs} />}
          </>
        )}
      </button>
    </div>
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
// Story mode (D47): autoPlay starts the recitation on mount (the story's play tap is the user gesture)
// and onDone fires once when it ends, fails or is missing.
export function VerseCard({ verse, playLabel, label, surahLabel, ayahLabel, autoPlay = false, onDone }: {
  verse: VerseView; playLabel?: string; label?: string; surahLabel?: string; ayahLabel?: string; autoPlay?: boolean; onDone?: () => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const reciting = useRef(false);
  const rc = verse.recitation;
  // Qur'an recitation: sound effects stop and stay silent until it ends (D38).
  const started = () => { reciting.current = true; sfx.recitationStarted(); };
  const done = useRef(false);
  const finish = () => { if (!done.current && onDone) { done.current = true; onDone(); } };
  const stopped = () => { setPlaying(false); reciting.current = false; sfx.recitationStopped(); finish(); };

  const play = () => {
    const a = ref.current;
    if (!a || !rc) return;
    const start = rc.startMs / 1000;
    // The tap itself starts playback (required on iPad/Android); seek as soon as metadata is known.
    if (a.readyState >= 1) a.currentTime = start;
    else a.addEventListener('loadedmetadata', () => { a.currentTime = start; }, { once: true });
    started();
    void a.play().then(() => setPlaying(true)).catch(stopped);
  };
  const onTime = () => {
    const a = ref.current;
    if (a && rc && a.currentTime >= rc.endMs / 1000) { a.pause(); setPlaying(false); }
  };
  // Leaving the card mid-recitation (next step, another page): stop the recitation and let sound
  // effects play again; the element's own pause event no longer reaches React once it is unmounted.
  useEffect(() => {
    if (!autoPlay) return;
    if (rc) play(); else finish();
    // Mount only: autoplay once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const a = ref.current;
    return () => {
      if (!reciting.current) return;
      a?.pause();
      reciting.current = false;
      sfx.recitationStopped();
    };
  }, []);

  return (
    <figure data-verse={verse.id} className="card flex flex-col gap-5 border border-gold p-3">
      <div className="relative flex flex-col gap-4 rounded-[24px] border border-gold/60 px-6 py-8 md:px-12">
        <Star className="start-2 top-2" /><Star className="end-2 top-2" /><Star className="bottom-2 start-2" /><Star className="bottom-2 end-2" />
        {label && <p className="font-display text-center text-xl text-ink-2" data-verse-label>{label}</p>}
        <blockquote dir="rtl" lang="ar" className="font-quran text-center text-4xl leading-[2.2] text-ink md:text-5xl" data-verse-text>{verse.text}</blockquote>
        {/* «سورة <KFC name> · الآية <n>» (Western numerals); the plain reference when a label is missing. */}
        {surahLabel && ayahLabel && verse.surahName && verse.ayah !== null
          ? <p className="font-display text-center text-lg text-ink-2" data-reference={verse.reference}>{surahLabel} {verse.surahName} · {ayahLabel} {verse.ayah}</p>
          : <p dir="ltr" className="text-center text-lg text-ink-2" data-reference={verse.reference}>{verse.reference}</p>}
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
      {rc && <audio ref={ref} src={rc.src} preload="none" onTimeUpdate={onTime} onPlay={started} onPause={stopped} onEnded={stopped} />}
    </figure>
  );
}

// Plant marker (D26 A7): one pot picture per stage — seed, sprout, plant, flower, fruit. `done` is
// the number of completed stations: 0 shows stage 1 faded; 1-3 show stages 1-3 (stages 4-5 belong to
// the roadmap Stations 4-5 and appear only as faint locked thumbnails on the map). Decorative.
export const plantSrc = (stage: number): string => `/images/plant/stage-${Math.min(Math.max(stage, 1), 5)}.webp`;

// grow (close moment, Phase 1b/1c): a light bloom behind the approved pot picture, which springs in,
// then a small leaf burst.
export function PlantMarker({ done, className = 'size-20', grow = false }: { done: number; className?: string; grow?: boolean }) {
  const stage = Math.min(Math.max(done, 1), 5);
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={plantSrc(stage)} alt="" aria-hidden="true" width={800} height={800} data-plant={done}
    className={`${className} rounded-[22%] object-contain ${done === 0 ? 'opacity-40' : ''} ${grow ? 'anim-grow-in' : ''}`} />;
  if (!grow) return img;
  return <span className="relative isolate inline-flex"><span className="bloom" aria-hidden="true" data-bloom />{img}<Particles kind="leaf" delayMs={480} /></span>;
}

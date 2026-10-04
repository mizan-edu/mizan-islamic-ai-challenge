'use client';

// Magic moments (Q3, D38): after the correct card's green ring (200 ms) the full-screen scene fades in
// 700 ms later (opacity 0 -> 1, scale 1.04 -> 1, 700 ms), holds 3 s and fades out (600 ms); then the
// praise line and its narration. S1: rain over the scene picture (S1.N1). S2: the wilted flower
// (S2.Q1) cross-fades to the revived one (S2.N1) under falling drops. S3: plant stages 1 -> 2 -> 3.
// Framing: the picture is always shown whole (contain, centred) inside a box of its own aspect
// ratio; behind it the same picture, blurred and scaled, fills the edges — no crop, no bars. Rain and
// drops stay inside the picture box. Tap anywhere or press Escape to skip. CSS only, no text,
// decorative; never shown under prefers-reduced-motion (the caller checks; globals.css stops every
// animation anyway).

import { useEffect, useState } from 'react';
import { sfx, type SfxCue } from '@/app/_lib/sfx';
import { plantSrc } from './media';

export const MOMENT = { delayMs: 700, fadeInMs: 700, holdMs: 3000, fadeOutMs: 600 } as const;

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface MomentPicture { src: string; width: number; height: number }
export interface MomentPictures { scene?: MomentPicture | null; from?: MomentPicture | null; to?: MomentPicture | null }

// Fixed drop layout (no randomness, so every run looks the same).
const DROPS = Array.from({ length: 36 }, (_, i) => ({ x: (i * 37) % 100, delay: (i * 173) % 1100, dur: 900 + ((i * 97) % 500), size: 10 + ((i * 7) % 8) }));

function Rain({ count = DROPS.length }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {DROPS.slice(0, count).map((d, i) => (
        <svg key={i} viewBox="0 0 12 18" className="anim-rainfall absolute top-0" style={{ left: `${d.x}%`, width: d.size, animationDelay: `${d.delay}ms`, animationDuration: `${d.dur}ms` }}>
          <path d="M6 0c3 5 6 9 6 12a6 6 0 0 1-12 0C0 9 3 5 6 0z" fill="#4FA3DD" opacity="0.85" />
        </svg>
      ))}
    </div>
  );
}

// eslint-disable-next-line @next/next/no-img-element
const Fill = ({ src, className = '' }: { src: string; className?: string }) => <img src={src} alt="" className={`absolute inset-0 size-full object-contain ${className}`} />;

export function MomentOverlay({ stationId, pictures, onDone }: { stationId: string; pictures: MomentPictures; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    sfx.play(`moment${stationId}` as SfxCue);
    const out = window.setTimeout(() => setLeaving(true), MOMENT.fadeInMs + MOMENT.holdMs);
    const done = window.setTimeout(onDone, MOMENT.fadeInMs + MOMENT.holdMs + MOMENT.fadeOutMs);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(); };
    window.addEventListener('keydown', key);
    // Lock page scrolling while the scene is up: no scrollbar gutter beside it, no scrolling beneath.
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => { window.clearTimeout(out); window.clearTimeout(done); window.removeEventListener('keydown', key); root.style.overflow = overflow; };
  }, [onDone, stationId]);

  const main = stationId === 'S1' ? pictures.scene : stationId === 'S2' ? pictures.from : null;
  const w = main?.width ?? 1;
  const h = main?.height ?? 1;
  return (
    <div className={`fixed inset-0 z-50 overflow-hidden ${stationId === 'S3' ? 'bg-[#FDF6E8]' : 'bg-sky-soft'} ${leaving ? 'anim-moment-out' : 'anim-moment-in'}`}
      onClick={onDone} aria-hidden="true" data-moment={stationId}>
      {main && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={main.src} alt="" className="absolute inset-0 size-full scale-110 object-cover blur-[24px]" data-moment-backdrop />
      )}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden" data-moment-box
        style={{ width: `min(100vw, calc(100dvh * ${w} / ${h}))`, aspectRatio: `${w} / ${h}` }}>
        {stationId === 'S1' && pictures.scene && (<><Fill src={pictures.scene.src} /><Rain /></>)}
        {stationId === 'S2' && (
          <>
            {pictures.from && <Fill src={pictures.from.src} className="anim-fade-out-late" />}
            {pictures.to && <Fill src={pictures.to.src} className="anim-fade-in-late" />}
            <Rain count={18} />
          </>
        )}
        {stationId === 'S3' && [1, 2, 3].map((stage) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={stage} src={plantSrc(stage)} alt="" width={800} height={800}
            className="anim-stage-in absolute inset-0 size-full object-contain"
            style={{ animationDelay: `${(stage - 1) * 1100}ms` }} />
        ))}
      </div>
    </div>
  );
}

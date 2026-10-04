'use client';

// Magic moments (Q3): full screen for about 2.5 s after the correct answer, then back to the screen.
// S1: rain falls across the whole screen over the scene picture (S1.N1). S2: the wilted flower
// (S2.Q1) cross-fades to the revived one (S2.N1) under falling drops. S3: plant stages 1 -> 2 -> 3
// in sequence. Tap anywhere or press Escape to skip. CSS only, no text, decorative; never shown
// under prefers-reduced-motion (the caller checks, and globals.css stops every animation anyway).

import { useEffect } from 'react';
import { plantSrc } from './media';

export const MOMENT_MS = 2500;

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface MomentPictures { scene?: string | null; from?: string | null; to?: string | null }

// Fixed drop layout (no randomness, so every run looks the same).
const DROPS = Array.from({ length: 36 }, (_, i) => ({ x: (i * 37) % 100, delay: (i * 173) % 1100, dur: 900 + ((i * 97) % 500), size: 10 + ((i * 7) % 8) }));

function Rain({ count = DROPS.length }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {DROPS.slice(0, count).map((d, i) => (
        <svg key={i} viewBox="0 0 12 18" className="anim-rainfall absolute top-0" style={{ left: `${d.x}%`, width: d.size, animationDelay: `${d.delay}ms`, animationDuration: `${d.dur}ms` }}>
          <path d="M6 0c3 5 6 9 6 12a6 6 0 0 1-12 0C0 9 3 5 6 0z" fill="#4FA3DD" opacity="0.85" />
        </svg>
      ))}
    </div>
  );
}

const Cover = ({ src, className = '' }: { src: string; className?: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt="" className={`absolute inset-0 size-full object-cover ${className}`} />
);

export function MomentOverlay({ stationId, pictures, onDone }: { stationId: string; pictures: MomentPictures; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, MOMENT_MS);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(); };
    window.addEventListener('keydown', key);
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', key); };
  }, [onDone]);

  return (
    <div className="anim-moment fixed inset-0 z-50 overflow-hidden bg-sky-soft" onClick={onDone} aria-hidden="true" data-moment={stationId}>
      {stationId === 'S1' && (
        <>
          {pictures.scene && <Cover src={pictures.scene} />}
          <div className="absolute inset-0 bg-ink/10" />
          <Rain />
        </>
      )}
      {stationId === 'S2' && (
        <>
          {pictures.from && <Cover src={pictures.from} className="anim-fade-out-late" />}
          {pictures.to && <Cover src={pictures.to} className="anim-fade-in-late" />}
          <Rain count={18} />
        </>
      )}
      {stationId === 'S3' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#FDF6E7]">
          {[1, 2, 3].map((stage) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={stage} src={plantSrc(stage)} alt="" width={800} height={800}
              className="anim-stage-in absolute size-[min(80vw,75dvh)] object-contain"
              style={{ animationDelay: `${(stage - 1) * 800}ms` }} />
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

// Magic moments (Q3, D38; Phase 1c scenes). After the correct card's ring, 700 ms later the moment
// opens: the chosen card expands from its exact on-screen rect to fill the screen (FLIP, 560 ms,
// --ease-spring-soft) and the scene fades in inside it; a slow camera push-in (1.00 -> 1.06 with a
// slight drift) runs across the moment, and the pointer tilts it by up to 3 degrees in a 1000 px
// perspective. A live layer of abstract shapes sits over the approved picture, placed where its
// content is: S1 rain streaks at two depths from under the cloud and splash ripples on the lake;
// S2 glints along the watering-can stream, ripples where it lands and a slow shimmer band; S3
// sunbeams from the top corner and light motes rising around the plant. At most 40 animated
// elements per scene; no figures, faces or text. At the end the scene settles (tilt back to rest,
// a slight scale-down) and fades into the praise line. The D38 total is unchanged: 700 ms in, 3 s
// hold, 600 ms out. Tap anywhere or press Escape to skip.
// Framing (D38): the picture is always shown whole. The frame ([data-moment-box]) fits the screen
// with the picture's aspect ratio; the picture rests at 90 % of it, so even at the full push-in and
// tilt it is never cropped, and the same picture, blurred, fills everything behind.
// Reduced motion: the still picture with an opacity fade only (globals.css): no expansion, push-in,
// tilt or live layer. Transform and opacity are the only animated properties.

import { useEffect, useRef, useState } from 'react';
import { sfx, type SfxCue } from '@/app/_lib/sfx';
import { plantSrc } from './media';

export const MOMENT = { delayMs: 700, fadeInMs: 700, holdMs: 3000, fadeOutMs: 600 } as const;
export const MAX_LIVE_ELEMENTS = 40;

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface MomentPicture { src: string; width: number; height: number }
export interface MomentPictures { scene?: MomentPicture | null; from?: MomentPicture | null; to?: MomentPicture | null }
export interface MomentRect { left: number; top: number; width: number; height: number }

// Live layers. Positions are % of the picture (checked against the approved images). Fixed layouts,
// no randomness. Each item is one animated element.
type Pos = { x: number; y: number; d: number };
const row = (n: number, f: (i: number) => Pos) => Array.from({ length: n }, (_, i) => f(i));
// S1.N1: the cloud spans x 20-78 %, its base at y ~32 %; the lake lies at y 64-86 %, x 36-96 %.
const RAIN_FAR = row(14, (i) => ({ x: 22 + ((i * 41) % 55), y: 32, d: (i * 211) % 1400 }));
const RAIN_NEAR = row(10, (i) => ({ x: 24 + ((i * 53) % 52), y: 30, d: (i * 157) % 800 }));
const SPLASH = row(7, (i) => ({ x: 40 + ((i * 29) % 52), y: 68 + ((i * 7) % 16), d: (i * 173) % 1100 }));
// S2.N1: the stream leaves the spout at x ~64 %, y ~28 % and lands on the soil at x ~49 %, y ~63 %.
const GLINTS = row(9, (i) => ({ x: 64 - i * 1.8 + ((i * 7) % 3), y: 29 + i * 3.6, d: 1800 + ((i * 230) % 1200) }));
const SOIL_RIPPLES = row(4, (i) => ({ x: 45 + i * 3, y: 63.5 + (i % 2), d: 1900 + i * 300 }));
// Plant stages (square): the pot is centred at x 32-68 %, y 57-93 %; the plant grows above it.
const BEAMS = [{ a: 32, d: 0 }, { a: 46, d: 700 }, { a: 60, d: 1400 }];
const MOTES = row(14, (i) => ({ x: 28 + ((i * 37) % 44), y: 74, d: (i * 263) % 2600 }));

const style = (o: Record<string, string | number>) => o as React.CSSProperties;

function LiveLayer({ stationId }: { stationId: string }) {
  return (
    <div className="moment-live pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" data-moment-live={stationId}>
      {stationId === 'S1' && (
        <>
          {RAIN_FAR.map((p, i) => <span key={`f${i}`} className="streak streak-far" style={style({ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.d}ms` })} />)}
          {RAIN_NEAR.map((p, i) => <span key={`n${i}`} className="streak streak-near" style={style({ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.d}ms` })} />)}
          {SPLASH.map((p, i) => <span key={`s${i}`} className="ripple" style={style({ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.d}ms` })} />)}
        </>
      )}
      {stationId === 'S2' && (
        <>
          <span className="shimmer" />
          {GLINTS.map((p, i) => (
            <svg key={`g${i}`} viewBox="0 0 16 16" className="glint" style={style({ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.d}ms` })}>
              <path d="M8 0 9.6 6.4 16 8 9.6 9.6 8 16 6.4 9.6 0 8 6.4 6.4z" fill="#FFFFFF" />
            </svg>
          ))}
          {SOIL_RIPPLES.map((p, i) => <span key={`r${i}`} className="ripple ripple-soil" style={style({ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.d}ms` })} />)}
        </>
      )}
      {stationId === 'S3' && (
        <>
          {BEAMS.map((b, i) => <span key={`b${i}`} className="beam" style={style({ '--a': `${b.a}deg`, animationDelay: `${b.d}ms` })} />)}
          {/* A mote is a column from its start (y) up 54 %; its dot rises from the bottom to the top. */}
          {MOTES.map((p, i) => <span key={`m${i}`} className="mote" style={style({ left: `${p.x}%`, top: `${p.y - 54}%`, animationDelay: `${p.d}ms` })} />)}
        </>
      )}
    </div>
  );
}

export const liveElementCount = (stationId: string): number =>
  stationId === 'S1' ? RAIN_FAR.length + RAIN_NEAR.length + SPLASH.length
    : stationId === 'S2' ? 1 + GLINTS.length + SOIL_RIPPLES.length
      : stationId === 'S3' ? BEAMS.length + MOTES.length : 0;

// eslint-disable-next-line @next/next/no-img-element
const Fill = ({ src, className = '' }: { src: string; className?: string }) => <img src={src} alt="" className={`absolute inset-0 size-full object-contain ${className}`} />;

export function MomentOverlay({ stationId, pictures, onDone, fromRect = null }: {
  stationId: string; pictures: MomentPictures; onDone: () => void; fromRect?: MomentRect | null;
}) {
  const [leaving, setLeaving] = useState(false);
  const tilt = useRef<HTMLDivElement>(null);
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

  // Pointer tilt: up to 3 degrees toward the pointer; back to rest when the scene settles.
  const setTilt = (rx: number, ry: number) => {
    tilt.current?.style.setProperty('--mtx', `${rx.toFixed(2)}deg`);
    tilt.current?.style.setProperty('--mty', `${ry.toFixed(2)}deg`);
  };
  useEffect(() => { if (leaving) setTilt(0, 0); }, [leaving]);
  const onPointerMove = (e: React.PointerEvent) => {
    if (leaving || prefersReducedMotion()) return;
    const x = e.clientX / window.innerWidth - 0.5;
    const y = e.clientY / window.innerHeight - 0.5;
    setTilt(-y * 6, x * 6);
  };

  // FLIP: start the full-screen panel at the chosen card's rect.
  const flip = fromRect && typeof window !== 'undefined' && window.innerWidth > 0 && window.innerHeight > 0
    ? style({
      '--fx': `${fromRect.left}px`, '--fy': `${fromRect.top}px`,
      '--fsx': (fromRect.width / window.innerWidth).toFixed(4), '--fsy': (fromRect.height / window.innerHeight).toFixed(4),
    })
    : undefined;

  const main = stationId === 'S1' ? pictures.scene : stationId === 'S2' ? pictures.from : null;
  const w = main?.width ?? 1;
  const h = main?.height ?? 1;
  return (
    <div className={`moment-root fixed inset-0 z-50 overflow-hidden ${leaving ? 'moment-leaving' : ''}`}
      onClick={onDone} onPointerMove={onPointerMove} aria-hidden="true" data-moment={stationId}>
      <div className={`moment-panel absolute inset-0 overflow-hidden ${flip ? 'moment-flip' : 'moment-grow'} ${stationId === 'S3' ? 'bg-[#FDF6E8]' : 'bg-sky-soft'}`} style={flip} data-moment-flip={flip ? 'card' : 'center'}>
        <div className="moment-scene absolute inset-0">
          {main && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={main.src} alt="" className="absolute inset-0 size-full scale-110 object-cover blur-[24px]" data-moment-backdrop />
          )}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" data-moment-box
            style={{ width: `min(100vw, calc(100dvh * ${w} / ${h}))`, aspectRatio: `${w} / ${h}` }}>
            <div ref={tilt} className="moment-tilt absolute inset-0">
              <div className="moment-camera absolute inset-0">
                <div className="absolute inset-[5%]" data-moment-picture>
                  {stationId === 'S1' && pictures.scene && <Fill src={pictures.scene.src} />}
                  {stationId === 'S2' && (
                    <>
                      {pictures.from && <Fill src={pictures.from.src} className="anim-fade-out-late" />}
                      {pictures.to && <Fill src={pictures.to.src} className="anim-fade-in-late" />}
                    </>
                  )}
                  {stationId === 'S3' && [1, 2, 3].map((stage) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={stage} src={plantSrc(stage)} alt="" width={800} height={800}
                      className="anim-stage-in absolute inset-0 size-full object-contain"
                      style={{ animationDelay: `${(stage - 1) * 1100}ms` }} />
                  ))}
                  <LiveLayer stationId={stationId} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

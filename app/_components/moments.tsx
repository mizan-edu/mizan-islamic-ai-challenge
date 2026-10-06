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
// a slight scale-down) and fades into the praise line. Tap anywhere or press Escape to skip.
// Video (D60, D62): when the station has a clip, it plays muted and inline once the expansion has
// finished, with its approved still as the poster, and the moment lasts as long as the clip (at most
// 6 s; a longer clip stops at 6 s); its last frame holds while the scene fades. The CSS layer is
// dropped where the clip shows that motion (S1 rain, S2 water) and kept for S3's light. Without a
// playable clip (reduced motion, data saver, missing file, load error or no start within 2.5 s) the
// moment keeps the D38 timing (700 ms in, 3 s hold, 600 ms out) with the still and the CSS layer.
// Framing (D38): the picture is always shown whole. The frame ([data-moment-box]) fits the screen
// with the picture's aspect ratio; the picture rests at 90 % of it, so even at the full push-in and
// tilt it is never cropped, and the same picture, blurred, fills everything behind.
// Reduced motion: the still picture with an opacity fade only (globals.css): no expansion, push-in,
// tilt or live layer. Transform and opacity are the only animated properties.

import { useEffect, useRef, useState } from 'react';
import type { VideoSources } from '@/app/_lib/media';
import { SCENE_CUE, sfx } from '@/app/_lib/sfx';
import { plantSrc } from './media';

export const MOMENT = { delayMs: 700, fadeInMs: 700, holdMs: 3000, fadeOutMs: 600 } as const;
export const MAX_LIVE_ELEMENTS = 40;
export const FLIP_MS = 560; // the card-to-scene expansion (globals.css .moment-flip)
export const STALL_MS = 2500; // a clip that has not started this long after the expansion is dropped
export const MAX_CLIP_MS = 6000; // D62: a moment lasts as long as its clip, at most 6 s
export const clipHoldMs = (durationS: number): number => Math.min(Math.round(durationS * 1000), MAX_CLIP_MS);

// Data saver (Save-Data / navigator.connection.saveData): no video.
export const saveData = (): boolean =>
  typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
export const videoAllowed = (): boolean => !prefersReducedMotion() && !saveData();

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
// Safe areas (D67): on a phone with a notch or home bar the picture frame stays clear of them; the
// blurred fill still covers the whole screen. Zero everywhere else.
const SAFE_X = 'env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)';
const SAFE_Y = 'env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)';

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

export function MomentOverlay({ stationId, pictures, onDone, fromRect = null, video = null }: {
  stationId: string; pictures: MomentPictures; onDone: () => void; fromRect?: MomentRect | null; video?: VideoSources | null;
}) {
  const [leaving, setLeaving] = useState(false);
  // Video (D60, D62): only with motion allowed and no data saver; 'error' falls back to the still + CSS layer.
  const [videoState, setVideoState] = useState<'off' | 'ready' | 'playing' | 'ended' | 'error'>(() => (video && videoAllowed() ? 'ready' : 'off'));
  const tilt = useRef<HTMLDivElement>(null);
  const clip = useRef<HTMLVideoElement>(null);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);
  const left = useRef(false);
  const started = useRef(false);
  const mountedAt = useRef(0);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  // The scene's sound (D65): rain, pour or grow; it starts with the clip (or with the still when there
  // is no clip) and fades out over 0.5 s when the clip ends, the moment ends or the child skips it.
  const sounding = useRef(false);
  const startSound = () => {
    const cue = SCENE_CUE[stationId];
    if (sounding.current || !cue) return;
    sounding.current = true;
    sfx.startScene(cue);
  };
  // The moment ends: settle and fade (600 ms), then the praise line.
  const leave = () => {
    if (left.current) return;
    left.current = true;
    sfx.fadeOutScene();
    setLeaving(true);
    later(() => done.current(), MOMENT.fadeOutMs);
  };
  // No playable clip: the still and the CSS layer, on the D38 timing from the moment's start.
  const fail = () => {
    if (left.current) return;
    setVideoState('error');
    startSound();
    later(leave, Math.max(0, MOMENT.fadeInMs + MOMENT.holdMs - (performance.now() - mountedAt.current)));
  };

  useEffect(() => {
    mountedAt.current = performance.now();
    if (videoState === 'off') {
      startSound();
      later(leave, MOMENT.fadeInMs + MOMENT.holdMs);
    } else {
      // Play once the card-to-scene expansion has finished; give up if it has not started 2.5 s later.
      later(() => { void clip.current?.play().catch(fail); }, FLIP_MS);
      later(() => { if (!started.current) fail(); }, FLIP_MS + STALL_MS);
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') done.current(); };
    window.addEventListener('keydown', key);
    // Lock page scrolling while the scene is up: no scrollbar gutter beside it, no scrolling beneath.
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    const pending = timers.current;
    return () => { pending.forEach((t) => window.clearTimeout(t)); window.removeEventListener('keydown', key); root.style.overflow = overflow; sfx.fadeOutScene(); };
    // Mount only: the moment's timeline starts once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPlaying = () => {
    if (started.current) return;
    started.current = true;
    setVideoState('playing');
    startSound();
    // D62: the moment lasts as long as the clip, at most 6 s; a longer clip stops (holding its frame).
    later(() => { clip.current?.pause(); leave(); }, MAX_CLIP_MS);
  };
  const onEnded = () => { setVideoState('ended'); leave(); }; // the video holds its last frame while the scene fades

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
  const playing = videoState === 'ready' || videoState === 'playing' || videoState === 'ended';
  // The clip's start frame is its approved still: S1.N1, S2.N1 (D60 Task 1 decision), plant stage 1.
  const poster = stationId === 'S1' ? pictures.scene?.src : stationId === 'S2' ? pictures.to?.src : stationId === 'S3' ? plantSrc(1) : undefined;
  // The CSS layer stays where the clip does not show that motion: S3's sunbeams and motes.
  const live = !playing || stationId === 'S3';
  return (
    <div className={`moment-root fixed inset-0 z-50 overflow-hidden ${leaving ? 'moment-leaving' : ''}`}
      onClick={() => done.current()} onPointerMove={onPointerMove} aria-hidden="true" data-moment={stationId} data-moment-video={videoState}>
      <div className={`moment-panel absolute inset-0 overflow-hidden ${flip ? 'moment-flip' : 'moment-grow'} ${stationId === 'S3' ? 'bg-[#FDF6E8]' : 'bg-sky-soft'}`} style={flip} data-moment-flip={flip ? 'card' : 'center'}>
        <div className="moment-scene absolute inset-0">
          {main && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={main.src} alt="" className="absolute inset-0 size-full scale-110 object-cover blur-[24px]" data-moment-backdrop />
          )}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" data-moment-box
            style={{ width: `min(100vw - ${SAFE_X}, calc((100dvh - ${SAFE_Y}) * ${w} / ${h}))`, aspectRatio: `${w} / ${h}` }}>
            <div ref={tilt} className="moment-tilt absolute inset-0">
              <div className="moment-camera absolute inset-0">
                <div className="absolute inset-[5%]" data-moment-picture>
                  {playing && video ? (
                    <video ref={clip} className="absolute inset-0 size-full object-contain" muted playsInline preload="auto" poster={poster}
                      onPlaying={onPlaying} onEnded={onEnded} onError={fail} data-moment-clip={stationId}>
                      <source src={video.mp4} type="video/mp4" onError={fail} />
                    </video>
                  ) : (
                    <>
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
                    </>
                  )}
                  {live && <LiveLayer stationId={stationId} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

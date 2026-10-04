'use client';

// Journey map «حديقة الآيات»: an illustrated scene (sky, sun, drifting clouds, two hill layers, a
// winding river) with Stations S1-S3 as round stones on the river. S1 is open; each next station
// unlocks when the previous one is completed on this device (session storage only). Tapping an open
// stone selects it; the bottom card starts it. No text input; locked stones do nothing.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Seedling } from './media';
import { completedStations } from './session';

export interface MapStation { id: string; number: number; title: string | null; stage: number }

// Stone positions on the river, in the scene's 1000 x 625 coordinates (RTL: the journey starts right).
const STONES = [{ x: 790, y: 205 }, { x: 505, y: 335 }, { x: 225, y: 470 }];
const RIVER = 'M1040 128 C930 150 870 182 790 205 C690 234 600 306 505 335 C405 366 310 418 225 470 C150 516 60 552 -40 572';

const TickIcon = () => <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const LockIcon = () => <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" /><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2.5" fill="none" /></svg>;
const ArrowIcon = () => <svg viewBox="0 0 24 24" className="size-8 -scale-x-100" aria-hidden="true"><path d="M5 12h12m-5-6 6 6-6 6" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;

function Cloud({ y, scale, duration, delay }: { y: number; scale: number; duration: number; delay: number }) {
  return (
    <g className="anim-drift" style={{ animationDuration: `${duration}s`, animationDelay: `${delay}s` }}>
      <path transform={`translate(0 ${y}) scale(${scale})`} d="M0 40a26 26 0 0 1 46-12a32 32 0 0 1 58 6a22 22 0 0 1 10 42H8a22 22 0 0 1-8-36z" fill="#FFFFFF" opacity="0.95" />
    </g>
  );
}

function Scene() {
  return (
    <svg viewBox="0 0 1000 625" className="absolute inset-0 size-full" aria-hidden="true" data-scene>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CFEAF7" />
          <stop offset="1" stopColor="#EAF6FC" />
        </linearGradient>
      </defs>
      <rect width="1000" height="625" fill="url(#sky)" />
      <g transform="translate(150 105)">
        <g className="anim-rays">
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x="-4" y="-92" width="8" height="26" rx="4" fill="#FFC94A" opacity="0.7" transform={`rotate(${i * 30})`} />
          ))}
        </g>
        <circle r="54" fill="#FFC94A" />
      </g>
      <g>
        <Cloud y={60} scale={1} duration={70} delay={-10} />
        <Cloud y={130} scale={0.7} duration={95} delay={-55} />
        <Cloud y={30} scale={0.55} duration={120} delay={-80} />
      </g>
      <path d="M0 330 C140 260 300 280 430 320 C560 360 700 250 840 270 C920 282 970 300 1000 310 V625 H0z" fill="#9ED4A8" />
      <path d="M0 430 C160 380 300 420 470 410 C640 400 760 350 1000 380 V625 H0z" fill="#6BBF7E" />
      <path d={RIVER} stroke="#2F80C9" strokeWidth="58" fill="none" strokeLinecap="round" />
      <path d={RIVER} stroke="#4FA3DD" strokeWidth="40" fill="none" strokeLinecap="round" />
      <path d={RIVER} stroke="#EAF6FC" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="28 72" opacity="0.85" className="anim-flow" />
      {[[90, 560], [380, 520], [690, 470], [930, 440], [610, 580]].map(([x, y]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <path d="M0 0 C-6 -14 -2 -26 0 -30 C2 -26 6 -14 0 0" fill="#1F6B3A" />
          <path d="M0 0 C-14 -8 -18 -18 -18 -24 C-10 -20 -4 -12 0 0" fill="#3BA55C" />
          <path d="M0 0 C14 -8 18 -18 18 -24 C10 -20 4 -12 0 0" fill="#3BA55C" />
        </g>
      ))}
    </svg>
  );
}

export default function JourneyMap({ title, stations, parentsLabel, startLabel }: {
  title: string | null; stations: MapStation[]; parentsLabel?: string; startLabel?: string;
}) {
  const [done, setDone] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  // Device-only progress (sessionStorage) is read after mount so server and client markup match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDone(completedStations()); }, []);

  const open = (i: number) => i === 0 || done.includes(stations[i - 1].id);
  const current = stations.find((s, i) => open(i) && !done.includes(s.id))?.id ?? null;
  const selectedId = picked ?? current ?? stations.filter((_, i) => open(i)).at(-1)?.id ?? null;
  const selected = stations.find((s) => s.id === selectedId) ?? null;
  const leaves = stations.filter((s) => done.includes(s.id)).length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:px-8" data-screen="journey">
      <header className="flex items-center justify-between gap-4">
        {title && <h1 className="font-display text-3xl leading-snug text-ink md:text-5xl">{title}</h1>}
        <div className="card flex shrink-0 items-center gap-1 px-3 py-1" data-progress={leaves}>
          <Seedling stage={leaves} className="h-20 w-16 md:h-24 md:w-20" />
          <span dir="ltr" className="font-display text-2xl text-ink-2">{leaves}/{stations.length}</span>
        </div>
      </header>

      <div className="card relative aspect-[8/5] w-full overflow-hidden">
        <Scene />
        <ol className="absolute inset-0">
          {stations.map((s, i) => {
            const isOpen = open(i);
            const isDone = done.includes(s.id);
            const isCurrent = s.id === current;
            const pos = STONES[i] ?? STONES[STONES.length - 1];
            const ring = isDone ? 'border-leaf' : isCurrent ? 'border-water' : isOpen ? 'border-water-light' : 'border-[#B8C4CC]';
            return (
              <li key={s.id} data-station={s.id} data-open={isOpen} data-state={isDone ? 'done' : isCurrent ? 'current' : isOpen ? 'open' : 'locked'}
                className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos.x / 10}%`, top: `${pos.y / 6.25}%` }}>
                <div className={`relative isolate rounded-full ${isCurrent ? 'anim-bob anim-pulse' : ''}`}>
                  <button type="button" disabled={!isOpen} onClick={() => setPicked(s.id)} aria-label={s.title ?? undefined} aria-pressed={s.id === selectedId}
                    className={`press relative flex size-18 items-center justify-center rounded-full border-[6px] md:size-28 md:border-8 ${ring} ${isOpen ? 'bg-card' : 'bg-stone'} ${s.id === selectedId ? 'outline-4 outline-offset-4 outline-sun' : ''}`}>
                    <span className={`font-display text-3xl md:text-5xl ${isOpen ? 'text-ink' : 'text-ink-2'}`}>{s.number}</span>
                    {isDone && <span className="absolute -top-3 -start-3 flex size-7 items-center justify-center rounded-full bg-leaf-dark text-white md:-top-2 md:-start-2 md:size-9" data-badge="done"><TickIcon /></span>}
                    {!isOpen && <span className="absolute -top-3 -start-3 flex size-7 items-center justify-center rounded-full bg-ink-2 text-white md:-top-2 md:-start-2 md:size-9" data-badge="locked"><LockIcon /></span>}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {selected && (
        <section className="card anim-rise flex flex-wrap items-center justify-between gap-4 p-5" data-selected={selected.id} key={selected.id}>
          <div className="flex items-center gap-4">
            <span className="font-display flex size-14 shrink-0 items-center justify-center rounded-full bg-sky text-2xl text-ink">{selected.number}</span>
            {selected.title && <h2 className="font-display text-2xl leading-relaxed text-ink md:text-3xl">{selected.title}</h2>}
          </div>
          <Link href={`/stations/${selected.id}`} data-action="start-station"
            className="pill font-display flex min-h-16 items-center gap-3 bg-leaf-dark px-8 text-2xl text-white">
            {startLabel && <span>{startLabel}</span>}
            <ArrowIcon />
          </Link>
        </section>
      )}

      {parentsLabel && <Link href="/parent" className="self-center py-4 text-base text-ink-2 underline" data-parents-link>{parentsLabel}</Link>}
    </main>
  );
}

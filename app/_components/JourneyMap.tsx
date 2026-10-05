'use client';

// Journey map «حديقة الآيات» (Q3; D26 A6): the illustrated map with five round stones along the river.
// S1-S3 are the built stations: S1 is open; each next one unlocks when the previous one is completed
// on this device (session storage only). S4-S5 are roadmap (C1): greyed, a «قريبًا» badge, not
// tappable, no title. Tapping an open stone selects it; the bottom card starts it. No text input.

import { ROADMAP_STATIONS } from '@/app/_lib/roadmap';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PlantMarker, plantSrc } from './media';
import { completedStations } from './session';

export interface MapStation { id: string; number: number; title: string | null; stage: number }

// Stone centres on public/images/map/background.webp, in % of its width and height (S1 upstream,
// right; S5 downstream, left — the journey reads right to left).
const STONES = [{ x: 86, y: 36 }, { x: 66, y: 51 }, { x: 83, y: 63 }, { x: 45, y: 75 }, { x: 21, y: 78 }];
const ROADMAP: readonly string[] = ROADMAP_STATIONS;

const TickIcon = () => <svg viewBox="0 0 24 24" className="size-5 md:size-6" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const LockIcon = () => <svg viewBox="0 0 24 24" className="size-3" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" /><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2.5" fill="none" /></svg>;
const ArrowIcon = () => <svg viewBox="0 0 24 24" className="size-8 -scale-x-100" aria-hidden="true"><path d="M5 12h12m-5-6 6 6-6 6" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;

const Icon = ({ id, dim }: { id: string; dim: boolean }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={`/images/icons/${id}.webp`} alt="" width={800} height={800} className={`size-full scale-[1.12] rounded-full object-cover ${dim ? 'opacity-60 grayscale' : ''}`} />
);

export default function JourneyMap({ title, stations, parentsLabel, startLabel, comingSoonLabel }: {
  title: string | null; stations: MapStation[]; parentsLabel?: string; startLabel?: string; comingSoonLabel?: string;
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
  const completed = stations.filter((s) => done.includes(s.id)).length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:px-8" data-screen="journey">
      <header className="flex items-center justify-between gap-4">
        {title && <h1 className="font-display text-3xl leading-snug text-ink md:text-5xl">{title}</h1>}
        <div className="card flex shrink-0 items-end gap-1 px-3 py-2" data-progress={completed}>
          <PlantMarker done={completed} className="size-16 rounded-2xl md:size-20" />
          {[4, 5].map((stage) => (
            <span key={stage} className="relative" data-plant-locked={stage}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={plantSrc(stage)} alt="" aria-hidden="true" width={800} height={800} className="size-9 object-contain opacity-30 grayscale md:size-11" />
              <span className="absolute -top-1 -end-1 flex size-5 items-center justify-center rounded-full bg-ink-2 text-white"><LockIcon /></span>
            </span>
          ))}
        </div>
      </header>

      <div className="card relative w-full overflow-hidden" style={{ aspectRatio: '1344 / 752' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/map/background.webp" alt="" aria-hidden="true" width={1344} height={752} className="absolute inset-0 size-full object-cover" data-map />
        <ol className="absolute inset-0">
          {stations.map((s, i) => {
            const isOpen = open(i);
            const isDone = done.includes(s.id);
            const isCurrent = s.id === current;
            const pos = STONES[i];
            const ring = isDone ? 'border-leaf' : isCurrent ? 'border-water' : isOpen ? 'border-water-light' : 'border-stone';
            return (
              <li key={s.id} data-station={s.id} data-open={isOpen} data-state={isDone ? 'done' : isCurrent ? 'current' : isOpen ? 'open' : 'locked'}
                className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                <div className={`relative isolate rounded-full ${isCurrent ? 'anim-pulse' : ''}`}>
                  <button type="button" disabled={!isOpen} onClick={() => setPicked(s.id)} aria-label={s.title ?? undefined} aria-pressed={s.id === selectedId}
                    className={`press relative flex size-18 items-center justify-center overflow-hidden rounded-full border-[5px] bg-card md:size-24 md:border-[6px] ${ring} ${s.id === selectedId ? 'outline-4 outline-offset-4 outline-sun' : ''}`}>
                    <Icon id={s.id} dim={!isOpen} />
                  </button>
                  {isDone && <span className="absolute -top-2 -start-2 flex size-7 items-center justify-center rounded-full bg-leaf-dark text-white md:size-9" data-badge="done"><TickIcon /></span>}
                </div>
              </li>
            );
          })}
          {ROADMAP.map((id, k) => {
            const pos = STONES[stations.length + k];
            if (!pos) return null;
            return (
              <li key={id} data-soon={id} aria-label={comingSoonLabel} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                <div className="relative flex size-16 items-center justify-center overflow-hidden rounded-full border-[5px] border-stone bg-card md:size-20">
                  <Icon id={id} dim />
                </div>
                {comingSoonLabel && <span className="font-display absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-card px-2 text-sm text-ink-2 shadow-card" data-badge="soon">{comingSoonLabel}</span>}
              </li>
            );
          })}
        </ol>
      </div>

      {selected && (
        <section className="card anim-rise flex flex-wrap items-center justify-between gap-4 p-5" data-selected={selected.id} key={selected.id}>
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 overflow-hidden rounded-full bg-sky" aria-hidden="true"><Icon id={selected.id} dim={false} /></span>
            {selected.title && <h2 className="font-display text-2xl leading-relaxed text-ink md:text-3xl">{selected.title}</h2>}
          </div>
          <Link href={`/stations/${selected.id}`} data-action="start-station"
            className="pill font-display flex min-h-16 items-center gap-3 bg-leaf-dark px-8 text-2xl text-white">
            {startLabel && <span>{startLabel}</span>}
            <ArrowIcon />
          </Link>
        </section>
      )}

      {parentsLabel && (
        <Link href="/parent" className="pill font-display flex min-h-12 items-center self-center bg-card px-6 text-lg text-ink-2" data-parents-link>{parentsLabel}</Link>
      )}
    </main>
  );
}

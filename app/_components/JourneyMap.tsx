'use client';

// Journey map: Stations S1-S3 on a path. S1 is open; each next station unlocks when the previous one
// is completed on this device (session storage only). No text input; locked stations are not links.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Seedling } from './media';
import { completedStations } from './session';

export interface MapStation { id: string; number: number; title: string | null; stage: number }

export default function JourneyMap({ title, stations, parentsLabel }: { title: string | null; stations: MapStation[]; parentsLabel?: string }) {
  const [done, setDone] = useState<string[]>([]);
  // Device-only progress (sessionStorage) is read after mount so server and client markup match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDone(completedStations()); }, []);

  const open = (i: number) => i === 0 || done.includes(stations[i - 1].id);
  const stage = stations.filter((s) => done.includes(s.id)).length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col items-center gap-8 px-4 py-8 sm:px-8" data-screen="journey">
      {title && <h1 className="text-center text-4xl font-bold leading-relaxed md:text-5xl">{title}</h1>}
      <Seedling stage={stage} />
      <ol className="relative flex w-full flex-col gap-6">
        {stations.map((s, i) => {
          const isOpen = open(i);
          const card = (
            <div className={`flex min-h-32 items-center gap-5 rounded-3xl p-5 shadow-sm ${isOpen ? 'bg-white' : 'bg-sand/60'}`}>
              <span className={`flex size-20 shrink-0 items-center justify-center rounded-full text-4xl font-bold text-white ${isOpen ? (i === 2 ? 'bg-leaf' : 'bg-water') : 'bg-muted/40'}`} aria-hidden="true">{s.number}</span>
              {s.title && <span className="text-2xl font-bold leading-relaxed">{s.title}</span>}
              {done.includes(s.id) && <span className="ms-auto" aria-hidden="true"><Seedling stage={1} /></span>}
            </div>
          );
          return (
            <li key={s.id} data-station={s.id} data-open={isOpen} className={i % 2 ? 'sm:me-24' : 'sm:ms-24'}>
              {isOpen ? <Link href={`/stations/${s.id}`} className="block">{card}</Link> : card}
            </li>
          );
        })}
      </ol>
      {parentsLabel && <Link href="/parent" className="min-h-16 py-4 text-base text-muted underline" data-parents-link>{parentsLabel}</Link>}
    </main>
  );
}

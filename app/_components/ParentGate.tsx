'use client';

// Parental gate (D54): the adult taps 7, 3, 9 in order to open what is behind it (the AI-lens
// switch now; Parent Ask later). A wrong digit quietly starts again: no message, no colour, no sound.
// Opened only for this page view, in React memory: nothing is stored, and a reload closes it again.
// ?judge=1 stays the judges' direct entry to the lens; this is the second entry, for parents.
// The keypad is laid out left to right like a phone keypad, Western numerals, 80 px keys, 16 px gaps.

import { useState } from 'react';

export const GATE_CODE = [7, 3, 9] as const;

// Pure step: the digits entered so far after one more tap, and whether the gate opens.
export function gateStep(entered: number[], digit: number): { entered: number[]; open: boolean } {
  const next = [...entered, digit];
  if (GATE_CODE[next.length - 1] !== digit) return { entered: digit === GATE_CODE[0] ? [digit] : [], open: false };
  return next.length === GATE_CODE.length ? { entered: [], open: true } : { entered: next, open: false };
}

export default function ParentGate({ prompt, children }: { prompt?: string; children: React.ReactNode }) {
  const [entered, setEntered] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  if (open) return <>{children}</>;
  const tap = (digit: number) => {
    const r = gateStep(entered, digit);
    setEntered(r.entered);
    if (r.open) setOpen(true);
  };
  return (
    <section className="card flex flex-col items-center gap-4 p-6" data-parent-gate>
      {prompt && <p className="font-display text-center text-xl text-ink" data-gate-prompt>{prompt}</p>}
      <ol className="flex gap-3" aria-hidden="true" data-gate-progress={entered.length}>
        {GATE_CODE.map((d, i) => (
          <li key={d} dir="ltr" className={`flex size-12 items-center justify-center rounded-full font-mono text-xl ${i < entered.length ? 'bg-leaf-dark text-white' : 'bg-sky-soft text-ink'}`}>{d}</li>
        ))}
      </ol>
      <div dir="ltr" className="grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} type="button" onClick={() => tap(d)} data-gate-key={d}
            className="pill flex size-20 items-center justify-center bg-card font-mono text-3xl text-ink">{d}</button>
        ))}
      </div>
    </section>
  );
}

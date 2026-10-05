'use client';

// Parent switch for sound (D38, label D39; D65): on by default; turning it off mutes effects and ambience
// for this browser session only (sessionStorage).

import { useEffect, useState } from 'react';
import { sfx } from '@/app/_lib/sfx';

export default function SfxSwitch({ label }: { label: string }) {
  const [on, setOn] = useState(true);
  // The stored choice is read after mount so server and client markup match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOn(sfx.enabled()); }, []);
  const toggle = () => { const next = !on; sfx.setEnabled(next); setOn(next); };
  return (
    <button type="button" role="switch" aria-checked={on} onClick={toggle} data-sfx-switch={on ? 'on' : 'off'}
      className="card flex min-h-16 items-center justify-between gap-4 px-6 py-3">
      <span className="font-display text-xl text-ink">{label}</span>
      <span aria-hidden="true" className={`relative h-9 w-16 rounded-full transition-colors ${on ? 'bg-leaf-dark' : 'bg-stone'}`}>
        <span className={`absolute top-1 size-7 rounded-full bg-card shadow transition-all ${on ? 'end-1' : 'start-1'}`} />
      </span>
    </button>
  );
}

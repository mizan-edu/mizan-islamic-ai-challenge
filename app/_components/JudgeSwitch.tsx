'use client';

// Parent-page switch for judge mode (A1, label D37): off by default, kept for this browser session
// only. ?judge=1 on any page turns it on as well.

import { useEffect, useState } from 'react';
import { judgeEnabled, setJudgeEnabled } from '@/app/_lib/judge';

export default function JudgeSwitch({ label }: { label: string }) {
  const [on, setOn] = useState(false);
  // Read after mount so server and client markup match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOn(judgeEnabled()); }, []);
  const toggle = () => { const next = !on; setJudgeEnabled(next); setOn(next); };
  return (
    <button type="button" role="switch" aria-checked={on} onClick={toggle} data-judge-switch={on ? 'on' : 'off'}
      className="card flex min-h-16 items-center justify-between gap-4 px-6 py-3">
      <span className="font-display text-xl text-ink">{label}</span>
      <span aria-hidden="true" className={`relative h-9 w-16 rounded-full transition-colors ${on ? 'bg-leaf-dark' : 'bg-stone'}`}>
        <span className={`absolute top-1 size-7 rounded-full bg-card shadow transition-all ${on ? 'end-1' : 'start-1'}`} />
      </span>
    </button>
  );
}

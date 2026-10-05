'use client';

// «إعادة البدء» on the parent page (D47): clears this device's journey progress and session events so
// each pilot child starts fresh. A confirm step first; settings (sound effects, judge mode) are kept.

import { useState } from 'react';
import { clearSession } from './session';

export default function ResetJourney({ text }: { text: { reset: string; confirm: string; yes: string; cancel: string; done: string } }) {
  const [state, setState] = useState<'idle' | 'confirm' | 'done'>('idle');
  const button = 'pill min-h-14 px-6 py-2 font-display text-xl';
  return (
    <div className="card flex flex-col gap-4 px-6 py-4" data-reset={state}>
      {state !== 'confirm' && (
        <button type="button" className={`${button} self-start bg-sun text-ink`} onClick={() => setState('confirm')} data-reset-start>{text.reset}</button>
      )}
      {state === 'confirm' && (
        <div role="group" aria-labelledby="reset-q" className="flex flex-col gap-4">
          <p id="reset-q" className="text-xl leading-relaxed text-ink">{text.confirm}</p>
          <div className="flex flex-wrap gap-4">
            <button type="button" className={`${button} bg-leaf-dark text-white`} onClick={() => { clearSession(); setState('done'); }} data-reset-confirm>{text.yes}</button>
            <button type="button" className={`${button} bg-card text-ink ring-2 ring-stone`} onClick={() => setState('idle')} data-reset-cancel>{text.cancel}</button>
          </div>
        </div>
      )}
      {state === 'done' && <p role="status" className="text-lg text-ink-2" data-reset-done>{text.done}</p>}
    </div>
  );
}

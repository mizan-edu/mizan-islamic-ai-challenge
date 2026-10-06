'use client';

// Guided cues (D75), the component side: StationFlow provides the active cue; controls ask whether
// they are cued (data-cue makes them glow, globals.css) and report taps and their audio. Without a
// provider (parent and adult pages) nothing is ever cued. Component memory only.

import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { watchdogMs } from '@/app/_lib/cues';

export interface CueApi {
  cued: string | null; // key of the active cue
  tap: (key: string) => void;
  play: (key: string) => void;
  end: (key: string) => void;
}
export const CueContext = createContext<CueApi | null>(null);

const NONE = { cued: false, tap: () => {}, play: () => {}, end: () => {} };

function useCue(key: string | null) {
  const api = useContext(CueContext);
  return !api || !key ? NONE : { cued: api.cued === key, tap: () => api.tap(key), play: () => api.play(key), end: () => api.end(key) };
}

// For a speaker: reports play, then end on 'ended', on a stop, on a failure, or when no 'ended'
// arrives within the clip's duration + 2 s (watchdogMs). `expectS` is the known length, if any.
export function useSpeakerCue(key: string | null, audio: React.RefObject<HTMLAudioElement | null>, expectS: number | null = null) {
  const cue = useCue(key);
  const timer = useRef<number | null>(null);
  const cueRef = useRef(cue);
  useEffect(() => { cueRef.current = cue; });
  const disarm = useCallback(() => { if (timer.current) { window.clearTimeout(timer.current); timer.current = null; } }, []);
  const ended = useCallback(() => { disarm(); cueRef.current.end(); }, [disarm]);
  const arm = useCallback(() => {
    disarm();
    const a = audio.current;
    const d = expectS ?? (a && Number.isFinite(a.duration) ? a.duration : null);
    timer.current = window.setTimeout(ended, watchdogMs(d, expectS === null ? a?.currentTime ?? 0 : 0));
    if (d === null && a) {
      // Re-arm with the real length once it is known.
      a.addEventListener('loadedmetadata', () => { if (timer.current && Number.isFinite(a.duration)) { disarm(); timer.current = window.setTimeout(ended, watchdogMs(a.duration, a.currentTime)); } }, { once: true });
    }
  }, [audio, expectS, disarm, ended]);
  useEffect(() => disarm, [disarm]);
  return {
    cued: cue.cued,
    tap: () => { cue.tap(); arm(); },
    playing: () => { cue.play(); if (!timer.current) arm(); },
    ended,
  };
}

// Judge mode flag (A1, Delta v1.3 D26): off by default and invisible to children. Opening any page
// with ?judge=1 turns it on for this browser session (sessionStorage), ?judge=0 turns it off, and the
// parent-page switch does the same. Only this on/off flag is kept: never a trace, never child data.
// Client-safe: no server imports here.

export const JUDGE_KEY = 'mizan.judge';
export const NO_MODEL_CALL = 'no model call';

export interface FlagStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// Reads ?judge=1 / ?judge=0 from the URL (remembering it for the session), else the stored flag.
export function judgeFromUrl(search: string, storage: FlagStorage | null): boolean {
  const param = new URLSearchParams(search).get('judge');
  try {
    if (param === '1') storage?.setItem(JUDGE_KEY, '1');
    else if (param === '0') storage?.removeItem(JUDGE_KEY);
    return param === '1' || (param !== '0' && storage?.getItem(JUDGE_KEY) === '1');
  } catch {
    return param === '1'; // storage unavailable: the URL alone decides, nothing is kept
  }
}

export function storeJudge(on: boolean, storage: FlagStorage | null): void {
  try {
    if (on) storage?.setItem(JUDGE_KEY, '1');
    else storage?.removeItem(JUDGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

const session = (): FlagStorage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const judgeEnabled = (): boolean => typeof window !== 'undefined' && judgeFromUrl(window.location.search, session());
export const setJudgeEnabled = (on: boolean): void => storeJudge(on, session());

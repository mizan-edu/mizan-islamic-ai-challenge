// Best-effort limits for «جرّب سؤالًا» on the evaluation page (Runbook 3.7): 10 questions per minute
// per visitor, and a daily cap on typed questions from EVAL_DAILY_CAP (default 300). In memory, per
// server instance, never written anywhere. A visitor is a salted hash of the forwarding address; the
// salt is random per instance and the hashes are dropped after a minute. Nothing is logged.

import { createHash, randomBytes } from 'node:crypto';

export const PER_MINUTE = 10;
export const MAX_CHARS = 120; // typed question length (characters)
export const DEFAULT_DAILY_CAP = 300;
const WINDOW_MS = 60_000;

export function dailyCap(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.EVAL_DAILY_CAP);
  return env.EVAL_DAILY_CAP !== undefined && env.EVAL_DAILY_CAP.trim() !== '' && Number.isInteger(n) && n >= 0 ? n : DEFAULT_DAILY_CAP;
}

export class TryLimits {
  private salt = randomBytes(16).toString('hex');
  private recent = new Map<string, number[]>();
  private day = '';
  private typedToday = 0;
  constructor(private now: () => number = Date.now) {}

  visitor(address: string | null): string {
    return createHash('sha256').update(`${this.salt}:${address ?? 'unknown'}`).digest('hex').slice(0, 16);
  }

  // Counts one question for the visitor; false when the per-minute limit is reached.
  allowMinute(visitor: string): boolean {
    const t = this.now();
    for (const [k, ts] of this.recent) { const kept = ts.filter((x) => t - x < WINDOW_MS); if (kept.length) this.recent.set(k, kept); else this.recent.delete(k); }
    const ts = this.recent.get(visitor) ?? [];
    if (ts.length >= PER_MINUTE) return false;
    this.recent.set(visitor, [...ts, t]);
    return true;
  }

  // Counts one typed question for today (UTC); false when the daily cap is reached.
  allowTyped(cap: number): boolean {
    const today = new Date(this.now()).toISOString().slice(0, 10);
    if (today !== this.day) { this.day = today; this.typedToday = 0; }
    if (this.typedToday >= cap) return false;
    this.typedToday++;
    return true;
  }
}

// The instance used by /api/try (one per server instance).
export const tryLimits = new TryLimits();

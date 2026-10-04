// Sound effects (D38): short nature/foley cues only — no musical instruments — and never while a
// Qur'an recitation plays. Files: public/audio/sfx/<cue>.mp3. A cue plays only if its file exists
// (the station page lists them at build time), so a missing file fails silently with no request.
// Volume 0.5, lowered to 0.3 while narration plays. A parent switch turns effects off; the choice is
// remembered on the device only (localStorage, not child data).

export const SFX_CUES = ['tap', 'correct', 'tryAgain', 'momentS1', 'momentS2', 'momentS3', 'close'] as const;
export type SfxCue = (typeof SFX_CUES)[number];
export const sfxPath = (cue: SfxCue): string => `/audio/sfx/${cue}.mp3`;

export const SFX_KEY = 'mizan.sfx';
export const SFX_VOLUME = 0.5;
export const SFX_VOLUME_UNDER_NARRATION = 0.3;

export interface AudioLike {
  volume: number;
  currentTime: number;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener?(type: 'ended' | 'error', fn: () => void): void;
}
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }

export class SfxPlayer {
  private available = new Set<SfxCue>();
  private recitation = false;
  private narration = 0;
  private running = new Set<AudioLike>();

  constructor(
    private readonly makeAudio: (src: string) => AudioLike | null,
    private readonly storage: () => StorageLike | null,
  ) {}

  setAvailable(cues: readonly string[]): void {
    this.available = new Set(cues.filter((c): c is SfxCue => (SFX_CUES as readonly string[]).includes(c)));
  }

  // Default on; only an explicit "off" turns effects off.
  enabled(): boolean {
    try { return this.storage()?.getItem(SFX_KEY) !== 'off'; } catch { return true; }
  }

  setEnabled(on: boolean): void {
    try { this.storage()?.setItem(SFX_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
    if (!on) this.stopAll();
  }

  play(cue: SfxCue): boolean {
    if (!this.enabled() || this.recitation || !this.available.has(cue)) return false;
    let a: AudioLike | null = null;
    try { a = this.makeAudio(sfxPath(cue)); } catch { return false; }
    if (!a) return false;
    a.volume = this.narration > 0 ? SFX_VOLUME_UNDER_NARRATION : SFX_VOLUME;
    this.running.add(a);
    const done = () => { if (a) this.running.delete(a); };
    a.addEventListener?.('ended', done);
    a.addEventListener?.('error', done);
    try {
      const p = a.play();
      if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(done);
    } catch { done(); }
    return true;
  }

  // Qur'an recitation: running effects stop, and none start until it ends.
  recitationStarted(): void { this.recitation = true; this.stopAll(); }
  recitationStopped(): void { this.recitation = false; }

  narrationStarted(): void { this.narration++; for (const a of this.running) a.volume = SFX_VOLUME_UNDER_NARRATION; }
  narrationStopped(): void {
    this.narration = Math.max(0, this.narration - 1);
    if (this.narration === 0) for (const a of this.running) a.volume = SFX_VOLUME;
  }

  stopAll(): void {
    for (const a of this.running) { try { a.pause(); a.currentTime = 0; } catch { /* ignore */ } }
    this.running.clear();
  }
}

export const sfx = new SfxPlayer(
  (src) => (typeof Audio === 'undefined' ? null : new Audio(src)),
  () => (typeof window === 'undefined' ? null : window.localStorage),
);

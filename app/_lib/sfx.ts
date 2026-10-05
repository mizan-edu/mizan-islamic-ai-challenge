// Sound design (D65; replaces the D38/D40 player). Seven natural sounds from ElevenLabs Sound Effects,
// normalised to a peak of about -3 dBFS (scripts/assets/mp3-gain.mjs): tap (a card press), aside (a
// card set aside), correct (a correct pick, at the start of the hero moment), rain / pour / grow (the
// S1 / S2 / S3 moments, with the clip, fading out over 0.5 s at its end) and ambience (a quiet loop on
// the map only, crossfaded at the loop point). Files: public/sfx/<cue>.mp3; a cue plays only if its
// file exists (the pages list them at build time), and a missing or failed file fails silently.
// Rules:
// - Nothing sounds before the first tap (autoplay): the Web Audio context is created on that gesture.
// - Narration comes first: effects sit 18 dB under full scale (narration plays at full volume) and
//   ambience 24 dB under; while narration plays effects drop 6 dB more and ambience 10 dB more.
// - Hard mute: no effect or ambience during a Qur'an recitation or anywhere on the verse-card step;
//   whatever is playing stops when either starts.
// - A parent switch turns sound off for this session only (sessionStorage; not child data).
// - Reduced motion does not mute sound. Every event is announced as a DOM event "mizan:sound" (cue
//   name only) so tests can observe what played; nothing is stored or sent.

export const SFX_CUES = ['tap', 'aside', 'correct', 'rain', 'pour', 'grow', 'ambience'] as const;
export type SfxCue = (typeof SFX_CUES)[number];
export type SceneCue = 'rain' | 'pour' | 'grow';
export const SCENE_CUE: Record<string, SceneCue> = { S1: 'rain', S2: 'pour', S3: 'grow' };
export const sfxPath = (cue: SfxCue): string => `/sfx/${cue}.mp3`;

export const SFX_KEY = 'mizan.sfx';
export const dbToGain = (db: number): number => Math.pow(10, db / 20);
export const LEVEL_DB = { effects: -18, ambience: -24, effectsDuck: -6, ambienceDuck: -10 } as const;
export const SCENE_FADE_S = 0.5;
export const AMBIENCE_CROSSFADE_S = 1;
const DUCK_RAMP_S = 0.15;
const STOP_RAMP_S = 0.08;
const STALE_MS = 250; // a one-shot that could not start within this long after its trigger is dropped

// The parts of Web Audio the engine uses (a fake implements them in the tests).
export interface ParamLike { value: number; setValueAtTime(v: number, t: number): void; linearRampToValueAtTime(v: number, t: number): void; cancelScheduledValues(t: number): void }
export interface NodeLike { connect(n: unknown): void; disconnect?(): void }
export interface GainLike extends NodeLike { gain: ParamLike }
export interface SourceLike extends NodeLike { buffer: unknown; loop?: boolean; onended: (() => void) | null; start(when?: number): void; stop(when?: number): void }
export interface BufferLike { duration: number }
export interface ContextLike {
  currentTime: number; destination: unknown; state?: string;
  createGain(): GainLike; createBufferSource(): SourceLike;
  decodeAudioData(data: ArrayBuffer): Promise<BufferLike>; resume?(): Promise<void> | void;
}
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }

interface Voice { src: SourceLike; gain: GainLike; bus: 'effects' | 'ambience'; cue: SfxCue }

export class SoundEngine {
  private available = new Set<SfxCue>();
  private ctx: ContextLike | null = null;
  private effectsBus: GainLike | null = null;
  private ambienceBus: GainLike | null = null;
  private buffers = new Map<SfxCue, Promise<BufferLike | null>>();
  private voices = new Set<Voice>();
  private scene: Voice | null = null;
  private recitation = false;
  private verseStep = false;
  private narration = 0;
  private ambienceWanted = false;
  private ambienceTimer: ReturnType<typeof setTimeout> | null = null;
  private installed = false;

  constructor(
    private readonly makeContext: () => ContextLike | null,
    private readonly fetchBytes: (src: string) => Promise<ArrayBuffer | null>,
    private readonly storage: () => StorageLike | null,
    private readonly announce: (cue: SfxCue, what: 'start' | 'stop') => void = () => {},
    private readonly clock: () => number = () => Date.now(),
  ) {}

  get unlocked(): boolean { return this.ctx !== null; }

  setAvailable(cues: readonly string[]): void {
    this.available = new Set(cues.filter((c): c is SfxCue => (SFX_CUES as readonly string[]).includes(c)));
  }

  // Waits for the first tap or key press anywhere on the page, then unlocks sound.
  install(target: Pick<Window, 'addEventListener' | 'removeEventListener'> | null = typeof window === 'undefined' ? null : window): void {
    if (this.installed || !target) return;
    this.installed = true;
    const handler = () => { this.unlock(); target.removeEventListener('pointerdown', handler, true); target.removeEventListener('keydown', handler, true); };
    target.addEventListener('pointerdown', handler, true);
    target.addEventListener('keydown', handler, true);
  }

  // Called from a user gesture: creates the context and loads the available cues.
  unlock(): void {
    if (this.ctx) return;
    let ctx: ContextLike | null = null;
    try { ctx = this.makeContext(); } catch { ctx = null; }
    if (!ctx) return;
    this.ctx = ctx;
    try { void ctx.resume?.(); } catch { /* ignore */ }
    this.effectsBus = ctx.createGain();
    this.ambienceBus = ctx.createGain();
    this.effectsBus.connect(ctx.destination);
    this.ambienceBus.connect(ctx.destination);
    this.applyLevels(0);
    for (const cue of this.available) void this.load(cue);
    if (this.ambienceWanted) void this.startAmbienceLoop();
  }

  // Session-only switch (default on).
  enabled(): boolean {
    try { return this.storage()?.getItem(SFX_KEY) !== 'off'; } catch { return true; }
  }

  setEnabled(on: boolean): void {
    try { this.storage()?.setItem(SFX_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
    if (!on) this.stopAll();
    else if (this.ambienceWanted) void this.startAmbienceLoop();
  }

  private blocked(): boolean { return !this.ctx || !this.enabled() || this.recitation || this.verseStep; }

  private load(cue: SfxCue): Promise<BufferLike | null> {
    let p = this.buffers.get(cue);
    if (!p) {
      p = (async () => {
        try {
          const bytes = await this.fetchBytes(sfxPath(cue));
          return bytes && this.ctx ? await this.ctx.decodeAudioData(bytes) : null;
        } catch { return null; }
      })();
      this.buffers.set(cue, p);
    }
    return p;
  }

  private startVoice(cue: SfxCue, buffer: BufferLike, bus: 'effects' | 'ambience', at: number, fadeInS = 0): Voice | null {
    const ctx = this.ctx;
    const out = bus === 'effects' ? this.effectsBus : this.ambienceBus;
    if (!ctx || !out) return null;
    try {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buffer;
      gain.gain.setValueAtTime(fadeInS > 0 ? 0 : 1, at);
      if (fadeInS > 0) gain.gain.linearRampToValueAtTime(1, at + fadeInS);
      src.connect(gain);
      gain.connect(out);
      const voice: Voice = { src, gain, bus, cue };
      src.onended = () => { this.voices.delete(voice); if (this.scene === voice) this.scene = null; };
      src.start(at);
      this.voices.add(voice);
      this.announce(cue, 'start');
      return voice;
    } catch { return null; }
  }

  private stopVoice(v: Voice, fadeS: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    try {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(v.gain.gain.value, t);
      v.gain.gain.linearRampToValueAtTime(0, t + fadeS);
      v.src.stop(t + fadeS + 0.02);
    } catch { /* already stopped */ }
    this.voices.delete(v);
    this.announce(v.cue, 'stop');
  }

  // A one-shot effect (tap, aside, correct). Returns whether it was allowed to start.
  play(cue: SfxCue): boolean {
    if (cue === 'ambience' || this.blocked() || !this.available.has(cue)) return false;
    const asked = this.clock();
    void this.load(cue).then((buf) => {
      if (!buf || this.blocked() || this.clock() - asked > STALE_MS) return;
      this.startVoice(cue, buf, 'effects', this.ctx!.currentTime);
    });
    return true;
  }

  // The moment sound: starts with the clip; fades out over 0.5 s at its end (fadeOutScene).
  startScene(cue: SceneCue): boolean {
    if (this.blocked() || !this.available.has(cue)) return false;
    void this.load(cue).then((buf) => {
      if (!buf || this.blocked()) return;
      if (this.scene) this.stopVoice(this.scene, STOP_RAMP_S);
      this.scene = this.startVoice(cue, buf, 'effects', this.ctx!.currentTime);
    });
    return true;
  }

  fadeOutScene(seconds = SCENE_FADE_S): void {
    if (this.scene) { this.stopVoice(this.scene, seconds); this.scene = null; }
  }

  // Ambience: a quiet loop on the map, crossfaded at the loop point; starts once sound is unlocked.
  startAmbience(): void {
    this.ambienceWanted = true;
    void this.startAmbienceLoop();
  }

  stopAmbience(): void {
    this.ambienceWanted = false;
    this.stopAmbienceVoices(0.3);
  }

  private stopAmbienceVoices(fadeS: number): void {
    if (this.ambienceTimer) { clearTimeout(this.ambienceTimer); this.ambienceTimer = null; }
    for (const v of [...this.voices]) if (v.bus === 'ambience') this.stopVoice(v, fadeS);
  }

  private async startAmbienceLoop(): Promise<void> {
    if (this.blocked() || !this.available.has('ambience') || [...this.voices].some((v) => v.bus === 'ambience')) return;
    const buf = await this.load('ambience');
    if (!buf || this.blocked() || !this.ambienceWanted || [...this.voices].some((v) => v.bus === 'ambience')) return;
    const xf = Math.min(AMBIENCE_CROSSFADE_S, buf.duration / 4);
    const schedule = (at: number) => {
      if (!this.ambienceWanted || this.blocked()) return;
      const v = this.startVoice('ambience', buf, 'ambience', at, xf);
      if (!v) return;
      // Fade out over the last crossfade, while the next pass fades in.
      v.gain.gain.setValueAtTime(1, at + buf.duration - xf);
      v.gain.gain.linearRampToValueAtTime(0, at + buf.duration);
      v.src.stop(at + buf.duration + 0.02);
      const next = at + buf.duration - xf;
      const wait = Math.max(0, (next - this.ctx!.currentTime - 0.25) * 1000);
      this.ambienceTimer = setTimeout(() => schedule(Math.max(next, this.ctx!.currentTime)), wait);
    };
    schedule(this.ctx!.currentTime);
  }

  // Hard mute: recitation and the verse-card step stop everything, and nothing starts until both end.
  recitationStarted(): void { this.recitation = true; this.stopAll(); }
  recitationStopped(): void { this.recitation = false; this.resumeAmbience(); }
  setVerseStep(on: boolean): void {
    if (on === this.verseStep) return;
    this.verseStep = on;
    if (on) this.stopAll(); else this.resumeAmbience();
  }
  private resumeAmbience(): void { if (this.ambienceWanted) void this.startAmbienceLoop(); }

  narrationStarted(): void { this.narration++; this.applyLevels(DUCK_RAMP_S); }
  narrationStopped(): void { this.narration = Math.max(0, this.narration - 1); this.applyLevels(DUCK_RAMP_S); }

  private applyLevels(rampS: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.effectsBus || !this.ambienceBus) return;
    const ducked = this.narration > 0;
    const fx = dbToGain(LEVEL_DB.effects + (ducked ? LEVEL_DB.effectsDuck : 0));
    const amb = dbToGain(LEVEL_DB.ambience + (ducked ? LEVEL_DB.ambienceDuck : 0));
    const t = ctx.currentTime;
    for (const [bus, v] of [[this.effectsBus, fx], [this.ambienceBus, amb]] as const) {
      bus.gain.cancelScheduledValues(t);
      if (rampS > 0) { bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(v, t + rampS); } else bus.gain.setValueAtTime(v, t);
    }
  }

  stopAll(): void {
    if (this.ambienceTimer) { clearTimeout(this.ambienceTimer); this.ambienceTimer = null; }
    for (const v of [...this.voices]) this.stopVoice(v, STOP_RAMP_S);
    this.scene = null;
  }
}

const browserContext = (): ContextLike | null => {
  if (typeof window === 'undefined') return null;
  const Ctor = (window as unknown as { AudioContext?: new () => ContextLike; webkitAudioContext?: new () => ContextLike }).AudioContext
    ?? (window as unknown as { webkitAudioContext?: new () => ContextLike }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
};

export const sfx = new SoundEngine(
  browserContext,
  async (src) => { const r = await fetch(src); return r.ok ? r.arrayBuffer() : null; },
  () => (typeof window === 'undefined' ? null : window.sessionStorage),
  (cue, what) => { try { document.dispatchEvent(new CustomEvent('mizan:sound', { detail: { cue, what } })); } catch { /* no DOM */ } },
);

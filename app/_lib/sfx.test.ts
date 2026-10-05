// Sound engine (D65) with a fake Web Audio context: nothing before the first tap; levels and ducking;
// hard mute during recitation and on the verse step (running sounds stop); the session mute switch;
// missing or failing files fail silently; the scene sound fades over 0.5 s; the ambience loop
// crossfades. No audio is played.

import { describe, expect, it } from 'vitest';
import { dbToGain, LEVEL_DB, SCENE_CUE, SFX_CUES, sfxPath, SoundEngine, type ContextLike, type StorageLike } from './sfx';

class FakeParam {
  value = 1;
  events: [string, number, number][] = [];
  setValueAtTime(v: number, t: number) { this.events.push(['set', v, t]); this.value = v; }
  linearRampToValueAtTime(v: number, t: number) { this.events.push(['ramp', v, t]); this.value = v; }
  cancelScheduledValues(t: number) { this.events.push(['cancel', 0, t]); }
}
class FakeGain { gain = new FakeParam(); connect() {} }
class FakeSource { buffer: unknown = null; onended: (() => void) | null = null; started: number | null = null; stopped: number | null = null; connect() {} start(t = 0) { this.started = t; } stop(t = 0) { this.stopped = t; } }
class FakeCtx implements ContextLike {
  currentTime = 0;
  destination = {};
  gains: FakeGain[] = [];
  sources: FakeSource[] = [];
  constructor(private duration = 1) {}
  createGain() { const g = new FakeGain(); this.gains.push(g); return g; }
  createBufferSource() { const s = new FakeSource(); this.sources.push(s); return s; }
  async decodeAudioData() { return { duration: this.duration }; }
  resume() {}
}

const flush = () => new Promise((r) => setTimeout(r, 0));
function setup({ duration = 1, failing = [] as string[], missing = [] as string[] } = {}) {
  const ctx = new FakeCtx(duration);
  const fetched: string[] = [];
  const events: string[] = [];
  const store = new Map<string, string>();
  const storage: StorageLike = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); } };
  const engine = new SoundEngine(
    () => ctx,
    async (src) => { fetched.push(src); if (failing.some((f) => src.includes(f))) throw new Error('network'); return missing.some((m) => src.includes(m)) ? null : new ArrayBuffer(8); },
    () => storage,
    (cue, what) => events.push(`${what}:${cue}`),
  );
  engine.setAvailable([...SFX_CUES]);
  return { ctx, engine, fetched, events, store };
}

describe('sound files and levels', () => {
  it('seven cues in public/sfx', () => {
    expect([...SFX_CUES]).toEqual(['tap', 'aside', 'correct', 'rain', 'pour', 'grow', 'ambience']);
    expect(sfxPath('rain')).toBe('/sfx/rain.mp3');
    expect(SCENE_CUE).toEqual({ S1: 'rain', S2: 'pour', S3: 'grow' });
  });

  it('effects 18 dB and ambience 24 dB under full scale; under narration 6 and 10 dB lower still', () => {
    const { ctx, engine } = setup();
    engine.unlock();
    const [fx, amb] = ctx.gains;
    expect(fx.gain.value).toBeCloseTo(dbToGain(-18), 5);
    expect(amb.gain.value).toBeCloseTo(dbToGain(-24), 5);
    expect(LEVEL_DB).toEqual({ effects: -18, ambience: -24, effectsDuck: -6, ambienceDuck: -10 });
    engine.narrationStarted();
    expect(fx.gain.value).toBeCloseTo(dbToGain(-24), 5);
    expect(amb.gain.value).toBeCloseTo(dbToGain(-34), 5);
    engine.narrationStopped();
    expect(fx.gain.value).toBeCloseTo(dbToGain(-18), 5);
  });
});

describe('autoplay: nothing before the first tap', () => {
  it('no context, no request and no sound until unlocked', async () => {
    const { ctx, engine, fetched, events } = setup();
    expect(engine.play('tap')).toBe(false);
    engine.startAmbience();
    await flush();
    expect(fetched).toEqual([]);
    expect(ctx.sources).toHaveLength(0);
    expect(events).toEqual([]);
    expect(engine.unlocked).toBe(false);
  });

  it('install() unlocks on the first pointerdown, then sound plays', async () => {
    const { engine, events } = setup();
    const listeners = new Map<string, () => void>();
    engine.install({ addEventListener: (t: string, fn: () => void) => listeners.set(t, fn), removeEventListener: (t: string) => listeners.delete(t) } as unknown as Window);
    listeners.get('pointerdown')!();
    expect(engine.unlocked).toBe(true);
    expect(engine.play('tap')).toBe(true);
    await flush();
    expect(events).toContain('start:tap');
  });
});

describe('hard mute', () => {
  it('recitation stops everything running and blocks new sounds until it ends', async () => {
    const { ctx, engine, events } = setup();
    engine.unlock();
    engine.startScene('rain');
    await flush();
    const rain = ctx.sources.at(-1)!;
    engine.recitationStarted();
    expect(rain.stopped).not.toBeNull();
    expect(engine.play('tap')).toBe(false);
    expect(engine.startScene('pour')).toBe(false);
    engine.recitationStopped();
    expect(engine.play('tap')).toBe(true);
    await flush();
    expect(events).toEqual(['start:rain', 'stop:rain', 'start:tap']);
  });

  it('the verse-card step stops running sounds and blocks every new one, ambience included', async () => {
    const { ctx, engine } = setup({ duration: 10 });
    engine.unlock();
    engine.startAmbience();
    await flush();
    const amb = ctx.sources.at(-1)!;
    engine.setVerseStep(true);
    expect(amb.stopped).not.toBeNull();
    const before = ctx.sources.length;
    expect(engine.play('tap')).toBe(false);
    expect(engine.startScene('grow')).toBe(false);
    await flush();
    expect(ctx.sources.length).toBe(before);
    engine.setVerseStep(false);
    await flush();
    expect(ctx.sources.length).toBe(before + 1); // the ambience comes back after the verse step
    engine.stopAmbience();
  });
});

describe('mute switch (session only)', () => {
  it('off: nothing plays and running sounds stop; default on', async () => {
    const { ctx, engine, store } = setup();
    expect(engine.enabled()).toBe(true);
    engine.unlock();
    engine.startScene('rain');
    await flush();
    const rain = ctx.sources.at(-1)!;
    engine.setEnabled(false);
    expect(store.get('mizan.sfx')).toBe('off');
    expect(rain.stopped).not.toBeNull();
    expect(engine.play('correct')).toBe(false);
    engine.setEnabled(true);
    expect(engine.play('correct')).toBe(true);
  });
});

describe('missing or failing files fail silently', () => {
  it('a 404, a network error or an unlisted cue start nothing and throw nothing', async () => {
    const { ctx, engine, events, fetched } = setup({ missing: ['tap'], failing: ['aside'] });
    engine.setAvailable(['tap', 'aside']);
    engine.unlock();
    expect(() => { engine.play('tap'); engine.play('aside'); engine.play('correct'); }).not.toThrow();
    await flush();
    expect(ctx.sources).toHaveLength(0);
    expect(events).toEqual([]);
    expect(fetched.some((f) => f.includes('correct'))).toBe(false); // not listed: never requested
  });
});

describe('scene sound and ambience', () => {
  it('the scene sound fades out over 0.5 s', async () => {
    const { ctx, engine } = setup();
    engine.unlock();
    engine.startScene('pour');
    await flush();
    const src = ctx.sources.at(-1)!;
    const gain = ctx.gains.at(-1)!;
    ctx.currentTime = 4.3;
    engine.fadeOutScene();
    expect(gain.gain.events).toContainEqual(['ramp', 0, 4.8]);
    expect(src.stopped).toBeCloseTo(4.82, 5);
  });

  it('the ambience loop crossfades: the next pass starts before the current one ends', async () => {
    const { ctx, engine } = setup({ duration: 0.4 }); // crossfade = min(1 s, duration / 4) = 0.1 s
    engine.unlock();
    engine.startAmbience();
    await flush();
    await new Promise((r) => setTimeout(r, 120));
    const passes = ctx.sources.filter((s) => s.started !== null);
    expect(passes.length).toBeGreaterThanOrEqual(2);
    expect(passes[0].started).toBe(0);
    expect(passes[1].started).toBeCloseTo(0.3, 5); // 0.4 - 0.1
    expect(passes[0].stopped).toBeCloseTo(0.42, 5);
    engine.stopAmbience();
  });
});

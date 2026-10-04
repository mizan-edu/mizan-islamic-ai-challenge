// Sound-effect rules (D38): never during a Qur'an recitation (running effects stop when it starts),
// the parent switch (default on, remembered), ducking under narration, missing files fail silently.

import { describe, expect, it, vi } from 'vitest';
import { SFX_KEY, SfxPlayer, type AudioLike, type StorageLike } from './sfx';

function setup(available = ['tap', 'correct', 'momentS1']) {
  const made: (AudioLike & { src: string; paused: boolean })[] = [];
  const store = new Map<string, string>();
  const storage: StorageLike = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); } };
  const player = new SfxPlayer((src) => {
    const a = { src, volume: 1, currentTime: 0, paused: true, play: vi.fn(async () => { a.paused = false; }), pause: vi.fn(() => { a.paused = true; }) };
    made.push(a);
    return a;
  }, () => storage);
  player.setAvailable(available);
  return { player, made, store };
}

describe('sound effects', () => {
  it('play available cues at volume 0.5 from public/audio/sfx', () => {
    const { player, made } = setup();
    expect(player.play('tap')).toBe(true);
    expect(made[0]).toMatchObject({ src: '/audio/sfx/tap.mp3', volume: 0.5 });
  });

  it('never play during a Qur\'an recitation, and a running effect stops when recitation starts', () => {
    const { player, made } = setup();
    player.play('momentS1');
    expect(made[0].paused).toBe(false);
    player.recitationStarted();
    expect(made[0].pause).toHaveBeenCalled();
    expect(made[0].currentTime).toBe(0);
    expect(player.play('tap')).toBe(false);
    expect(made).toHaveLength(1); // nothing created while reciting
    player.recitationStopped();
    expect(player.play('tap')).toBe(true);
  });

  it('the parent switch: on by default, off stops effects and is remembered on the device', () => {
    const { player, made, store } = setup();
    expect(player.enabled()).toBe(true);
    player.play('tap');
    player.setEnabled(false);
    expect(store.get(SFX_KEY)).toBe('off');
    expect(made[0].pause).toHaveBeenCalled();
    expect(player.play('correct')).toBe(false);
    player.setEnabled(true);
    expect(store.get(SFX_KEY)).toBe('on');
    expect(player.play('correct')).toBe(true);
  });

  it('lowers to 0.3 while narration plays and returns to 0.5 after', () => {
    const { player, made } = setup();
    player.play('tap');
    player.narrationStarted();
    expect(made[0].volume).toBe(0.3);
    player.play('correct');
    expect(made[1].volume).toBe(0.3);
    player.narrationStopped();
    expect(made.map((a) => a.volume)).toEqual([0.5, 0.5]);
  });

  it('missing files fail silently: unavailable cues make no request; play errors are swallowed', () => {
    const { player, made } = setup(['tap']);
    expect(player.play('close')).toBe(false);
    expect(made).toHaveLength(0);
    const broken = new SfxPlayer(() => ({ volume: 1, currentTime: 0, play: () => Promise.reject(new Error('404')), pause: () => {} }), () => null);
    broken.setAvailable(['tap']);
    expect(() => broken.play('tap')).not.toThrow();
  });

  it('storage that throws (private mode) keeps effects on and never breaks the app', () => {
    const p = new SfxPlayer(() => null, () => { throw new Error('denied'); });
    expect(p.enabled()).toBe(true);
    expect(() => p.setEnabled(false)).not.toThrow();
  });
});

describe('parent switch (rendered)', () => {
  it('renders as an accessible switch, on by default, with the approved label', async () => {
    const { renderToString } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { default: SfxSwitch } = await import('@/app/_components/SfxSwitch');
    const { loadLabels } = await import('./labels');
    const label = loadLabels().sfx!;
    expect(label).toBeTruthy();
    const html = renderToString(createElement(SfxSwitch, { label }));
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('data-sfx-switch="on"');
  });
});

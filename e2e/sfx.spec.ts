// Sound design (D65) in the browser. Each effect the engine starts or stops is observed through its
// "mizan:sound" DOM event, with the station step on screen at that moment. The recitation is stood in
// for (its play fires the element's play event; no request leaves the app). Checks: the files are
// served; nothing sounds or loads before the first tap; the cues fire where they should; nothing on the
// verse step or during a recitation; the session mute switch; missing files break nothing.
// Reads IDs from /content; never prints record text.

import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const CUES = ['tap', 'aside', 'correct', 'rain', 'pour', 'grow', 'ambience'];
interface Script { step: string; correctChoiceId?: string; choiceIds?: string[] }
const observe = (id: string) => (JSON.parse(readFileSync(`content/stations/${id}.json`, 'utf8')) as { script: Script[] }).script.find((s) => s.step === 'observe')!;
interface Sound { cue: string; what: string; step: string }

test.beforeEach(async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __sounds: Sound[]; __sfxRequests: number };
    w.__sounds = [];
    document.addEventListener('mizan:sound', (e) => {
      const d = (e as CustomEvent<{ cue: string; what: string }>).detail;
      w.__sounds.push({ cue: d.cue, what: d.what, step: document.querySelector('main')?.getAttribute('data-step') ?? document.querySelector('main')?.getAttribute('data-screen') ?? '' });
    });
    // Recitation stand-in: a verse card's audio "plays" without loading anything.
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (this.closest('[data-verse]')) { queueMicrotask(() => this.dispatchEvent(new Event('play'))); return Promise.resolve(); }
      return play.call(this);
    };
    interface Sound { cue: string; what: string; step: string }
  });
  await page.route((url) => !url.href.startsWith(baseURL!), (r) => r.abort());
});

const sounds = (page: Page) => page.evaluate(() => (window as unknown as { __sounds: Sound[] }).__sounds.slice());
const started = async (page: Page) => (await sounds(page)).filter((s) => s.what === 'start');

test('every sound file is served as MP3', async ({ request }) => {
  for (const cue of CUES) {
    const r = await request.get(`/sfx/${cue}.mp3`);
    expect(r.status(), cue).toBe(200);
    expect(r.headers()['content-type'], cue).toContain('audio/mpeg');
  }
});

test('nothing sounds or loads before the first tap; the map ambience starts after it', async ({ page }) => {
  const sfxRequests: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/sfx/')) sfxRequests.push(r.url()); });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  expect(await sounds(page)).toEqual([]);
  expect(sfxRequests).toEqual([]);
  await page.locator('[data-station="S1"] button').click(); // the first tap
  await expect.poll(async () => (await started(page)).map((s) => s.cue), { timeout: 5000 }).toContain('ambience');
  expect((await started(page)).every((s) => s.cue === 'ambience' || s.cue === 'tap')).toBe(true);
  // The ambience belongs to the map only.
  await page.locator('[data-action="start-station"]').click();
  await expect(page.locator('[data-screen="frame"]')).toBeVisible();
  await expect.poll(async () => (await sounds(page)).some((s) => s.cue === 'ambience' && s.what === 'stop')).toBe(true);
});

test('S1: tap on card press, aside, correct, then rain with the clip; nothing on the verse step', async ({ page }) => {
  const ob = observe('S1');
  const wrong = ob.choiceIds!.find((c) => c !== ob.correctChoiceId)!;
  await page.goto('/stations/S1');
  await page.locator('[data-action="start"]').click();
  await page.locator(`[data-record="${wrong}"]`).click();
  await expect.poll(async () => (await started(page)).map((s) => s.cue)).toEqual(expect.arrayContaining(['tap', 'aside']));
  await page.locator(`[data-record="${ob.correctChoiceId}"]`).click();
  await expect.poll(async () => (await started(page)).map((s) => s.cue)).toEqual(expect.arrayContaining(['correct']));
  const moment = page.locator('[data-moment="S1"]');
  await expect(moment).toHaveAttribute('data-moment-video', 'playing', { timeout: 5000 });
  await expect.poll(async () => (await started(page)).map((s) => s.cue)).toContain('rain');
  await expect(page.locator('[data-strip="praise"]')).toBeVisible({ timeout: 10_000 });
  expect((await sounds(page)).some((s) => s.cue === 'rain' && s.what === 'stop')).toBe(true); // faded at the clip's end
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-screen="connect"]')).toBeVisible();
  const before = (await started(page)).length;
  expect((await started(page)).filter((s) => s.cue === 'tap').length).toBeGreaterThanOrEqual(3); // Next taps do sound off the verse step
  await page.waitForTimeout(1000);
  expect((await started(page)).slice(before)).toEqual([]); // nothing while on the verse step
  await page.locator('[data-action="next"]').click(); // the verse step's own Next: its tap is muted
  await expect(page.locator('[data-screen="ask"]')).toBeVisible();
  await page.waitForTimeout(500);
  expect((await started(page)).slice(before).map((s) => s.cue)).not.toContain('tap');
});

test('no sound while a recitation plays', async ({ page }) => {
  const ob = observe('S1');
  await page.goto('/stations/S1');
  await page.locator('[data-action="start"]').click();
  await page.locator(`[data-record="${ob.correctChoiceId}"]`).click();
  await page.locator('[data-moment="S1"]').click();
  await page.locator('[data-action="next"]').click();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-screen="ask"]')).toBeVisible();
  // Ask until a reply carries a verse card, then start its recitation.
  for (const q of await page.locator('[data-question]').all()) {
    await q.click();
    await expect(page.locator('[data-answer]')).toBeVisible();
    if (await page.locator('[data-answer] [data-recitation]').count()) break;
  }
  await page.locator('[data-answer] [data-recitation]').first().click();
  await expect(page.locator('[data-answer] [data-recitation]').first()).toHaveAttribute('data-playing', 'true');
  const before = (await started(page)).length;
  expect((await started(page)).slice(0, before).filter((s) => s.cue === 'tap' && s.step === 'ask').length).toBeGreaterThan(0); // question taps sound without a recitation
  await page.locator('[data-question]').first().click(); // its tap sound is asked for while the recitation plays
  await page.waitForTimeout(400);
  expect((await started(page)).slice(before).map((s) => s.cue)).not.toContain('tap');
});

test('the parent mute switch silences everything for this session only', async ({ page, browser }) => {
  await page.goto('/parent');
  const sw = page.locator('[data-sfx-switch]');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => [sessionStorage.getItem('mizan.sfx'), localStorage.getItem('mizan.sfx')])).toEqual(['off', null]);
  await page.goto('/stations/S1');
  await page.locator('[data-action="start"]').click();
  await page.locator(`[data-record="${observe('S1').correctChoiceId}"]`).click();
  await expect(page.locator('[data-moment="S1"]')).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await started(page)).toEqual([]);
  // A new session starts with sound on.
  const fresh = await browser.newPage();
  await fresh.goto('/parent');
  await expect(fresh.locator('[data-sfx-switch]')).toHaveAttribute('aria-checked', 'true');
  await fresh.close();
});

test('missing sound files break nothing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/sfx/*.mp3', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await page.locator('[data-station="S1"] button').click();
  await page.goto('/stations/S1');
  await page.locator('[data-action="start"]').click();
  await page.locator(`[data-record="${observe('S1').correctChoiceId}"]`).click();
  await expect(page.locator('[data-strip="praise"]')).toBeVisible({ timeout: 12_000 });
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-screen="connect"]')).toBeVisible();
  expect(await started(page)).toEqual([]);
  expect(errors).toEqual([]);
});

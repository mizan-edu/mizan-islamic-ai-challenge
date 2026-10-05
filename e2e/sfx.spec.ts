// Sound effects with the delivered files (D38, D40): every cue is served, effects play on taps, none
// plays while a Qur'an recitation is on (and they come back when the child leaves the verse), and the
// parent switch turns them all off. The recitation is stood in for (no request leaves the app), so
// the test needs no network. Reads IDs from /content; never prints record text.

import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const CUES = ['tap', 'correct', 'tryAgain', 'momentS1', 'momentS2', 'momentS3', 'close'];
interface Script { step: string; correctChoiceId?: string; choiceIds?: string[] }
const observe = (id: string) => (JSON.parse(readFileSync(`content/stations/${id}.json`, 'utf8')) as { script: Script[] }).script.find((s) => s.step === 'observe')!;

test.beforeEach(async ({ page, baseURL }) => {
  // Record each effect started; recitation audio (inside a verse card) is stood in for: its play
  // fires the element's play event and resolves, so the app sees a running recitation.
  await page.addInitScript(() => {
    const w = window as unknown as { __sfx: string[] };
    w.__sfx = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      const src = this.currentSrc || this.src || '';
      if (src.includes('/audio/sfx/')) w.__sfx.push(src.split('/').pop()!.replace('.mp3', ''));
      if (this.closest('[data-verse]')) { queueMicrotask(() => this.dispatchEvent(new Event('play'))); return Promise.resolve(); }
      return play.call(this);
    };
  });
  await page.route((url) => !url.href.startsWith(baseURL!), (r) => r.abort());
});

const played = (page: Page) => page.evaluate(() => (window as unknown as { __sfx: string[] }).__sfx.slice());

async function solveObserve(page: Page, id: string) {
  const ob = observe(id);
  await page.goto(`/stations/${id}`);
  await page.locator('[data-action="start"]').click();
  await page.locator(`[data-record="${ob.choiceIds!.find((c) => c !== ob.correctChoiceId)}"]`).click();
  await page.locator(`[data-record="${ob.correctChoiceId}"]`).click();
}

test('every cue is served as an MP3', async ({ request }) => {
  for (const cue of CUES) {
    const r = await request.get(`/audio/sfx/${cue}.mp3`);
    expect(r.status(), cue).toBe(200);
    expect(r.headers()['content-type'], cue).toContain('audio/mpeg');
  }
});

test('effects play on taps, never during a recitation, and come back after the verse', async ({ page }) => {
  await solveObserve(page, 'S1');
  const moment = page.locator('[data-moment="S1"]');
  await expect(moment).toBeVisible();
  await moment.click(); // skip
  expect(await played(page)).toEqual(['tap', 'tryAgain', 'correct', 'momentS1']);

  await page.locator('[data-action="next"]').click(); // -> connect (tap)
  await expect(page.locator('[data-screen="connect"]')).toBeVisible();
  const before = (await played(page)).length;
  await page.locator('[data-screen="connect"] [data-recitation]').click(); // recitation starts
  await page.locator('[data-action="next"]').click(); // tap during the recitation: silent
  expect((await played(page)).slice(before), 'no effect during a recitation').toEqual([]);

  // Leaving the verse ended the recitation: the next tap is heard again.
  await expect(page.locator('[data-screen="ask"]')).toBeVisible();
  await page.locator('[data-question]').first().click();
  expect((await played(page)).slice(before)).toEqual(['tap']);
});

test('the parent switch turns every effect off', async ({ page }) => {
  await page.goto('/parent');
  const sw = page.locator('[data-sfx-switch]');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await expect(sw).toHaveAttribute('aria-checked', 'false'); // remembered on the device

  await solveObserve(page, 'S1');
  await page.locator('[data-moment="S1"]').click();
  await page.locator('[data-action="next"]').click();
  expect(await played(page)).toEqual([]);
});

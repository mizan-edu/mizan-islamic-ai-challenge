// Static story mode (D47) and «إعادة البدء». Media is stood in for (each play ends after 150 ms), so a
// whole story runs in seconds without network: the test records every step and every media start,
// then checks the order, that no choice ever appears, that the verse plays only the real recitation
// with no effect during it, and that no progress is saved. Reset: confirm step, then the device's
// journey progress is gone. Screenshot docs/screenshots/story-S1.png. Never prints record text.

import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface Script { step: string; correctChoiceId?: string; choiceIds?: string[] }
const observe = (id: string) => (JSON.parse(readFileSync(`content/stations/${id}.json`, 'utf8')) as { script: Script[] }).script.find((s) => s.step === 'observe')!;

test.beforeEach(async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __media: { src: string; at: number }[]; __sounds: { cue: string; at: number; step: string }[]; __steps: string[]; __choices: number };
    w.__media = [];
    w.__sounds = [];
    // Every effect the sound engine starts (D65), with the story step on screen at that moment.
    document.addEventListener('mizan:sound', (e) => {
      const d = (e as CustomEvent<{ cue: string; what: string }>).detail;
      if (d.what === 'start') w.__sounds.push({ cue: d.cue, at: performance.now(), step: document.querySelector('[data-screen="story"]')?.getAttribute('data-story-step') ?? '' });
    });
    w.__steps = [];
    w.__choices = 0;
    // Every change of the story step, recorded in the page (none can be missed), with a choice check.
    new MutationObserver(() => {
      const el = document.querySelector('[data-screen="story"]');
      const key = el?.getAttribute('data-story-step');
      if (key && w.__steps.at(-1) !== key) w.__steps.push(key);
      w.__choices += document.querySelectorAll('[data-record], [data-action="hint"], [data-action="next"], [data-question]').length;
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-story-step'] });
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      w.__media.push({ src: this.currentSrc || this.src || '', at: performance.now() });
      queueMicrotask(() => this.dispatchEvent(new Event('play')));
      setTimeout(() => this.dispatchEvent(new Event('ended')), 150);
      return Promise.resolve();
    };
  });
  await page.route((url) => !url.href.startsWith(baseURL!), (r) => r.abort());
});

test('story S1 plays every step in order, shows no choices, recitation only for the verse', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/story/S1');
  await expect(page.locator('[data-story-step="start"]')).toBeVisible();
  await page.locator('[data-story-start]').click();
  await expect(page.locator('[data-screen="story"][data-story-step^="verse:"]')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'docs/screenshots/story-S1.png', fullPage: true });
  await expect(page.locator('[data-screen="story"][data-story-step="done"]')).toBeVisible({ timeout: 60_000 });
  const seen = await page.evaluate(() => (window as unknown as { __steps: string[] }).__steps);
  expect(await page.evaluate(() => (window as unknown as { __choices: number }).__choices), 'choices, hints, questions or Next ever shown').toBe(0);
  expect(seen[0]).toBe('start');
  expect(seen.at(-1)).toBe('done');
  const ob = observe('S1');
  const kinds = seen.slice(1, -1).map((k) => k.split(':')[0]);
  expect(kinds[0]).toBe('frame');
  expect(seen).toContain(`answer:${ob.correctChoiceId}`);
  for (const wrong of (ob.choiceIds ?? []).filter((c) => c !== ob.correctChoiceId)) expect(seen.join(' ')).not.toContain(wrong);
  const order = ['frame', 'question', 'answer', 'card', 'verse', 'explanation', 'close'];
  expect(kinds.map((k) => order.indexOf(k))).toEqual([...kinds.map((k) => order.indexOf(k))].sort((a, b) => a - b));

  // Media: the verse is the real recitation (mp3quran), never a narration file; no effect while it plays.
  const media = await page.evaluate(() => (window as unknown as { __media: { src: string; at: number }[] }).__media);
  const verseKey = seen.find((k) => k.startsWith('verse:'))!;
  const verseId = verseKey.split(':')[1];
  expect(media.some((m) => /mp3quran\.net/.test(m.src))).toBe(true);
  expect(media.some((m) => m.src.includes(`/audio/S1/${verseId}.`))).toBe(false);
  const rec = media.find((m) => /mp3quran\.net/.test(m.src))!;
  // D65: no effect during the recitation, nor anywhere on the verse step.
  const sounds = await page.evaluate(() => (window as unknown as { __sounds: { cue: string; at: number; step: string }[] }).__sounds);
  expect(sounds.filter((x) => x.at > rec.at && x.at < rec.at + 150)).toEqual([]);
  expect(sounds.filter((x) => x.step.startsWith('verse:'))).toEqual([]);

  // No progress saved.
  expect(await page.evaluate(() => sessionStorage.getItem('mizan.progress'))).toBeNull();
});

test('«إعادة البدء» clears this device\'s journey progress after a confirm step', async ({ page }) => {
  await page.goto('/parent');
  await page.evaluate(() => {
    sessionStorage.setItem('mizan.progress', JSON.stringify(['S1', 'S2']));
    sessionStorage.setItem('mizan.events', JSON.stringify([{ stationId: 'S1', event: 'answered', sourceIds: ['S1.Q1'], t: 1 }]));
    sessionStorage.setItem('mizan.sfx', 'off'); // the sound switch is session-only (D65)
  });
  await page.reload();
  await expect(page.locator('[data-story-link="S1"]')).toHaveAttribute('href', '/story/S1');
  await page.locator('[data-reset-start]').click();
  await expect(page.locator('[data-reset-confirm]')).toBeVisible();
  await page.locator('[data-reset-cancel]').click(); // cancel keeps everything
  expect(await page.evaluate(() => sessionStorage.getItem('mizan.progress'))).not.toBeNull();
  await page.locator('[data-reset-start]').click();
  await page.locator('[data-reset-confirm]').click();
  await expect(page.locator('[data-reset-done]')).toBeVisible();
  expect(await page.evaluate(() => [sessionStorage.getItem('mizan.progress'), sessionStorage.getItem('mizan.events')])).toEqual([null, null]);
  expect(await page.evaluate(() => sessionStorage.getItem('mizan.sfx'))).toBe('off'); // settings kept
  await page.goto('/');
  await expect(page.locator('[data-station="S1"]')).toHaveAttribute('data-state', 'current');
});

test('story mode is not linked from the journey map', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('a[href^="/story/"]').count()).toBe(0);
});

// Phase 7a (D60, D62) in the browser: the moment clip plays after the expansion and the moment lasts as
// long as the clip; a clip that runs past 6 s is cut at 6 s; a missing clip falls back to the still and
// the CSS layer; reduced motion and data saver show stills only; the map loop sits behind stones that
// stay tappable and still; nothing plays on the verse-card step. Reads IDs from /content.

import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const correct = (id: string) => (JSON.parse(readFileSync(`content/stations/${id}.json`, 'utf8')) as { script: { step: string; correctChoiceId?: string }[] }).script.find((s) => s.step === 'observe')!.correctChoiceId!;

// Taps the right card; returns the ms from the moment opening to the praise line.
async function momentLength(page: Page, id: string): Promise<number> {
  await page.goto(`/stations/${id}`);
  await page.locator('[data-action="start"]').click();
  await page.locator(`[data-record="${correct(id)}"]`).click();
  const moment = page.locator(`[data-moment="${id}"]`);
  await expect(moment).toBeVisible();
  const t0 = Date.now();
  await expect(page.locator('[data-strip="praise"]')).toBeVisible({ timeout: 15_000 });
  return Date.now() - t0;
}

test('each moment plays its clip and lasts as long as the clip (4.33 s), not the old fixed hold', async ({ page }) => {
  for (const id of ['S1', 'S2', 'S3']) {
    await page.goto(`/stations/${id}`);
    await page.locator('[data-action="start"]').click();
    await expect(page.locator(`[data-video-preload="${id}"]`)).toHaveCount(1); // preloaded while observing
    await page.locator(`[data-record="${correct(id)}"]`).click();
    const moment = page.locator(`[data-moment="${id}"]`);
    await expect(moment).toHaveAttribute('data-moment-video', /ready|playing/);
    await expect(moment).toHaveAttribute('data-moment-video', 'playing', { timeout: 5000 });
    const t0 = Date.now();
    await expect(moment).toHaveAttribute('data-moment-video', 'ended', { timeout: 8000 });
    const played = Date.now() - t0;
    expect(played, `${id} clip time`).toBeGreaterThan(3800);
    expect(played, `${id} clip time`).toBeLessThan(5200);
    await expect(page.locator('[data-strip="praise"]')).toBeVisible({ timeout: 3000 });
  }
});

test('D62 cap: a clip that has not ended by 6 s is stopped and the moment ends', async ({ page }) => {
  // Hide the clip's end from the app, as if the clip were longer than 6 s.
  await page.addInitScript(() => window.addEventListener('ended', (e) => e.stopImmediatePropagation(), true));
  const ms = await momentLength(page, 'S1');
  expect(ms).toBeGreaterThan(6000); // expansion 560 ms + cap 6000 ms + fade 600 ms
  expect(ms).toBeLessThan(8500);
});

test('a missing clip: the moment keeps the still, the CSS layer and the D38 timing', async ({ page }) => {
  await page.route('**/video/S1.*', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto('/stations/S1');
  await page.locator('[data-action="start"]').click();
  await page.locator(`[data-record="${correct('S1')}"]`).click();
  const moment = page.locator('[data-moment="S1"]');
  await expect(moment).toHaveAttribute('data-moment-video', 'error', { timeout: 5000 });
  await expect(moment.locator('[data-moment-live="S1"]')).toBeAttached();
  await expect(moment.locator('img[src="/images/S1/S1.N1.webp"]').first()).toBeAttached();
  await expect(page.locator('[data-strip="praise"]')).toBeVisible({ timeout: 8000 });
});

for (const mode of ['reduced motion', 'data saver'] as const) {
  test(`${mode}: stills only — no video on the map or in any moment`, async ({ page }) => {
    if (mode === 'reduced motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    else await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true }));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(await page.locator('video').count()).toBe(0);
    for (const id of ['S1', 'S2', 'S3']) {
      await page.goto(`/stations/${id}`);
      await page.locator('[data-action="start"]').click();
      await page.locator(`[data-record="${correct(id)}"]`).click();
      const moment = page.locator(`[data-moment="${id}"]`);
      await expect(moment).toHaveAttribute('data-moment-video', 'off');
      expect(await page.locator('video').count()).toBe(0);
      await moment.click();
    }
    const videoRequests: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/video/')) videoRequests.push(r.url()); });
    await page.goto('/stations/S1');
    await page.waitForLoadState('networkidle');
    expect(videoRequests).toEqual([]);
  });
}

test('map: the clip loops behind the stones; the stones stay still and tappable', async ({ page }) => {
  await page.goto('/');
  const clip = page.locator('[data-map-video]');
  await expect(clip).toHaveCount(1);
  await expect.poll(() => clip.evaluate((v) => (v as HTMLVideoElement).currentTime), { timeout: 5000 }).toBeGreaterThan(0.2);
  expect(await clip.evaluate((v) => [(v as HTMLVideoElement).loop, (v as HTMLVideoElement).muted, getComputedStyle(v).pointerEvents])).toEqual([true, true, 'none']);
  const stone = page.locator('[data-station="S1"] button');
  const before = await stone.boundingBox();
  await page.waitForTimeout(1500);
  expect(await stone.boundingBox()).toEqual(before);
  await stone.click(); // reachable through the video layer
  await expect(page.locator('[data-selected="S1"]')).toBeVisible();
});

test('nothing plays on the verse-card step', async ({ page }) => {
  await page.goto('/stations/S1');
  await page.locator('[data-action="start"]').click();
  await page.locator(`[data-record="${correct('S1')}"]`).click();
  await page.locator('[data-moment="S1"]').click();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-screen="connect"]')).toBeVisible();
  expect(await page.locator('video').count()).toBe(0);
});

// Glass-box view (D60) in the browser. Uses only rule-path inputs (F02, B08 and the child's pre-written
// questions), so no model is called. Checks: the request body; the replay pace (>= 400 ms per step,
// measured in the page); the real states after the replay; the child counter stays at 0; the laptop
// and tablet layouts; reduced motion moves nothing; axe passes once the replay is done. Screenshots:
// docs/screenshots/glass-*.png. Reads IDs from /content; never prints record text.

import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const SHOTS = 'docs/screenshots';
const AXE = join(process.cwd(), 'node_modules/axe-core/axe.min.js');
const moving = (page: Page) => page.evaluate(() => document.getAnimations()
  .filter((a) => a.playState === 'running')
  .filter((a) => (a.effect as KeyframeEffect | null)?.getKeyframes().some((k) => Object.keys(k).some((p) => !['offset', 'easing', 'composite', 'computedOffset', 'opacity'].includes(p))) ?? true)
  .length);

// Records when each step is revealed, from the page's own clock.
async function watchReplay(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { revealTimes: number[] };
    w.revealTimes = [];
    const ol = document.querySelector('[data-glass-pipeline]')!;
    new MutationObserver(() => w.revealTimes.push(performance.now())).observe(ol, { attributes: true, attributeFilter: ['data-revealed'] });
  });
}

test('F02 preset: sends the item ID only, replays at >= 400 ms per step, shows the real path', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/glass');
  await watchReplay(page);
  const request = page.waitForRequest((r) => r.url().endsWith('/api/try'));
  await page.locator('[data-glass-preset="F02"]').click();
  const body = JSON.parse((await request).postData() ?? '{}') as Record<string, unknown>;
  expect(Object.keys(body).sort()).toEqual(['itemId', 'stationId']);
  expect(body.itemId).toBe('F02');

  await expect(page.locator('[data-glass-pipeline]')).toHaveAttribute('data-revealed', '7', { timeout: 10_000 });
  const times = await page.evaluate(() => (window as unknown as { revealTimes: number[] }).revealTimes);
  const gaps = times.slice(2).map((t, i) => t - times[i + 1]); // steps 2..7, after the first reveal
  for (const g of gaps) expect(g).toBeGreaterThanOrEqual(400);

  await expect(page.locator('[data-glass-step="classifier"]')).toHaveAttribute('data-glass-state', 'skipped');
  await expect(page.locator('[data-glass-step="rules"]')).toHaveAttribute('data-glass-state', 'decided');
  await expect(page.locator('[data-glass-step="output"]')).toHaveAttribute('data-glass-tone', 'amber');
  await expect(page.locator('[data-glass-replay]')).toBeVisible();
  await expect(page.locator('[data-glass-reply="referral"]')).toBeVisible();

  // Laptop: the input side on the left, the pipeline on the right.
  const input = (await page.locator('[data-glass-input]').boundingBox())!;
  const pipe = (await page.locator('[data-glass-pipeline-section]').boundingBox())!;
  expect(input.x).toBeLessThan(pipe.x);
  await page.screenshot({ path: `${SHOTS}/glass-laptop-f02.png`, fullPage: true });

  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
  await page.addScriptTag({ path: AXE });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: Document, o: object) => Promise<{ violations: { id: string; nodes: unknown[] }[] }> } }).axe;
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    return r.violations.map((v) => `${v.id} (${v.nodes.length})`);
  });
  expect(violations).toEqual([]);
});

test('child mode: pre-written questions take the rule path; the model-call counter stays at 0', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/glass');
  await page.locator('[data-glass-tab="child"]').click();
  const counter = page.locator('[data-child-calls]');
  await expect(counter).toHaveAttribute('data-child-calls', '0');
  for (const station of ['S1', 'S2', 'S3']) {
    await page.locator('[data-glass-child-station]').selectOption(station);
    const before = Number(await counter.getAttribute('data-child-taps'));
    const request = page.waitForResponse((r) => r.url().includes('/api/ask?judge=1'));
    await page.locator('[data-glass-question]').first().click();
    await request;
    await expect(counter).toHaveAttribute('data-child-taps', String(before + 1));
    await expect(page.locator('[data-glass-pipeline]')).toHaveAttribute('data-revealed', '7', { timeout: 10_000 });
    await expect(page.locator('[data-glass-step="classifier"]')).toHaveAttribute('data-glass-state', 'skipped');
  }
  await expect(counter).toHaveAttribute('data-child-calls', '0');
  // The child route's session event is not stored by this page.
  expect(await page.evaluate(() => sessionStorage.getItem('mizan.events'))).toBeNull();

  // Tablet: the pipeline stacks below the input.
  const input = (await page.locator('[data-glass-input]').boundingBox())!;
  const pipe = (await page.locator('[data-glass-pipeline-section]').boundingBox())!;
  expect(pipe.y).toBeGreaterThan(input.y + input.height - 1);
  await page.screenshot({ path: `${SHOTS}/glass-tablet-child.png`, fullPage: true });
});

test('reduced motion: steps change state without any movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/glass');
  await page.locator('[data-glass-preset="B08"]').click();
  for (let i = 0; i < 6; i++) { expect(await moving(page)).toBe(0); await page.waitForTimeout(250); }
  await expect(page.locator('[data-glass-pipeline]')).toHaveAttribute('data-revealed', '7', { timeout: 10_000 });
  await expect(page.locator('[data-glass-reply="fallback"]')).toBeVisible();
  expect(await moving(page)).toBe(0);
});

test('linked from the evaluation page, and from the parent page behind the gate', async ({ page }) => {
  await page.goto('/evaluation');
  await expect(page.locator('[data-glass-link]')).toHaveAttribute('href', '/glass');
  await page.goto('/parent');
  await expect(page.locator('[data-glass-link]')).toHaveCount(0);
  for (const d of [7, 3, 9]) await page.locator(`[data-gate-key="${d}"]`).click();
  await expect(page.locator('[data-glass-link]')).toHaveAttribute('href', '/glass');
});

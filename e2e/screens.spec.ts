// «حديقة الآيات» screens: one screenshot per screen (docs/screenshots), plus checks that hold on every
// screen: no request leaves the app's origin (no font CDN), no horizontal scroll at tablet or phone
// width, and under prefers-reduced-motion nothing moves (only opacity cross-fades, D54). Reads IDs from /content; never
// prints record text.

import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const SHOTS = 'docs/screenshots';
const PHONE = { width: 390, height: 844 };

interface Script { step: string; correctChoiceId?: string; choiceIds?: string[]; mode?: string; expectedOrder?: string[]; narrationCardIds?: string[]; scoringNote?: string }
const script = (id: string): Script[] => (JSON.parse(readFileSync(`content/stations/${id}.json`, 'utf8')) as { script: Script[] }).script;
const observe = (id: string) => script(id).find((s) => s.step === 'observe')!;
const narrate = (id: string) => script(id).find((s) => s.step === 'narrate')!;

// Same rule as bestCardFromNote in app/_lib/station-view.ts.
function narrationPicks(id: string): string[] {
  const n = narrate(id);
  if (n.mode === 'order') return n.expectedOrder ?? n.narrationCardIds ?? [];
  let best: { id: string; score: number } | null = null;
  for (const m of (n.scoringNote ?? '').matchAll(/(S\d+\.N\d+)\s*=\s*(\d)/g)) {
    if ((n.narrationCardIds ?? []).includes(m[1]) && (!best || Number(m[2]) > best.score)) best = { id: m[1], score: Number(m[2]) };
  }
  return best ? [best.id] : [];
}

const offOrigin: string[] = [];
test.beforeEach(({ page, baseURL }) => {
  page.on('request', (r) => { if (!r.url().startsWith(baseURL!) && !r.url().startsWith('data:')) offOrigin.push(new URL(r.url()).host); });
});
test.afterEach(() => { expect(offOrigin, 'requests outside the app origin').toEqual([]); });

async function shot(page: Page, name: string, wait = 0) {
  if (wait) await page.waitForTimeout(wait);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

const next = (page: Page) => page.locator('[data-action="next"]').click();

async function playStation(page: Page, id: string, prefix: string) {
  const ob = observe(id);
  const wrong = ob.choiceIds!.find((c) => c !== ob.correctChoiceId)!;
  await page.goto(`/stations/${id}`);
  await page.waitForLoadState('networkidle');
  await shot(page, `${prefix}-1-frame`);

  await page.locator('[data-action="start"]').click();
  await expect(page.locator('[data-screen="observe"]')).toBeVisible();
  await shot(page, `${prefix}-2-question`, 300);

  await page.locator(`[data-record="${wrong}"]`).click();
  await expect(page.locator('[data-strip="redirect"]')).toBeVisible();
  await expect(page.locator(`[data-record="${wrong}"]`)).toHaveAttribute('data-state', 'greyed');
  if (id === 'S1') {
    await shot(page, `${prefix}-3-wrong-redirect`, 450);
    const hint = page.locator('[data-action="hint"]');
    while (await hint.isEnabled()) await hint.click();
    await expect(page.locator(`[data-record="${ob.correctChoiceId}"]`)).toHaveAttribute('data-state', 'highlight');
    await shot(page, `${prefix}-4-last-hint-glow`, 300);
  }

  await page.locator(`[data-record="${ob.correctChoiceId}"]`).click();
  // Magic moment: full screen, then back (S1 waits for the auto-close; S2 and S3 tap to skip).
  const moment = page.locator(`[data-moment="${id}"]`);
  await expect(moment).toBeVisible(); // appears ~700 ms after the green ring
  await shot(page, `${prefix}-5-moment`, 1500);
  if (id === 'S1') await expect(moment).toBeHidden({ timeout: 6000 }); // 700 + 3000 + 600 ms
  else { await moment.click(); await expect(moment).toBeHidden(); }
  await expect(page.locator('[data-strip="praise"]')).toBeVisible();
  await shot(page, `${prefix}-5-correct`, 600);

  await next(page);
  await expect(page.locator('[data-screen="connect"] [data-verse-text]')).toBeVisible();
  await shot(page, `${prefix}-6-verse-card`, 500);

  await next(page);
  if (await page.locator('[data-screen="ask"]').count()) {
    await page.locator('[data-question]').first().click();
    await expect(page.locator('[data-answer]')).toBeVisible();
    await shot(page, `${prefix}-7-ask`, 500);
    await next(page);
  }

  await expect(page.locator('[data-screen="narrate"]')).toBeVisible();
  for (const card of narrationPicks(id)) await page.locator(`[data-record="${card}"]`).click();
  await expect(page.locator('[data-strip="praise"]')).toBeVisible();
  await shot(page, `${prefix}-8-narrate`, 1000);

  await next(page);
  await expect(page.locator('[data-screen="close"]')).toBeVisible();
  await shot(page, `${prefix}-9-close`, 800);
}

test('journey map (fresh, and after Station 1)', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-station="S1"]')).toHaveAttribute('data-state', 'current');
  await expect(page.locator('[data-station="S2"]')).toHaveAttribute('data-state', 'locked');
  await shot(page, 'map-1-start', 400);

  await page.addInitScript(() => sessionStorage.setItem('mizan.progress', JSON.stringify(['S1'])));
  await page.reload();
  await expect(page.locator('[data-station="S1"]')).toHaveAttribute('data-state', 'done');
  await expect(page.locator('[data-station="S2"]')).toHaveAttribute('data-state', 'current');
  await expect(page.locator('[data-progress]')).toHaveAttribute('data-progress', '1');
  await shot(page, 'map-2-after-station-1', 400);
});

test('Station 1 screens', async ({ page }) => { await playStation(page, 'S1', 's1'); });
test('Station 2 screens', async ({ page }) => { await playStation(page, 'S2', 's2'); });
test('Station 3 screens', async ({ page }) => { await playStation(page, 'S3', 's3'); });

test('parent summary', async ({ page }) => {
  await page.goto('/parent');
  await expect(page.locator('[data-sfx-switch]')).toHaveAttribute('aria-checked', 'true');
  await shot(page, 'parent');
});

// D38: every moment shows its whole picture: the picture box lies fully inside the viewport at
// every size (blurred copy behind fills the edges). Screenshots: moment-<station>-<width>.png.
const SIZES = [[1024, 768], [1180, 820], [1366, 1024], [768, 1024], [390, 844]] as const;
for (const [width, height] of SIZES) {
  test(`moments fit the screen at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const id of ['S1', 'S2', 'S3']) {
      await page.goto(`/stations/${id}`);
      await page.locator('[data-action="start"]').click();
      await page.locator(`[data-record="${observe(id).correctChoiceId}"]`).click();
      const box = page.locator(`[data-moment="${id}"] [data-moment-box]`);
      await expect(box).toBeVisible();
      await page.waitForTimeout(900); // fade-in and scale settle (700 ms)
      const b = (await box.boundingBox())!;
      expect(b.x, `${id} ${width} left`).toBeGreaterThanOrEqual(-0.5);
      expect(b.y, `${id} ${width} top`).toBeGreaterThanOrEqual(-0.5);
      expect(b.x + b.width, `${id} ${width} right`).toBeLessThanOrEqual(width + 0.5);
      expect(b.y + b.height, `${id} ${width} bottom`).toBeLessThanOrEqual(height + 0.5);
      expect(Math.max(b.width / width, b.height / height), `${id} ${width} fills one axis`).toBeGreaterThan(0.98);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${id} ${width} no sideways overflow`).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `${SHOTS}/moment-${id}-${width}.png` });
      await page.locator(`[data-moment="${id}"]`).click();
    }
  });
}

test('phone width: map, question and verse card', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await shot(page, 'phone-map', 400);
  await page.goto('/stations/S1');
  await page.locator('[data-action="start"]').click();
  await shot(page, 'phone-s1-question', 300);
  await page.locator(`[data-record="${observe('S1').correctChoiceId}"]`).click();
  await page.locator('[data-moment="S1"]').click();
  await next(page);
  await shot(page, 'phone-s1-verse-card', 400);
});

test('prefers-reduced-motion: nothing moves, only opacity cross-fades', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Running animations that change anything other than opacity (position, size, rotation, shadow...).
  const moving = () => page.evaluate(() => document.getAnimations()
    .filter((a) => a.playState === 'running')
    .filter((a) => (a.effect as KeyframeEffect | null)?.getKeyframes().some((k) => Object.keys(k).some((p) => !['offset', 'easing', 'composite', 'computedOffset', 'opacity'].includes(p))) ?? true)
    .length);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(await moving()).toBe(0);
  await page.goto('/stations/S1');
  expect(await moving()).toBe(0);
  await page.locator('[data-action="start"]').click();
  expect(await moving()).toBe(0);
  const other = observe('S1').choiceIds!.find((c) => c !== observe('S1').correctChoiceId)!;
  await page.locator(`[data-record="${other}"]`).click();
  expect(await moving()).toBe(0);
  await page.locator(`[data-record="${observe('S1').correctChoiceId}"]`).click();
  expect(await moving()).toBe(0);
  // No moment at all under reduced motion; the praise shows straight away.
  await expect(page.locator('[data-strip="praise"]')).toBeVisible();
  expect(await page.locator('[data-moment]').count()).toBe(0);
});

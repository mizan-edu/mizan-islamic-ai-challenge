// Phase 6 (D54): reduced motion on every station and on /parent, and the deck screenshots at tablet size
// (1180x820) in docs/screenshots/deck-*.png. Plays the real screens with taps only; the Parent Ask
// question is an approved anticipated question (no model call). Reads IDs from /content; never prints
// record text.

import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const SHOTS = 'docs/screenshots';
const TABLET = { width: 1180, height: 820 };
interface Step { step: string; correctChoiceId?: string; choiceIds?: string[]; mode?: string; expectedOrder?: string[]; narrationCardIds?: string[]; scoringNote?: string }
const station = (id: string) => JSON.parse(readFileSync(`content/stations/${id}.json`, 'utf8')) as { script: Step[]; anticipatedQuestions: { childQuestion: string }[] };
const step = (id: string, name: string) => station(id).script.find((s) => s.step === name)!;
function picks(id: string): string[] {
  const n = step(id, 'narrate');
  if (n.mode === 'order') return n.expectedOrder ?? [];
  let best: { id: string; score: number } | null = null;
  for (const m of (n.scoringNote ?? '').matchAll(/(S\d+\.N\d+)\s*=\s*(\d)/g)) if (!best || Number(m[2]) > best.score) best = { id: m[1], score: Number(m[2]) };
  return best ? [best.id] : [];
}

// Running animations that change anything other than opacity.
const moving = (page: Page) => page.evaluate(() => document.getAnimations()
  .filter((a) => a.playState === 'running')
  .filter((a) => (a.effect as KeyframeEffect | null)?.getKeyframes().some((k) => Object.keys(k).some((p) => !['offset', 'easing', 'composite', 'computedOffset', 'opacity'].includes(p))) ?? true)
  .length);
const settle = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
const next = (page: Page) => page.locator('[data-action="next"]').click();

// Plays a station to its close screen; `check` runs after every tap.
async function play(page: Page, id: string, { hints = 0, check = async () => {} }: { hints?: number; check?: () => Promise<void> } = {}) {
  const ob = step(id, 'observe');
  await page.goto(`/stations/${id}`);
  await check();
  await page.locator('[data-action="start"]').click();
  await check();
  const wrong = ob.choiceIds!.find((c) => c !== ob.correctChoiceId)!;
  await page.locator(`[data-record="${wrong}"]`).click();
  await check();
  for (let i = 0; i < hints; i++) { await page.locator('[data-action="hint"]').click(); await check(); }
  await page.locator(`[data-record="${ob.correctChoiceId}"]`).click();
  const moment = page.locator(`[data-moment="${id}"]`);
  await expect(moment).toBeVisible();
  await check();
  await moment.click();
  await expect(page.locator('[data-strip="praise"]')).toBeVisible();
  await next(page);
  await expect(page.locator('[data-screen="connect"]')).toBeVisible();
  await check();
  await next(page);
  if (await page.locator('[data-screen="ask"]').count()) { await check(); await next(page); }
  for (const card of picks(id)) { await page.locator(`[data-record="${card}"]`).click(); await check(); }
  await expect(page.locator('[data-screen="narrate"] [data-strip="praise"]')).toBeVisible();
  await next(page);
  await expect(page.locator('[data-screen="close"]')).toBeVisible();
  await check();
}

test('reduced motion on every station and on /parent: nothing moves, only opacity fades', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const check = async () => { await page.mouse.move(300, 300); await page.mouse.move(700, 500); expect(await moving(page)).toBe(0); };
  for (const id of ['S1', 'S2', 'S3']) await play(page, id, { hints: 2, check });
  await page.goto('/parent');
  await check();
  for (const d of [7, 3, 9]) await page.locator(`[data-gate-key="${d}"]`).click();
  await expect(page.locator('[data-parent-ask]')).toBeVisible();
  await check();
  await expect(page.locator('[data-summary-station="S3"]')).toBeVisible();
  await check();
});

test('deck screenshots at 1180x820', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(TABLET);
  const ob = step('S1', 'observe');

  // S1 cards, settled.
  await page.goto('/stations/S1');
  await page.locator('[data-action="start"]').click();
  await expect(page.locator('[data-screen="observe"]')).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/deck-s1-cards.png` });

  // The hero moment: the chosen card lifted, ring, sheen and rain particles.
  await page.locator(`[data-record="${ob.correctChoiceId}"]`).click();
  await page.waitForTimeout(420);
  await page.screenshot({ path: `${SHOTS}/deck-s1-hero.png` });

  // The rain scene, well into the moment.
  await expect(page.locator('[data-moment="S1"]')).toBeVisible();
  await page.waitForTimeout(1900);
  await page.screenshot({ path: `${SHOTS}/deck-s1-rain-scene.png` });

  // The AI lens on the ask step (?judge=1), with the reply's decision and trace.
  await page.goto('/stations/S1?judge=1');
  await page.locator('[data-action="start"]').click();
  await page.locator(`[data-record="${ob.correctChoiceId}"]`).click();
  await page.locator('[data-moment="S1"]').click();
  await next(page);
  await next(page);
  await expect(page.locator('[data-screen="ask"]')).toBeVisible();
  await page.locator('[data-question]').first().click();
  await expect(page.locator('[data-judge-trace]')).toBeVisible();
  await settle(page);
  await page.locator('[data-judge-panel]').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await page.screenshot({ path: `${SHOTS}/deck-lens-ask.png` });

  // Parent Ask with a reply (an approved question, no model call).
  await page.goto('/parent?judge=0');
  for (const d of [7, 3, 9]) await page.locator(`[data-gate-key="${d}"]`).click();
  await page.locator('[data-ask-station]').selectOption('S1');
  await page.locator('[data-ask-text]').fill(station('S1').anticipatedQuestions[0].childQuestion);
  await page.locator('[data-ask-send]').click();
  await expect(page.locator('[data-ask-result]')).toBeVisible();
  await settle(page);
  await page.locator('[data-ask-result]').evaluate((el) => { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -24); });
  await page.screenshot({ path: `${SHOTS}/deck-parent-ask.png` });
  // The same reply, scrolled to its level, decision-kind and source chips.
  await page.locator('[data-ask-sources]').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await page.screenshot({ path: `${SHOTS}/deck-parent-ask-sources.png` });

  // The summary card after playing S1 (one hint) and S2 (no hint), with real taps.
  await page.goto('/parent');
  await page.locator('[data-reset-start]').click();
  await page.locator('[data-reset-confirm]').click();
  await play(page, 'S1', { hints: 1 });
  await play(page, 'S2');
  await page.goto('/parent');
  await expect(page.locator('[data-summary-station="S2"]')).toBeVisible();
  await settle(page);
  await page.locator('[data-session-summary]').screenshot({ path: `${SHOTS}/deck-summary.png` });
});

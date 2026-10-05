// Evaluation page (Runbook 3.7, D45) in the browser: all nine sections; a test item and a typed
// question each show the reply as a child sees it with the judge trace beneath; typed text leaves no
// trace in browser storage and adds no event; axe finds no WCAG 2 A/AA violation; no horizontal scroll;
// no request leaves the app. Screenshots: docs/screenshots/evaluation.png, evaluation-phone.png.
// The typed question is an approved anticipated question (routes without a model call).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const SHOTS = 'docs/screenshots';
const AXE = join(process.cwd(), 'node_modules/axe-core/axe.min.js'); // installed with eslint-config-next (jsx-a11y)
const typedQuestion = (JSON.parse(readFileSync('content/stations/S1.json', 'utf8')) as { anticipatedQuestions: { childQuestion: string }[] }).anticipatedQuestions[0].childQuestion;

const offOrigin: string[] = [];
test.beforeEach(({ page, baseURL }) => {
  page.on('request', (r) => { if (!r.url().startsWith(baseURL!) && !r.url().startsWith('data:')) offOrigin.push(new URL(r.url()).host); });
});
test.afterEach(() => { expect(offOrigin, 'requests outside the app origin').toEqual([]); });

const storage = (page: Page) => page.evaluate(() => JSON.stringify({ s: { ...sessionStorage }, l: { ...localStorage } }));

async function axe(page: Page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const a = (window as unknown as { axe: { run: (d: Document, o: object) => Promise<{ violations: { id: string; nodes: unknown[] }[] }> } }).axe;
    return (await a.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).violations.map((v) => `${v.id} (${v.nodes.length})`);
  });
}

test('evaluation page: sections, try a test item and a typed question, storage untouched, accessible', async ({ page }) => {
  await page.goto('/evaluation');
  for (const id of ['about', 'try', 'results', 'safety', 'log', 'reliability', 'limits', 'compare', 'vision']) await expect(page.locator(`[data-section="${id}"]`)).toBeVisible();
  await expect(page.locator('[data-category="B"] [data-b-before-after]')).toBeVisible();
  const before = await storage(page);

  // A test item from the active set: B01 is answered by a router rule (no model call, deterministic).
  await page.locator('[data-try-item]').selectOption('B01');
  await page.locator('[data-try-show]').click();
  await expect(page.locator('[data-try-reply]')).toBeVisible();
  await expect(page.locator('[data-try-result] [data-judge-panel]')).toBeVisible();

  // A typed question: reply and trace; no storage written, no event; the box is cleared.
  await page.locator('[data-try-text]').fill(typedQuestion);
  await page.locator('[data-try-send]').click();
  await expect(page.locator('[data-try-text]')).toHaveValue('');
  await expect(page.locator('[data-try-result] [data-judge-field="route"]')).toContainText('anticipated_question');
  expect(await storage(page)).toEqual(before);
  expect(await storage(page)).not.toContain(typedQuestion);

  expect(await axe(page)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${SHOTS}/evaluation.png`, fullPage: true });
});

test('evaluation page on a phone (390 x 844)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/evaluation');
  await page.locator('[data-try-item]').selectOption('B01');
  await page.locator('[data-try-show]').click();
  await expect(page.locator('[data-try-reply]')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(0);
  expect(await axe(page)).toEqual([]);
  await page.screenshot({ path: `${SHOTS}/evaluation-phone.png`, fullPage: true });
});

test('the parent page links judges to the evaluation page', async ({ page }) => {
  await page.goto('/parent');
  await page.locator('[data-evaluation-link]').click();
  await expect(page).toHaveURL(/\/evaluation$/);
});

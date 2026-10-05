// Parent Ask (D54, Phase 3) in the browser: hidden until the 7-3-9 gate opens; a typed question goes
// to /api/try as { stationId, text } only; the approved reply shows with its behaviour, level,
// decision kind and source chips; the typed text never reaches storage; axe finds no WCAG 2 A/AA
// violation with the result open. The question is an approved anticipated question (no model call).
// Reads IDs from /content; never prints record text.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const AXE = join(process.cwd(), 'node_modules/axe-core/axe.min.js');
const s1 = JSON.parse(readFileSync('content/stations/S1.json', 'utf8')) as { anticipatedQuestions: { id: string; childQuestion: string; responseRecordId: string }[] };
const aq = s1.anticipatedQuestions[0];

test('Parent Ask: behind the gate, sends only station and text, shows the approved reply with level and sources, stores nothing', async ({ page }) => {
  await page.goto('/parent');
  await expect(page.locator('[data-parent-ask]')).toHaveCount(0);
  for (const d of [7, 3, 9]) await page.locator(`[data-gate-key="${d}"]`).click();
  await expect(page.locator('[data-parent-ask]')).toBeVisible();

  await page.locator('[data-ask-station]').selectOption('S1');
  await page.locator('[data-ask-text]').fill(aq.childQuestion);
  const request = page.waitForRequest((r) => r.url().endsWith('/api/try'));
  await page.locator('[data-ask-send]').click();
  const body = JSON.parse((await request).postData() ?? '{}') as Record<string, unknown>;
  expect(Object.keys(body).sort()).toEqual(['stationId', 'text']);
  expect(body.stationId).toBe('S1');

  const result = page.locator('[data-ask-result]');
  await expect(result).toBeVisible();
  await expect(page.locator('[data-ask-text]')).toHaveValue('');
  await expect(result.locator(`[data-line="${aq.responseRecordId}"]`)).toBeVisible();
  await expect(result.locator('[data-ask-level]')).toBeVisible();
  await expect(result.locator('[data-ask-kind="rule"]')).toBeVisible();
  await expect(result.locator(`[data-source-chip="${aq.responseRecordId}"]`)).toBeVisible();

  const stored = await page.evaluate(() => JSON.stringify({ s: { ...sessionStorage }, l: { ...localStorage }, c: document.cookie }));
  expect(stored).not.toContain(aq.childQuestion);
  expect(stored).not.toContain('mizan.events');

  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished)));
  await page.addScriptTag({ path: AXE });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: Document, o: object) => Promise<{ violations: { id: string; nodes: unknown[] }[] }> } }).axe;
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    return r.violations.map((v) => `${v.id} (${v.nodes.length})`);
  });
  expect(violations).toEqual([]);
});

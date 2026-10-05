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

test('Parent summary card (D54 Phase 4): after Station 1 with one hint, the card shows it; reset clears it', async ({ page }) => {
  const s1 = JSON.parse(readFileSync('content/stations/S1.json', 'utf8')) as { script: { step: string; correctChoiceId?: string; expectedOrder?: string[]; parentSummaryIds?: string[] }[] };
  const ob = s1.script.find((s) => s.step === 'observe')!;
  const order = s1.script.find((s) => s.step === 'narrate')!.expectedOrder!;
  const ps = s1.script.find((s) => s.step === 'close')!.parentSummaryIds!;

  await page.goto('/parent');
  await expect(page.locator('[data-summary-empty]')).toBeVisible();

  await page.goto('/stations/S1');
  await page.locator('[data-action="start"]').click();
  await page.locator('[data-action="hint"]').click();
  await page.locator(`[data-record="${ob.correctChoiceId}"]`).click();
  const moment = page.locator('[data-moment="S1"]');
  await expect(moment).toBeVisible();
  await moment.click();
  await expect(page.locator('[data-strip="praise"]')).toBeVisible();
  await page.locator('[data-action="next"]').click(); // connect
  await page.locator('[data-action="next"]').click(); // ask
  if (await page.locator('[data-screen="ask"]').count()) await page.locator('[data-action="next"]').click();
  for (const card of order) await page.locator(`[data-record="${card}"]`).click();
  await expect(page.locator('[data-screen="narrate"] [data-strip="praise"]')).toBeVisible();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-screen="close"]')).toBeVisible();

  await page.goto('/parent');
  const card = page.locator('[data-summary-station="S1"]');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-hints', '1');
  for (const id of ps) await expect(card.locator(`[data-summary-line="${id}"]`)).toBeVisible();
  await expect(page.locator('[data-summary-station="S2"]')).toHaveCount(0);

  await page.locator('[data-reset-start]').click();
  await page.locator('[data-reset-confirm]').click();
  await expect(page.locator('[data-summary-empty]')).toBeVisible();
  await expect(card).toHaveCount(0);
});

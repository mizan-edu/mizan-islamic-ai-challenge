// Judge mode (A1) in the browser: off by default (no panel, no trace in the API response); ?judge=1
// or the parent-page switch turns it on for the browser session only; the panel sits under the
// reply, away from any verse card; axe finds no WCAG 2 A/AA violation with the panel open; only the
// on/off flag is stored. Screenshots: docs/screenshots/judge-s1-ask.png, judge-s2-ask.png.
// Reads IDs from /content; never prints record text.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const SHOTS = 'docs/screenshots';
const AXE = join(process.cwd(), 'node_modules/axe-core/axe.min.js'); // installed with eslint-config-next (jsx-a11y)
interface Script { step: string; correctChoiceId?: string }
const correct = (id: string) => (JSON.parse(readFileSync(`content/stations/${id}.json`, 'utf8')) as { script: Script[] }).script.find((s) => s.step === 'observe')!.correctChoiceId!;

const offOrigin: string[] = [];
test.beforeEach(({ page, baseURL }) => {
  page.on('request', (r) => { if (!r.url().startsWith(baseURL!) && !r.url().startsWith('data:')) offOrigin.push(new URL(r.url()).host); });
});
test.afterEach(() => { expect(offOrigin, 'requests outside the app origin').toEqual([]); });

// Plays a station to its ask step and asks the first question; returns the /api/ask response body.
async function ask(page: Page, id: string, query = '') {
  await page.goto(`/stations/${id}${query}`);
  await page.locator('[data-action="start"]').click();
  await page.locator(`[data-record="${correct(id)}"]`).click();
  const moment = page.locator(`[data-moment="${id}"]`);
  await expect(moment).toBeVisible();
  await moment.click();
  await expect(page.locator('[data-strip="praise"]')).toBeVisible();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-screen="connect"]')).toBeVisible();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('[data-screen="ask"]')).toBeVisible();
  const response = page.waitForResponse((r) => r.url().includes('/api/ask'));
  await page.locator('[data-question]').first().click();
  const res = await response;
  await expect(page.locator('[data-answer]')).toBeVisible();
  return { url: res.url(), body: (await res.json()) as Record<string, unknown> };
}

test('judge mode is off by default: no panel, no trace requested or sent', async ({ page }) => {
  const { url, body } = await ask(page, 'S1');
  expect(url).not.toContain('judge');
  expect(body).not.toHaveProperty('trace');
  await expect(page.locator('[data-judge-panel]')).toHaveCount(0);
});

for (const id of ['S1', 'S2']) {
  test(`${id}: ?judge=1 shows the trace panel under the reply, away from the verse card`, async ({ page }) => {
    const { url, body } = await ask(page, id, '?judge=1');
    expect(url).toContain('judge=1');
    expect(body).toHaveProperty('trace');
    const panel = page.locator('[data-judge-panel]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-judge-field="route"]')).toContainText('anticipated_question');

    // Under the reply and never on or near a verse card.
    const p = (await panel.boundingBox())!;
    const answer = (await page.locator('[data-answer]').boundingBox())!;
    expect(p.y).toBeGreaterThan(answer.y + answer.height);
    for (const v of await page.locator('[data-verse]').all()) {
      const b = (await v.boundingBox())!;
      expect(p.y - (b.y + b.height), 'gap between a verse card and the panel').toBeGreaterThanOrEqual(48);
    }
    await expect(page.locator('[data-verse] [data-judge-panel], [data-answer] [data-judge-panel]')).toHaveCount(0);

    // Accessibility with the panel open.
    await page.addScriptTag({ path: AXE });
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (ctx: Document, o: object) => Promise<{ violations: { id: string; nodes: unknown[] }[] }> } }).axe;
      const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
      return r.violations.map((v) => `${v.id} (${v.nodes.length})`);
    });
    expect(violations).toEqual([]);

    // Judge mode stores nothing but its own flag, for this browser session only.
    const stored = await page.evaluate(() => ({
      session: Object.fromEntries(Object.keys(sessionStorage).map((k) => [k, sessionStorage.getItem(k)!])),
      local: Object.keys(localStorage),
    }));
    expect(stored.session['mizan.judge']).toBe('1');
    expect(Object.keys(stored.session).every((k) => ['mizan.judge', 'mizan.events', 'mizan.progress'].includes(k))).toBe(true);
    expect(JSON.stringify(stored.session)).not.toMatch(/route|latencyMs|retrieved|validator/);
    expect(stored.local).not.toContain('mizan.judge');

    await page.screenshot({ path: `${SHOTS}/judge-${id.toLowerCase()}-ask.png`, fullPage: true });
  });
}

test('the parent-page switch turns judge mode on for the session; ?judge=0 turns it off', async ({ page }) => {
  await page.goto('/parent');
  const sw = page.locator('[data-judge-switch]');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await ask(page, 'S2');
  await expect(page.locator('[data-judge-panel]')).toBeVisible();
  await ask(page, 'S2', '?judge=0');
  await expect(page.locator('[data-judge-panel]')).toHaveCount(0);
});

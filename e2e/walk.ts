// Walks every child screen step by step (D67): the map, each station step of S1-S3 and story mode,
// calling `at(name)` at each state. Shared by the phone layout test (mobile.spec.ts) and the local
// tablet/laptop pixel comparison. Media is stood in for: clips are refused (the moment shows its
// still), story narration and recitation "end" only when the walker says so. Reads IDs from /content;
// never prints record text.

import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

interface Script { step: string; correctChoiceId?: string; choiceIds?: string[]; mode?: string; expectedOrder?: string[]; narrationCardIds?: string[]; scoringNote?: string }
const script = (id: string): Script[] => (JSON.parse(readFileSync(`content/stations/${id}.json`, 'utf8')) as { script: Script[] }).script;
export const observe = (id: string) => script(id).find((s) => s.step === 'observe')!;
const narrate = (id: string) => script(id).find((s) => s.step === 'narrate')!;

// Same rule as bestCardFromNote in app/_lib/station-view.ts.
export function narrationPicks(id: string): string[] {
  const n = narrate(id);
  if (n.mode === 'order') return n.expectedOrder ?? n.narrationCardIds ?? [];
  let best: { id: string; score: number } | null = null;
  for (const m of (n.scoringNote ?? '').matchAll(/(S\d+\.N\d+)\s*=\s*(\d)/g)) {
    if ((n.narrationCardIds ?? []).includes(m[1]) && (!best || Number(m[2]) > best.score)) best = { id: m[1], score: Number(m[2]) };
  }
  return best ? [best.id] : [];
}

export type At = (name: string) => Promise<void>;
export const STATIONS = ['S1', 'S2', 'S3'] as const;

// Media stand-ins, installed before any page script runs: clips fail (stills), narration and
// recitation play without sound and end only when window.__endMedia() is called.
export async function standInMedia(page: Page) {
  await page.route('**/*.mp4', (r) => r.abort());
  await page.route((url) => /mp3quran\.net/.test(url.href), (r) => r.abort());
  await page.addInitScript(() => {
    const w = window as unknown as { __playing: Set<HTMLMediaElement>; __endMedia: () => void };
    w.__playing = new Set();
    w.__endMedia = () => { for (const m of [...w.__playing]) { w.__playing.delete(m); m.dispatchEvent(new Event('ended')); } };
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (this instanceof HTMLVideoElement) return Promise.reject(new DOMException('no clips in this test', 'NotSupportedError'));
      w.__playing.add(this);
      queueMicrotask(() => this.dispatchEvent(new Event('play')));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function (this: HTMLMediaElement) { w.__playing.delete(this); };
  });
}

const settle = (page: Page, ms = 600) => page.waitForTimeout(ms);
const next = (page: Page) => page.locator('[data-action="next"]').click();

export async function walkMap(page: Page, at: At) {
  await page.goto('/');
  await page.evaluate(() => sessionStorage.removeItem('mizan.progress'));
  await page.reload();
  await expect(page.locator('[data-station="S1"]')).toHaveAttribute('data-state', 'current');
  await settle(page);
  await at('map');
  await page.evaluate(() => sessionStorage.setItem('mizan.progress', JSON.stringify(['S1', 'S2', 'S3'])));
  await page.reload();
  await expect(page.locator('[data-station="S3"]')).toHaveAttribute('data-state', 'done');
  await settle(page);
  await at('map-done');
}

export async function walkStation(page: Page, id: string, at: At) {
  const ob = observe(id);
  const wrong = ob.choiceIds!.find((c) => c !== ob.correctChoiceId)!;
  await page.goto(`/stations/${id}`);
  await expect(page.locator('[data-screen="frame"]')).toBeVisible();
  await settle(page);
  await at(`${id}-1-frame`);

  await page.locator('[data-action="start"]').click();
  await expect(page.locator('[data-screen="observe"]')).toBeVisible();
  await settle(page, 900);
  await at(`${id}-2-observe`);

  await page.locator(`[data-record="${wrong}"]`).click();
  await expect(page.locator('[data-strip="redirect"]')).toBeVisible();
  await settle(page);
  await at(`${id}-3-redirect`);

  const hint = page.locator('[data-action="hint"]');
  while (await hint.isEnabled()) await hint.click();
  await expect(page.locator(`[data-record="${ob.correctChoiceId}"]`)).toHaveAttribute('data-state', 'highlight');
  await settle(page);
  await at(`${id}-4-hints`);

  await page.locator(`[data-record="${ob.correctChoiceId}"]`).click();
  const moment = page.locator(`[data-moment="${id}"]`);
  await expect(moment).toBeVisible();
  await expect(moment).toHaveAttribute('data-moment-video', /off|error/);
  await settle(page, 1200);
  await at(`${id}-5-moment`);
  if (await moment.isVisible()) await moment.click().catch(() => null); // it may have closed on its own
  await expect(moment).toBeHidden();
  await expect(page.locator('[data-strip="praise"]')).toBeVisible();
  await settle(page);
  await at(`${id}-6-praise`);

  await next(page);
  const connect = page.locator('[data-screen="connect"]');
  await expect(connect).toBeVisible();
  if (!(await connect.getAttribute('data-connect-page'))) {
    await expect(connect.locator('[data-verse-text]')).toBeVisible();
    await settle(page);
    await at(`${id}-7-verse`);
    await next(page);
  } else {
    // Phones (D67): the verse step shows in pages; Next moves page by page, then to the next step.
    const pages: string[] = [];
    for (let p = await connect.getAttribute('data-connect-page'); p; p = await connect.getAttribute('data-connect-page', { timeout: 500 }).catch(() => null)) {
      pages.push(p);
      if (p === 'verse') await expect(connect.locator('[data-verse-text]')).toBeVisible();
      await settle(page);
      await at(`${id}-7-connect-${pages.length}-${p}`);
      await next(page);
      await expect.poll(async () => (await connect.count()) === 0 || (await connect.getAttribute('data-connect-page')) !== p).toBe(true);
      if (!(await connect.count())) break;
    }
    expect(pages).toContain('verse');
  }

  if (await page.locator('[data-screen="ask"]').count()) {
    await settle(page);
    await at(`${id}-8-ask`);
    const questions = await page.locator('[data-question]').evaluateAll((els) => els.map((e) => e.getAttribute('data-question')!));
    for (const q of questions) {
      await page.locator(`[data-question="${q}"]`).click();
      await expect(page.locator(`[data-answer="${q}"]`)).toBeVisible();
      await settle(page);
      await at(`${id}-8-ask-${q}`);
      // Portrait phones (D67): the reply has its own view; Next goes back to the questions.
      if ((await page.locator('[data-screen="ask"]').getAttribute('data-ask-view')) === 'answer') {
        await next(page);
        await expect(page.locator('[data-screen="ask"]')).toHaveAttribute('data-ask-view', 'list');
      }
    }
    await next(page);
  }

  await expect(page.locator('[data-screen="narrate"]')).toBeVisible();
  await settle(page, 900);
  await at(`${id}-9-narrate`);
  for (const card of narrationPicks(id)) await page.locator(`[data-record="${card}"]`).click();
  await expect(page.locator('[data-strip="praise"]')).toBeVisible();
  await settle(page, 900);
  await at(`${id}-10-narrated`);

  await next(page);
  await expect(page.locator('[data-screen="close"]')).toBeVisible();
  await settle(page, 1200);
  await at(`${id}-11-close`);
}

// Story mode: every step, held until the walker ends its media.
export async function walkStory(page: Page, id: string, at: At) {
  await page.goto(`/story/${id}`);
  await expect(page.locator('[data-story-step="start"]')).toBeVisible();
  await settle(page);
  await at(`story-${id}-0-start`);
  await page.locator('[data-story-start]').click();
  const step = page.locator('[data-screen="story"]');
  const seen = new Set<string>();
  for (let n = 1; n < 40; n++) {
    const key = (await step.getAttribute('data-story-step'))!;
    if (key === 'done') break;
    if (key.startsWith('answer:')) {
      const moment = page.locator(`[data-moment="${id}"]`);
      await expect(moment).toBeVisible();
      await settle(page, 1200);
      await at(`story-${id}-${n}-answer-moment`);
      if (await moment.isVisible()) await moment.click().catch(() => null);
      await expect(moment).toBeHidden();
    }
    await settle(page);
    const name = `story-${id}-${n}-${key.split(':')[0]}`;
    if (!seen.has(key)) { seen.add(key); await at(name); }
    await page.evaluate(() => (window as unknown as { __endMedia: () => void }).__endMedia());
    await expect(step).not.toHaveAttribute('data-story-step', key, { timeout: 8000 });
  }
  await expect(step).toHaveAttribute('data-story-step', 'done');
  await settle(page);
  await at(`story-${id}-done`);
}

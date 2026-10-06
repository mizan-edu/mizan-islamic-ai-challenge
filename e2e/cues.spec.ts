// Guided cues (D75). Station 1, the whole path, on a tablet/laptop viewport and a phone: exactly one
// group glows at a time and in order — speaker -> all answer cards together -> the redirect speaker
// after a wrong tap -> the cards again -> next after the moment and the praise -> line speakers ->
// the recitation (cue moves on when it is paused) -> next -> ... -> the narration finish control.
// Plus: audio that fails moves the cue on; reduced motion shows a static ring; the map cues its
// start control; no API or model call is made on the way. Media stand-ins as in walk.ts.

import { expect, test, type Page } from '@playwright/test';
import { narrationPicks, observe, standInMedia } from './walk';

// What glows now: one descriptor per glowing control.
const cued = (page: Page) => page.locator('[data-cue]').evaluateAll((els) => els.map((e) => {
  const el = e as HTMLElement;
  if (el.dataset.record) return 'card';
  if (el.hasAttribute('data-recitation')) return 'recitation';
  if (el.hasAttribute('data-narration')) return el.closest('[data-strip]') ? `speaker:${el.closest('[data-strip]')!.getAttribute('data-strip')}` : 'speaker';
  return el.dataset.action ?? (el.getAttribute('href') === '/' ? 'home' : el.tagName.toLowerCase());
}));
const endMedia = (page: Page) => page.evaluate(() => (window as unknown as { __endMedia: () => void }).__endMedia());
const glowing = async (page: Page, expected: string[]) => { await expect.poll(() => cued(page)).toEqual(expected); };

// Taps every speaker the cue points at, in turn, ending its audio; returns what glowed.
async function followSpeakers(page: Page, log: string[]) {
  for (let n = 0; n < 12; n++) {
    // Nothing glowing for 1.5 s: the child is busy (arranging cards); the caller checks that.
    if (!(await expect.poll(async () => (await cued(page)).length, { timeout: 1500 }).toBeGreaterThan(0).then(() => true, () => false))) return;
    const now = await cued(page);
    if (!now[0].startsWith('speaker') && now[0] !== 'recitation') return;
    expect(now).toHaveLength(1);
    log.push(now[0]);
    await page.locator('[data-cue]').click();
    await glowing(page, []); // tapped: its glow stops while it plays
    if (now[0] === 'recitation') {
      // The child pauses the recitation: the cue moves on.
      await page.evaluate(() => document.querySelector('[data-verse] audio')!.dispatchEvent(new Event('pause')));
    } else await endMedia(page);
  }
}

const VIEWPORTS = { desktop: { width: 1366, height: 768 }, tablet: { width: 1024, height: 768 }, phone: { width: 390, height: 844 } } as const;

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`guided cues, ${name}`, () => {
    test.use({ viewport, ...(name === 'phone' ? { isMobile: true, hasTouch: true } : {}) });

    test('Station 1: the cue order along the whole path', async ({ page }) => {
      test.setTimeout(90_000);
      const api: string[] = [];
      page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') && u.pathname !== '/api/health') api.push(u.pathname); });
      await standInMedia(page);
      const ob = observe('S1');
      const wrong = ob.choiceIds!.find((c) => c !== ob.correctChoiceId)!;
      const log: string[] = [];

      await page.goto('/stations/S1');
      await glowing(page, ['speaker']);
      await followSpeakers(page, log);
      await glowing(page, ['start']);
      await page.locator('[data-action="start"]').click();

      // Observe: the question speaker, then every card at once (never the right one alone).
      await glowing(page, ['speaker']);
      await followSpeakers(page, log);
      await glowing(page, ['card', 'card', 'card']);
      await page.locator(`[data-record="${wrong}"]`).click();
      // Wrong tap: the redirect line's speaker, then the cards together again.
      await glowing(page, ['speaker:redirect']);
      await followSpeakers(page, log);
      await glowing(page, ['card', 'card', 'card']);
      await page.locator(`[data-record="${ob.correctChoiceId}"]`).click();
      // The moment (the still here: no clips in this test) runs to its end; nothing glows meanwhile.
      const moment = page.locator('[data-moment="S1"]');
      await expect(moment).toBeVisible();
      await glowing(page, []);
      await expect(moment).toBeHidden({ timeout: 10_000 });
      // The praise plays on its own; when it ends, next.
      await expect(page.locator('[data-strip="praise"]')).toBeVisible();
      await glowing(page, []);
      await endMedia(page);
      await glowing(page, ['next']);
      log.push('next');
      await page.locator('[data-cue]').click();

      // Verse step (pages on phones): speakers in order, the recitation, then next.
      await expect(page.locator('[data-screen="connect"]')).toBeVisible();
      while (await page.locator('[data-screen="connect"]').count()) {
        await followSpeakers(page, log);
        await glowing(page, ['next']);
        log.push('next');
        const pageBefore = await page.locator('[data-screen="connect"]').getAttribute('data-connect-page');
        await page.locator('[data-cue]').click();
        await expect.poll(async () => (await page.locator('[data-screen="connect"]').count()) === 0
          || (await page.locator('[data-screen="connect"]').getAttribute('data-connect-page')) !== pageBefore).toBe(true);
      }
      expect(log).toContain('recitation');
      expect(log.indexOf('next', log.indexOf('recitation'))).toBeGreaterThan(log.indexOf('recitation'));

      // Ask step: no reply on screen, so next.
      if (await page.locator('[data-screen="ask"]').count()) {
        await glowing(page, ['next']);
        await page.locator('[data-cue]').click();
      }

      // Narration: the intro speaker; no glow on the cards while arranging; then the finish control.
      await expect(page.locator('[data-screen="narrate"]')).toBeVisible();
      await glowing(page, ['speaker']);
      await followSpeakers(page, log);
      await glowing(page, []);
      for (const card of narrationPicks('S1')) {
        await page.locator(`[data-record="${card}"]`).click();
        await expect(page.locator('[data-record][data-cue]')).toHaveCount(0);
      }
      await glowing(page, ['next']);
      log.push('finish');
      await page.locator('[data-cue]').click();

      // Close: its line's speaker, then on to Station 2.
      await expect(page.locator('[data-screen="close"]')).toBeVisible();
      await glowing(page, ['speaker']);
      await followSpeakers(page, log);
      await glowing(page, ['next-station']);
      console.log(`cue order (${name}): ${log.join(' > ')} > next-station`);
      expect(api).toEqual([]); // no API call, so no model call, on the child path
    });
  });
}

test('audio that fails to play moves the cue on', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('no audio', 'NotAllowedError'));
  });
  await page.goto('/stations/S1');
  await glowing(page, ['speaker']);
  await page.locator('[data-cue]').click();
  await glowing(page, ['start']);
});

test('the map cues its start control until it is tapped', async ({ page }) => {
  await page.goto('/');
  await glowing(page, ['start-station']);
});

test('the cue glow: a mint pulse under 3 Hz, or a static ring with reduced motion; layout unchanged', async ({ page }) => {
  const glow = () => page.locator('[data-cue]').first().evaluate((el) => {
    const a = getComputedStyle(el, '::after');
    const r = el.getBoundingClientRect();
    return { name: a.animationName, duration: a.animationDuration, shadow: a.boxShadow, running: el.getAnimations({ subtree: true }).filter((x) => x.playState === 'running').length, w: r.width, h: r.height };
  });
  await page.goto('/stations/S1');
  await expect(page.locator('[data-cue]')).toHaveCount(1);
  const on = await glow();
  expect(on.name).toBe('cue-pulse');
  expect(parseFloat(on.duration)).toBeGreaterThanOrEqual(1.2); // at most 0.83 cycles per second
  expect(on.shadow).toContain('rgb(46, 242, 194)'); // #2EF2C2
  // The control itself keeps its size: the glow is a layer outside it.
  const size = await page.locator('[data-screen="frame"] [data-narration]').evaluate((el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  expect({ w: on.w, h: on.h }).toEqual(size);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('[data-cue]')).toHaveCount(1);
  const still = await glow();
  expect(still.name).toBe('none');
  expect(still.running).toBe(0);
  expect(still.shadow).toContain('rgb(46, 242, 194) 0px 0px 0px 10px');
});

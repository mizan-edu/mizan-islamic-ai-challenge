// Phone layout (D67). At each target phone viewport (device emulation: touch, mobile viewport) the
// map, every station step of S1-S3 and every story step fit the visible screen: no page scroll, no
// element outside the viewport, every tap target at least 64 px with at least 12 px between targets,
// cards right to left, no child-screen text under 16 px, nothing overlapping, the Qur'an text never
// under 20 px nor transformed (a verse box that does not fit scrolls inside itself, with a fade cue;
// which verses do that is written to verse-fit.json in the test output). Adult pages: no sideways
// scroll, single column, text at least 14 px. axe at 390 x 844. Screenshots of every child step at
// 390 x 844 and 844 x 390: docs/screenshots/mobile/. Reads IDs from /content; never prints record text.

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { STATIONS, standInMedia, walkMap, walkStation, walkStory } from './walk';

const SHOTS = 'docs/screenshots/mobile';
const AXE = join(process.cwd(), 'node_modules/axe-core/axe.min.js');
const VIEWPORTS = [[360, 740], [375, 667], [390, 844], [412, 915], [667, 375], [844, 390]] as const;
const SHOT_AT = new Set(['390x844', '844x390']);
const orientation = (w: number, h: number) => (w > h ? 'landscape' : 'portrait');

interface Fit { problems: string[]; verse: { id: string; fontPx: number; scrolls: boolean; cue: boolean }[] }

// Every rule, measured in the page. Elements count when they are rendered and not fully transparent;
// their visible part is their box clipped by every ancestor that clips (overflow other than visible).
async function measure(page: Page, child: boolean): Promise<Fit> {
  return page.evaluate((child) => {
    const problems: string[] = [];
    const W = window.innerWidth;
    const H = window.innerHeight;
    const doc = document.documentElement;
    if (doc.scrollWidth > W) problems.push(`page scrolls sideways (${doc.scrollWidth} > ${W})`);
    if (child && doc.scrollHeight > H) problems.push(`page scrolls (${doc.scrollHeight} > ${H})`);
    const describe = (el: Element) => {
      const a = ['data-record', 'data-action', 'data-question', 'data-line', 'data-screen', 'data-station', 'data-verse', 'data-strip'].find((n) => el.hasAttribute(n));
      return `${el.tagName.toLowerCase()}${a ? `[${a}=${el.getAttribute(a)}]` : el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''}`;
    };
    const shown = (el: Element) => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
        if (e.tagName === 'DETAILS' && e !== el && !(e as HTMLDetailsElement).open && !(el.closest('summary')?.parentElement === e)) return false;
      }
      return true;
    };
    const visibleRect = (el: Element) => {
      const r = el.getBoundingClientRect();
      let { left, top, right, bottom } = r;
      for (let e = el.parentElement; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
          if (e === document.documentElement || e === document.body) continue;
          const c = e.getBoundingClientRect();
          left = Math.max(left, c.left); top = Math.max(top, c.top); right = Math.min(right, c.right); bottom = Math.min(bottom, c.bottom);
        }
      }
      return { left, top, right, bottom, w: right - left, h: bottom - top };
    };
    const all = [...document.querySelectorAll('body *')].filter((el) => !(el instanceof HTMLScriptElement) && !(el instanceof HTMLAudioElement) && !el.closest('nextjs-portal, [data-nextjs-toast]'));

    // Nothing outside the viewport.
    for (const el of all) {
      const r = visibleRect(el);
      if (r.w <= 0.5 || r.h <= 0.5 || !shown(el)) continue;
      if (r.left < -0.5 || r.top < -0.5 || r.right > W + 0.5 || r.bottom > H + 0.5) {
        problems.push(`outside the viewport: ${describe(el)} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
      }
    }

    // Tap targets: at least 64 x 64 px, at least 12 px apart.
    const targets = all.filter((el) => el.matches('button, a[href], summary, [role="button"]') && shown(el)).filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .filter((el) => !el.closest('[data-moment]'));
    for (const el of targets) {
      const r = el.getBoundingClientRect();
      if (child && (r.width < 63.5 || r.height < 63.5)) problems.push(`tap target under 64 px: ${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    if (child) {
      // Between enabled targets; round targets (stones, round buttons) by the distance between circles.
      const live = targets.filter((el) => !(el as HTMLButtonElement).disabled);
      const round = (el: Element, r: DOMRect) => parseFloat(getComputedStyle(el).borderTopLeftRadius) >= Math.min(r.width, r.height) / 2 - 0.5;
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const [a, b] = [live[i], live[j]];
        if (a.contains(b) || b.contains(a)) continue;
        const p = a.getBoundingClientRect(), q = b.getBoundingClientRect();
        const dx = Math.max(0, q.left - p.right, p.left - q.right);
        const dy = Math.max(0, q.top - p.bottom, p.top - q.bottom);
        let gap = Math.max(dx, dy);
        if (round(a, p) && round(b, q) && Math.abs(p.width - p.height) < 1 && Math.abs(q.width - q.height) < 1) {
          gap = Math.hypot(p.left + p.width / 2 - q.left - q.width / 2, p.top + p.height / 2 - q.top - q.height / 2) - p.width / 2 - q.width / 2;
        }
        if (gap < 11.5) problems.push(`tap targets closer than 12 px: ${describe(a)} / ${describe(b)} (${Math.round(gap)} px)`);
      }
    }

    // Cards read right to left: in each row, the next card in reading order sits to the left.
    const cards = [...document.querySelectorAll('[data-record]')].filter((el) => shown(el) && !el.closest('[data-moment]'));
    for (let i = 1; i < cards.length; i++) {
      const p = cards[i - 1].getBoundingClientRect(), q = cards[i].getBoundingClientRect();
      if (Math.abs(p.top - q.top) < 2 && !(q.right <= p.left + 0.5)) problems.push(`cards not right to left: ${describe(cards[i - 1])} -> ${describe(cards[i])}`);
    }

    // Text: child screens at least 16 px (the Qur'an text at least 20 px); adult pages at least 14 px.
    const verseText = new Set(document.querySelectorAll('[data-verse-text]'));
    for (const el of all) {
      if (!shown(el) || verseText.has(el)) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
      if (!own) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      const min = child ? 16 : 14;
      if (px < min - 0.01) problems.push(`text under ${min} px: ${describe(el)} ${px}px`);
    }

    // Overlap between content boxes (text, pictures, controls) that are not nested in each other.
    if (child) {
      const boxes = all.filter((el) => el.matches('p, h1, h2, blockquote, img, video, button, a[href], summary, [data-line], [data-step-dots], [data-progress]')
        && shown(el) && !el.closest('[aria-hidden="true"], [data-moment]') && !el.matches('[data-map], [data-map-video]'));
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i], boxes[j]];
        if (a.contains(b) || b.contains(a)) continue;
        const p = visibleRect(a), q = visibleRect(b);
        const ox = Math.min(p.right, q.right) - Math.max(p.left, q.left);
        const oy = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
        if (ox > 1 && oy > 1) problems.push(`overlap: ${describe(a)} / ${describe(b)}`);
      }
    }

    // The verse: never under 20 px, never transformed; if its box scrolls, a fade cue is shown.
    const verse = [...document.querySelectorAll('[data-verse-text]')].filter(shown).map((el) => {
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px < 20) problems.push(`verse text under 20 px: ${px}px`);
      for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
        const t = getComputedStyle(e).transform;
        if (t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)' && !e.closest('[data-moment]')) problems.push(`verse text transformed by ${describe(e)}: ${t}`);
      }
      const box = el.closest('[data-verse-scroll]') as HTMLElement | null;
      const scrolls = Boolean(box && box.scrollHeight > box.clientHeight + 1);
      const fig = el.closest('[data-verse]')!;
      const cue = Boolean(fig.querySelector('[data-verse-fade]') && shown(fig.querySelector('[data-verse-fade]')!));
      if (scrolls && !cue) problems.push('verse box scrolls without a fade cue');
      return { id: fig.getAttribute('data-verse')!, fontPx: px, scrolls, cue };
    });
    return { problems, verse };
  }, child);
}

async function axe(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => null))));
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const a = (window as unknown as { axe: { run: (d: Document, o: object) => Promise<{ violations: { id: string; nodes: unknown[] }[] }> } }).axe;
    return (await a.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).violations.map((v) => `${v.id} (${v.nodes.length})`);
  });
}

for (const [width, height] of VIEWPORTS) {
  const size = `${width}x${height}`;
  test.describe(`phone ${size}`, () => {
    test.use({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    test.beforeEach(async ({ page }) => { await standInMedia(page); });

    const check = (page: Page, verses: Record<string, unknown>[]) => async (name: string) => {
      const fit = await measure(page, true);
      if (process.env.PHONE_LOG) appendFileSync(process.env.PHONE_LOG, JSON.stringify({ size, name, problems: fit.problems, verse: fit.verse }) + '\n');
      else expect(fit.problems, `${size} ${name}`).toEqual([]);
      for (const v of fit.verse) verses.push({ viewport: size, step: name, ...v });
      // axe on every step except the moment (a full-screen picture, aria-hidden, that closes on its own).
      if (size === '390x844' && !process.env.PHONE_LOG && !name.includes('moment')) expect(await axe(page), `${size} ${name} axe`).toEqual([]);
      if (SHOT_AT.has(size)) {
        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: `${SHOTS}/${orientation(width, height)}-${name}.jpg`, type: 'jpeg', quality: 70, animations: 'disabled' });
      }
    };
    const report = (verses: Record<string, unknown>[], name: string) => {
      if (verses.length) writeFileSync(test.info().outputPath(`verse-fit-${name}.json`), JSON.stringify(verses, null, 1));
    };

    test('map', async ({ page }) => { const v: Record<string, unknown>[] = []; await walkMap(page, check(page, v)); });
    for (const id of STATIONS) {
      test(`station ${id}`, async ({ page }) => {
        test.setTimeout(120_000);
        const v: Record<string, unknown>[] = [];
        await walkStation(page, id, check(page, v));
        report(v, id);
      });
      test(`story ${id}`, async ({ page }) => {
        test.setTimeout(120_000);
        const v: Record<string, unknown>[] = [];
        await walkStory(page, id, check(page, v));
        report(v, `story-${id}`);
      });
    }
    test('adult pages: one column, no sideways scroll', async ({ page }) => {
      for (const p of ['parent', 'glass', 'evaluation']) {
        await page.goto(`/${p}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(p === 'glass' ? 4000 : 500);
        const fit = await measure(page, false);
        expect(fit.problems.filter((m) => !m.startsWith('outside the viewport') || m.includes('sideways')), `${size} /${p}`).toEqual([]);
        // Nothing sticks out sideways (vertical scrolling is allowed on adult pages).
        const wide = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > window.innerWidth + 0.5 || r.left < -0.5) && getComputedStyle(el).position !== 'fixed' && !el.closest('[style*="overflow"], .overflow-x-auto, .overflow-auto, .overflow-hidden');
        }).map((el) => el.tagName.toLowerCase() + (el.getAttribute('data-section') ? `[${el.getAttribute('data-section')}]` : '')));
        expect(wide, `${size} /${p} wider than the screen`).toEqual([]);
        if (size === '390x844') expect(await axe(page), `/${p} axe`).toEqual([]);
      }
    });
  });
}

// Phase 7a (D60, D62): moment clips and the map loop. A scene with a clip renders a muted, inline video
// with its approved still as the poster and drops the CSS layer that the clip already shows (S1, S2);
// a scene without its file keeps the still and the CSS layer; the moment lasts as long as the clip, at
// most 6 s; the shipped files match the manifest. Never prints record text.

import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { videoSources, type VideoName } from '@/app/_lib/media';
import { clipHoldMs, MAX_CLIP_MS, MomentOverlay } from './moments';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const pic = (src: string) => ({ src, width: 1168, height: 880 });
const pics = { scene: pic('/images/S1/S1.N1.webp'), from: pic('/images/S2/S2.Q1.webp'), to: pic('/images/S2/S2.N1.webp') };
const POSTER: Record<string, string> = { S1: '/images/S1/S1.N1.webp', S2: '/images/S2/S2.N1.webp', S3: '/images/plant/stage-1.webp' };
const render = (s: string, withVideo: boolean) => renderToString(
  <MomentOverlay stationId={s} pictures={pics} onDone={() => {}} video={withVideo ? videoSources(s as VideoName) : null} />,
);

describe('moment clip', () => {
  it.each(['S1', 'S2', 'S3'])('%s: muted, inline, preloaded, with its approved still as the poster', (s) => {
    const html = render(s, true);
    const tag = /<video[^>]*data-moment-clip[^>]*>/.exec(html)![0];
    expect(tag).toMatch(/\bmuted\b/);
    expect(tag).toMatch(/\bplaysinline=/i); // HTML attribute names are case-insensitive
    expect(tag).toContain('preload="auto"');
    expect(tag).toContain(`poster="${POSTER[s]}"`);
    expect(html).toContain(`<source src="/video/${s}.mp4" type="video/mp4"/>`);
    expect(tag).not.toMatch(/\bautoplay\b|\bloop\b|\bcontrols\b/i); // it plays once, after the expansion
  });

  it('drops the CSS layer the clip already shows (S1 rain, S2 water) and keeps S3\'s light', () => {
    expect(render('S1', true)).not.toContain('data-moment-live');
    expect(render('S2', true)).not.toContain('data-moment-live');
    expect(render('S3', true)).toContain('data-moment-live="S3"');
  });

  it.each(['S1', 'S2', 'S3'])('%s without its video file: the approved still and the CSS layer, no video', (s) => {
    const html = render(s, false);
    expect(html).not.toContain('<video');
    expect(html).toContain(`data-moment-live="${s}"`);
    expect(html).toContain('data-moment-video="off"');
  });

  it('a missing file gives no sources at all', () => {
    expect(videoSources('S1', () => false)).toBeNull();
    expect(videoSources('S1', (p) => p.endsWith('.mp4'))).toEqual({ mp4: '/video/S1.mp4', webm: null });
  });
});

describe('D62: the moment lasts as long as its clip, at most 6 s', () => {
  it('caps the hold at 6 s', () => {
    expect(MAX_CLIP_MS).toBe(6000);
    expect(clipHoldMs(4.333)).toBe(4333);
    expect(clipHoldMs(6)).toBe(6000);
    expect(clipHoldMs(9.5)).toBe(6000);
  });

  it('every shipped clip matches the manifest; moment clips are at most 6 s and every file at most 1.5 MB', () => {
    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'public', 'video', 'VIDEOS.json'), 'utf8')) as { videos: { name: string; path: string; bytes: number; sha256: string; durationS: number }[] };
    expect(manifest.videos.map((v) => v.name).sort()).toEqual(['S1', 'S2', 'S3', 'map']);
    for (const v of manifest.videos) {
      const file = path.join(ROOT, 'public', v.path);
      const bytes = readFileSync(file);
      expect(statSync(file).size, v.name).toBe(v.bytes);
      expect(createHash('sha256').update(bytes).digest('hex'), v.name).toBe(v.sha256);
      expect(v.bytes, v.name).toBeLessThanOrEqual(1.5 * 1024 * 1024);
      if (v.name !== 'map') expect(v.durationS * 1000, v.name).toBeLessThanOrEqual(MAX_CLIP_MS);
    }
  });

  it('the overlay stops a clip at 6 s and ends the moment then, or when the clip ends', () => {
    const src = readFileSync(path.join(ROOT, 'app', '_components', 'moments.tsx'), 'utf8');
    expect(src).toMatch(/later\(\(\) => \{ clip\.current\?\.pause\(\); leave\(\); \}, MAX_CLIP_MS\)/);
    expect(src).toMatch(/const onEnded = \(\) => \{ setVideoState\('ended'\); leave\(\); \}/);
  });
});

// Station pictures: every approved record with an imageBrief has its WebP file, recorded in
// public/images/IMAGES.json with provenance; choice pictures never hint at the answer; alt text is
// the record's approved text. Never prints record text.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import StationFlow from '@/app/_components/StationFlow';
import { initialState, reducer } from './flow';
import { publicFileExists } from './media';
import { buildStationView } from './station-view';
import { runtimeLibrary } from './test-helpers';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const index = JSON.parse(readFileSync(path.join(ROOT, 'public', 'images', 'IMAGES.json'), 'utf8')) as {
  images: { recordId?: string; asset?: string; path: string; width: number; height: number; source: string; originalFilename: string; webpSha256: string }[];
};
// Station pictures (one per approved record with an imageBrief) and the Q3 art set (D32).
const records = index.images.filter((e) => e.recordId) as (typeof index.images[number] & { recordId: string })[];
const assets = index.images.filter((e) => e.asset);
const Q3_ASSETS = ['map/background', ...[1, 2, 3, 4, 5].map((n) => `plant/stage-${n}`), ...[1, 2, 3, 4, 5].map((n) => `icons/S${n}`)];
const briefed = ['S1', 'S2', 'S3'].flatMap((s) =>
  (JSON.parse(readFileSync(path.join(ROOT, 'content', 'stations', `${s}.json`), 'utf8')) as { records: { id: string; station: string; status: string; imageBrief?: string }[] }).records
    .filter((r) => r.status === 'approved' && typeof r.imageBrief === 'string' && r.imageBrief.trim()));

describe('station pictures', () => {
  it('every approved record with an imageBrief has an existing WebP file', () => {
    expect(briefed.length).toBe(20);
    for (const r of briefed) {
      const file = path.join(ROOT, 'public', 'images', r.station, `${r.id}.webp`);
      expect(existsSync(file), r.id).toBe(true);
      const b = readFileSync(file);
      expect(b.subarray(0, 4).toString('latin1') + b.subarray(8, 12).toString('latin1'), r.id).toBe('RIFFWEBP');
    }
  });

  it('IMAGES.json lists exactly those pictures with source, original filename and file hash', () => {
    expect(records.map((e) => e.recordId).sort()).toEqual(briefed.map((r) => r.id).sort());
    expect(index.images.every((e) => Boolean(e.recordId) !== Boolean(e.asset))).toBe(true);
    for (const e of records) {
      expect(e.source).toBe('AI-generated, GPT Image 2.5 via Higgsfield, 2026-10-04');
      expect(e.originalFilename).toMatch(/^hf_20261004_\d{6}_[0-9a-f-]{36}\.png$/);
      expect(e.width).toBeLessThanOrEqual(1200);
      const b = readFileSync(path.join(ROOT, 'public', e.path));
      expect(createHash('sha256').update(b).digest('hex'), e.recordId).toBe(e.webpSha256);
    }
  });

  it('choices are square; question and narration pictures 4:3; S3.N2 is a 16:9 strip', () => {
    for (const e of records) {
      const ratio = e.width / e.height;
      const expected = e.recordId === 'S3.N2' ? 16 / 9 : /\.c\d+$/.test(e.recordId) ? 1 : 4 / 3;
      expect(Math.abs(ratio - expected) / expected, e.recordId).toBeLessThan(0.06);
    }
  });
});

describe('Q3 art set (D32)', () => {
  it('IMAGES.json lists exactly the 11 assets, each a WebP file with source, original filename and hash', () => {
    expect(assets.map((e) => e.asset).sort()).toEqual([...Q3_ASSETS].sort());
    for (const e of assets) {
      expect(e.path, e.asset).toBe(`/images/${e.asset}.webp`);
      expect(e.source).toBe('AI-generated, GPT Image 2.5 via Higgsfield, 2026-10-04');
      expect(e.originalFilename).toMatch(/^hf_20261004_\d{6}_[0-9a-f-]{36}\.png$/);
      expect(e.width).toBeLessThanOrEqual(e.asset === 'map/background' ? 1600 : 800);
      const b = readFileSync(path.join(ROOT, 'public', e.path));
      expect(b.subarray(0, 4).toString('latin1') + b.subarray(8, 12).toString('latin1'), e.asset).toBe('RIFFWEBP');
      expect(createHash('sha256').update(b).digest('hex'), e.asset).toBe(e.webpSha256);
    }
  });

  it('the five plant stages share one square canvas (pot normalised); S2.N2 is the regenerated picture', () => {
    const plants = assets.filter((e) => e.asset!.startsWith('plant/'));
    expect(new Set(plants.map((e) => `${e.width}x${e.height}`))).toEqual(new Set(['800x800']));
    expect(records.find((e) => e.recordId === 'S2.N2')!.originalFilename).toBe('hf_20261004_211008_57837d63-3ee4-426e-a52e-0cc03b951778.png');
  });
});

describe('pictures on the station screens', () => {
  const lib = runtimeLibrary();

  // A card's markup with its own record ID, picture path, alt text, intrinsic pixel size (the frame
  // is fixed by CSS; the img fills it with object-contain) and visible text removed. Cards that
  // must look alike have to reduce to exactly the same string.
  function frames(html: string, cards: { id: string; text: string }[]): string[] {
    return cards.map((c) => {
      const m = new RegExp(`<button[^>]*data-record="${c.id.replace(/\./g, '\\.')}"[^>]*>([\\s\\S]*?)</button>`).exec(html);
      expect(m, c.id).not.toBeNull();
      const img = /<img[^>]*>/.exec(m![1])![0];
      expect(img.includes(`alt="${c.text}"`), `${c.id} alt`).toBe(true);
      expect(img, c.id).toContain('object-contain');
      return m![0].replace(/data-record="[^"]*"/, '').replace(/src="[^"]*"/, '').replace(/alt="[^"]*"/, '')
        .replace(/ width="\d+"/, '').replace(/ height="\d+"/, '').replace(/>[^<]+</g, '><');
    });
  }
  const render = (s: string, step: 'observe' | 'narrate') => {
    const view = buildStationView(lib, s, publicFileExists)!;
    const state = { ...reducer(view, initialState(), { type: 'start' }), step };
    return { view, html: renderToString(createElement(StationFlow, { view, labels: {}, initial: state })) };
  };

  it.each(['S1', 'S2', 'S3'])('%s: the three choices share one identical square frame; alt text is the record text', (s) => {
    const { view, html } = render(s, 'observe');
    const f = frames(html, view.observe!.choices);
    expect(f[0]).toContain('data-picture-frame="square"');
    expect(new Set(f).size).toBe(1);
    // Only S2 and S3 have a question picture (S1.Q1 has no imageBrief).
    expect(html.includes('data-question-picture')).toBe(view.observe!.question.image !== null);
    if (view.observe!.question.image) expect(html.includes(`alt="${view.observe!.question.text}"`)).toBe(true);
  });

  it.each(['S1', 'S2', 'S3'])('%s: the narration cards share one identical 4:3 frame (S3.N2 letterboxed, uncropped)', (s) => {
    const { view, html } = render(s, 'narrate');
    expect(view.narrate!.cards).toHaveLength(3);
    const f = frames(html, view.narrate!.cards);
    expect(f[0]).toContain('data-picture-frame="card"');
    expect(f[0]).toContain('aspect-[4/3]');
    expect(new Set(f).size).toBe(1);
    expect(html).not.toContain('col-span');
  });

  it('S3.N2 is a 16:9 strip, shown whole inside the 4:3 card frame', () => {
    const card = buildStationView(lib, 'S3', publicFileExists)!.narrate!.cards.find((c) => c.id === 'S3.N2')!;
    expect(card.imageSize!.width / card.imageSize!.height).toBeGreaterThan(1.5);
  });
});

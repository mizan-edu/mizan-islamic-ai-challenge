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
  images: { recordId: string; path: string; width: number; height: number; source: string; originalFilename: string; webpSha256: string }[];
};
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
    expect(index.images.map((e) => e.recordId).sort()).toEqual(briefed.map((r) => r.id).sort());
    for (const e of index.images) {
      expect(e.source).toBe('AI-generated, GPT Image 2.5 via Higgsfield, 2026-10-04');
      expect(e.originalFilename).toMatch(/^hf_20261004_\d{6}_[0-9a-f-]{36}\.png$/);
      expect(e.width).toBeLessThanOrEqual(1200);
      const b = readFileSync(path.join(ROOT, 'public', e.path));
      expect(createHash('sha256').update(b).digest('hex'), e.recordId).toBe(e.webpSha256);
    }
  });

  it('choices are square; question and narration pictures 4:3; S3.N2 is a 16:9 strip', () => {
    for (const e of index.images) {
      const ratio = e.width / e.height;
      const expected = e.recordId === 'S3.N2' ? 16 / 9 : /\.c\d+$/.test(e.recordId) ? 1 : 4 / 3;
      expect(Math.abs(ratio - expected) / expected, e.recordId).toBeLessThan(0.06);
    }
  });
});

describe('pictures on the station screens', () => {
  const lib = runtimeLibrary();

  it.each(['S1', 'S2', 'S3'])('%s: choice pictures share one frame (no hint at the answer) and alt text is the record text', (s) => {
    const view = buildStationView(lib, s, publicFileExists)!;
    const state = reducer(view, initialState(), { type: 'start' });
    const html = renderToString(createElement(StationFlow, { view, labels: {}, initial: state }));
    const buttons = view.observe!.choices.map((c) => {
      const m = new RegExp(`<button[^>]*data-record="${c.id.replace(/\./g, '\\.')}"[^>]*>([\\s\\S]*?)</button>`).exec(html);
      expect(m, c.id).not.toBeNull();
      const img = /<img[^>]*>/.exec(m![1])![0];
      expect(img.includes(`alt="${c.text}"`), `${c.id} alt`).toBe(true);
      // Everything except the record's own ID, picture path and alt text must be identical.
      return m![0].replace(/data-record="[^"]*"/, '').replace(/src="[^"]*"/, '').replace(/alt="[^"]*"/, '').replace(/>[^<]+</g, '><');
    });
    expect(new Set(buttons).size).toBe(1);
    // Only S2 and S3 have a question picture (S1.Q1 has no imageBrief).
    expect(html.includes('data-question-picture')).toBe(view.observe!.question.image !== null);
    if (view.observe!.question.image) expect(html.includes(`alt="${view.observe!.question.text}"`)).toBe(true);
  });

  it('S3.N2 spans the full row and is never cropped', () => {
    const view = buildStationView(lib, 'S3', publicFileExists)!;
    const card = view.narrate!.cards.find((c) => c.id === 'S3.N2')!;
    expect(card.imageSize!.width / card.imageSize!.height).toBeGreaterThan(1.5);
    let state = reducer(view, initialState(), { type: 'start' });
    state = { ...state, step: 'narrate' };
    const html = renderToString(createElement(StationFlow, { view, labels: {}, initial: state }));
    const m = /<button[^>]*data-record="S3\.N2"[^>]*>[\s\S]*?<\/button>/.exec(html)![0];
    expect(m).toContain('sm:col-span-full');
    expect(m).toContain('data-picture-frame="wide"');
    expect(m).toContain('object-contain');
    expect(m).not.toContain('object-cover');
  });
});

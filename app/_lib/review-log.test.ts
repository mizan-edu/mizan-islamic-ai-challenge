// Review log (content/review-log.json): non-scripture entries may carry before/after text for
// traceability; quran, tafsir and hadith records stay IDs and outcomes only. Never prints text.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findContentDir, type ContentRecord } from './content';
import { loadLibrary, type Library } from './library';
import { containsVerseWording, hasQuranMarks } from './validator';

const dir = findContentDir();
const log = JSON.parse(readFileSync(path.join(dir, 'review-log.json'), 'utf8')) as { meta: { description: string }; entries: Record<string, unknown>[] };
const records = ['S1', 'S2', 'S3'].flatMap((s) => (JSON.parse(readFileSync(path.join(dir, 'stations', `${s}.json`), 'utf8')) as { records: ContentRecord[] }).records);
const typeOf = new Map(records.map((r) => [r.id, r.type]));

describe('review log text', () => {
  it('states the rule in its header', () => {
    expect(log.meta.description).toContain('quran, tafsir and hadith records stay IDs and outcomes only');
  });

  it('no entry for a quran, tafsir or hadith record carries text', () => {
    for (const e of log.entries) {
      if (['quran', 'tafsir', 'hadith'].includes(typeOf.get(String(e.id)) ?? '')) {
        expect(e.before ?? null, String(e.id)).toBeNull();
        expect(e.after ?? null, String(e.id)).toBeNull();
      }
    }
  });

  it('no before/after text contains Qur\'anic marks or verse wording', () => {
    // Every quran record, whatever its status, counts as verse text here.
    const lib = loadLibrary(dir);
    const g: Library = { ...lib, verses: records.filter((r) => r.type === 'quran') };
    for (const e of log.entries) for (const k of ['before', 'after'] as const) {
      const t = e[k];
      if (typeof t === 'string') expect(hasQuranMarks(t) || containsVerseWording(g, t), `${String(e.id)} ${k}`).toBe(false);
    }
  });
});

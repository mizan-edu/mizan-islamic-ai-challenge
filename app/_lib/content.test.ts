// The approved-only loader must never return draft or rejected records.
// Fixtures use synthetic placeholder strings only (R2).

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { approvedOnly, approvedText, findContentDir, loadStations, loadUiStrings } from './content';

const rec = (id: string, status: string, type = 'ui') => ({
  id, station: 'S9', type, role: 'frame', text: `FIXTURE_${id}`, level: 'NA', tts: true, status,
});

function fixtureContent(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'mizan-content-'));
  mkdirSync(path.join(root, 'stations'));
  writeFileSync(path.join(root, 'stations', 'S9.json'), JSON.stringify({
    meta: { stationId: 'S9', titleRecordId: 'S9.TITLE' },
    records: [
      rec('S9.TITLE', 'approved'),
      rec('S9.F1', 'draft'),
      rec('S9.V1', 'rejected', 'quran'),
      rec('S9.V1-ALT', 'draft', 'quran'),
      rec('S9.P1', 'approved'),
      { ...rec('S9.X1', 'approved'), status: 'APPROVED' },
      { ...rec('S9.X2', 'approved'), status: undefined },
    ],
  }));
  writeFileSync(path.join(root, 'ui.json'), JSON.stringify({
    records: [rec('UI.OK', 'approved'), rec('UI.DRAFT', 'draft'), rec('UI.REJECTED', 'rejected')],
  }));
  return root;
}

describe('approved-only loader (fixtures)', () => {
  it('returns approved station records and excludes draft and rejected ones', () => {
    const [s9] = loadStations(fixtureContent());
    expect(s9.stationId).toBe('S9');
    expect(s9.records.map((r) => r.id)).toEqual(['S9.TITLE', 'S9.P1']);
    expect(s9.records.every((r) => r.status === 'approved')).toBe(true);
  });

  it('excludes records whose status is only approximately "approved" or missing', () => {
    const ids = loadStations(fixtureContent())[0].records.map((r) => r.id);
    expect(ids).not.toContain('S9.X1');
    expect(ids).not.toContain('S9.X2');
  });

  it('ui strings: only approved keys are present', () => {
    const ui = loadUiStrings(fixtureContent());
    expect([...ui.keys()]).toEqual(['UI.OK']);
  });

  it('approvedText returns null for draft, rejected and unknown ids', () => {
    const all = [rec('A', 'approved'), rec('B', 'draft'), rec('C', 'rejected')] as never[];
    expect(approvedText(all, 'A')).toBe('FIXTURE_A');
    expect(approvedText(all, 'B')).toBeNull();
    expect(approvedText(all, 'C')).toBeNull();
    expect(approvedText(all, 'Z')).toBeNull();
    expect(approvedText(all, null)).toBeNull();
  });

  it('approvedOnly keeps nothing but status "approved"', () => {
    expect(approvedOnly([{ status: 'approved' }, { status: 'draft' }, { status: 'rejected' }, {}])).toEqual([{ status: 'approved' }]);
  });
});

describe('approved-only loader (repo content)', () => {
  const stations = loadStations(findContentDir());

  it('finds S1-S3 and returns only approved records', () => {
    expect(stations.map((s) => s.stationId)).toEqual(expect.arrayContaining(['S1', 'S2', 'S3']));
    for (const s of stations) expect(s.records.every((r) => r.status === 'approved')).toBe(true);
  });

  it('drops every record that is not approved in the raw files (draft and rejected alike)', () => {
    const loaded = new Set(stations.flatMap((s) => s.records.map((r) => r.id)));
    const dir = path.join(findContentDir(), 'stations');
    let nonApproved = 0;
    for (const s of stations) {
      const raw = JSON.parse(readFileSync(path.join(dir, `${s.stationId}.json`), 'utf8')) as { records: { id: string; status: string }[] };
      for (const r of raw.records.filter((x) => x.status !== 'approved')) {
        nonApproved++;
        expect(loaded.has(r.id), `${r.id} (${r.status}) must not load`).toBe(false);
      }
    }
    expect(nonApproved).toBeGreaterThan(0); // the repo currently holds draft and rejected records
  });
});

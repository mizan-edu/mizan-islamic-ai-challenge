// Approved-only content loader (CLAUDE.md §5: unreviewed content does not exist at runtime).
// Stub for Runbook 2.2: reads /content JSON at build/server time and drops every record whose
// status is not "approved". The content compiler (npm run content:compile) replaces this later.
// Server-only: uses node:fs. Never imports from /scripts (R9).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type RecordStatus = 'draft' | 'approved' | 'rejected';
export type Level = 'A' | 'B' | 'C' | 'D' | 'OUT_OF_SCOPE' | 'NA';

export interface ContentRecord {
  id: string;
  station: string | null;
  type: 'quran' | 'tafsir' | 'hadith' | 'explanation' | 'answer' | 'referral' | 'fallback' | 'ui';
  role?: string;
  text: string;
  level: Level;
  tts: boolean;
  status: RecordStatus;
  [key: string]: unknown;
}

interface ContentFile {
  meta?: { stationId?: string; titleRecordId?: string };
  records?: ContentRecord[];
}

export interface Station {
  stationId: string;
  titleRecordId: string | null;
  records: ContentRecord[]; // approved only
}

export const isApproved = (r: { status?: unknown }): boolean => r.status === 'approved';

export function approvedOnly<T extends { status?: unknown }>(records: readonly T[]): T[] {
  return records.filter(isApproved);
}

// Finds the repo's /content folder whether the process runs from the repo root or from /app.
export function findContentDir(start: string = process.cwd()): string {
  for (const dir of [start, path.join(start, '..')]) {
    const candidate = path.join(dir, 'content');
    if (existsSync(path.join(candidate, 'stations'))) return candidate;
  }
  throw new Error('content directory not found');
}

function readContentFile(file: string): ContentFile {
  return JSON.parse(readFileSync(file, 'utf8')) as ContentFile;
}

export function loadStations(contentDir: string = findContentDir()): Station[] {
  const dir = path.join(contentDir, 'stations');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const file = readContentFile(path.join(dir, name));
      return {
        stationId: file.meta?.stationId ?? path.basename(name, '.json'),
        titleRecordId: file.meta?.titleRecordId ?? null,
        records: approvedOnly(file.records ?? []),
      };
    });
}

export function loadUiStrings(contentDir: string = findContentDir()): Map<string, ContentRecord> {
  const file = path.join(contentDir, 'ui.json');
  if (!existsSync(file)) return new Map();
  return new Map(approvedOnly(readContentFile(file).records ?? []).map((r) => [r.id, r]));
}

// Text of an approved record, or null when the record is missing or not approved.
export function approvedText(records: Iterable<ContentRecord>, id: string | null): string | null {
  if (!id) return null;
  for (const r of records) if (r.id === id && isApproved(r)) return r.text;
  return null;
}

// Placeholders in approved text, resolved at render time; the approved record text is never edited.
// {verseRef} = "<ayah> من سورة <surah>" for the station's approved verse-card record. The surah name
// comes from the KFC hafsData v2.0 metadata (content/kfc-surahs.json, written by
// npm run snapshot:surahs), never typed by hand. The format was set by Hussein on 2026-10-04.
// A text that still contains "{" or "}" after resolution is never rendered.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { findContentDir, loadUiStrings, type ContentRecord } from './content';
import type { Library } from './library';

export type PlaceholderValues = Record<string, string>;
export type SurahNames = Map<number, string>;

const PLACEHOLDER = /\{([^{}]*)\}/g;
export const hasBraces = (text: string): boolean => /[{}]/.test(text);

// Only parent lines may carry placeholders: they render through the station view, which resolves
// them. Every other record is also served raw (replies, narration) and must be brace-free.
export const PLACEHOLDER_ROLES = new Set(['parent_line']);

export function loadSurahNames(contentDir: string = findContentDir()): SurahNames {
  const file = path.join(contentDir, 'kfc-surahs.json');
  if (!existsSync(file)) return new Map();
  const doc = JSON.parse(readFileSync(file, 'utf8')) as { surahs: { number: number; nameAr: string }[] };
  return new Map(doc.surahs.map((s) => [s.number, s.nameAr]));
}

// The station's verse-card verse: the script's connect.verseCard.quranId, approved quran records only.
export function verseCardRecordId(lib: Library, stationId: string): string | null {
  const connect = lib.stations.get(stationId)?.script.find((s) => s.step === 'connect');
  const id = (connect?.verseCard as { quranId?: unknown } | undefined)?.quranId;
  const r = typeof id === 'string' ? lib.byId.get(id) : undefined;
  return r?.type === 'quran' ? r.id : null;
}

export function verseRef(lib: Library, stationId: string, surahs: SurahNames): string | null {
  const id = verseCardRecordId(lib, stationId);
  const m = id ? /^(\d+):(\d+)$/.exec(String(lib.byId.get(id)!.reference)) : null;
  const name = m ? surahs.get(Number(m[1])) : undefined;
  return m && name ? `${Number(m[2])} من سورة ${name}` : null;
}

export function placeholderValues(lib: Library, stationId: string, surahs: SurahNames = loadSurahNames()): PlaceholderValues {
  const values: PlaceholderValues = {};
  const ref = verseRef(lib, stationId, surahs);
  if (ref) values.verseRef = ref;
  return values;
}

// The text with every placeholder filled, or null when one is unknown or any brace remains.
export function resolveText(text: string, values: PlaceholderValues): string | null {
  let unresolved = false;
  const out = text.replace(PLACEHOLDER, (whole, name: string) => {
    const v = values[name];
    if (v === undefined || hasBraces(v)) { unresolved = true; return whole; }
    return v;
  });
  return unresolved || hasBraces(out) ? null : out;
}

// Content check (build time and tests): every approved text that can be rendered must be brace-free
// once resolved. Returns record IDs and reasons only, never text.
export function placeholderProblems(lib: Library, uiRecords: Iterable<ContentRecord>, surahs: SurahNames = loadSurahNames()): string[] {
  const problems: string[] = [];
  for (const [stationId, station] of lib.stations) {
    const values = placeholderValues(lib, stationId, surahs);
    for (const r of station.records) {
      if (!hasBraces(r.text)) continue;
      const names = [...r.text.matchAll(PLACEHOLDER)].map((m) => `{${m[1]}}`).join(' ') || '(stray brace)';
      if (!PLACEHOLDER_ROLES.has(String(r.role))) problems.push(`${r.id}: ${names} outside a parent line (also served unresolved)`);
      else if (resolveText(r.text, values) === null) problems.push(`${r.id}: ${names} cannot be resolved`);
    }
    for (const q of station.anticipatedQuestions) if (hasBraces(q.childQuestion)) problems.push(`${q.id}: brace in a question bubble`);
  }
  for (const r of uiRecords) if (hasBraces(r.text)) problems.push(`${r.id}: brace in a UI string`);
  return problems;
}

// Build-time guard: the prerendered pages call this, so `next build` fails (on Vercel too) when any
// approved text would keep a placeholder or brace. Pages are static, so it never runs per request.
export function assertNoPlaceholderProblems(lib: Library, uiRecords: Iterable<ContentRecord> = loadUiStrings().values(), surahs: SurahNames = loadSurahNames()): void {
  const problems = placeholderProblems(lib, uiRecords, surahs);
  if (problems.length) throw new Error(`Unresolved placeholders in approved content: ${problems.join('; ')}`);
}

// Approved-only library index used by retrieval, router, generation and the citation validator.
// Built from the approved-only loader: draft and rejected records never enter it.

import { findContentDir, loadStations, type AnticipatedQuestion, type ContentRecord, type ScriptStep, type Station } from './content';
import { loadRouterRules, type RouterRule } from './router-rules';

export interface StationIndex {
  stationId: string;
  records: ContentRecord[];
  anticipatedQuestions: AnticipatedQuestion[];
  script: ScriptStep[];
  fallbackId: string | null;
  referralId: string | null;
}

export interface Library {
  byId: Map<string, ContentRecord>;
  stations: Map<string, StationIndex>;
  verses: ContentRecord[]; // approved quran records
  rules: RouterRule[]; // approved router rules only
}

export function buildLibrary(stations: Station[], rules: RouterRule[] = []): Library {
  const byId = new Map<string, ContentRecord>();
  const index = new Map<string, StationIndex>();
  for (const s of stations) {
    for (const r of s.records) {
      if (r.status !== 'approved') continue; // defence in depth: the loader already filters
      byId.set(r.id, r);
    }
    const approved = s.records.filter((r) => r.status === 'approved');
    index.set(s.stationId, {
      stationId: s.stationId,
      records: approved,
      anticipatedQuestions: s.anticipatedQuestions.filter((q) => byId.has(q.responseRecordId)),
      script: s.script,
      fallbackId: approved.find((r) => r.type === 'fallback')?.id ?? null,
      referralId: approved.find((r) => r.type === 'referral')?.id ?? null,
    });
  }
  return {
    byId,
    stations: index,
    verses: [...byId.values()].filter((r) => r.type === 'quran'),
    rules: rules.filter((r) => r.status === 'approved'),
  };
}

export function loadLibrary(contentDir: string = findContentDir()): Library {
  return buildLibrary(loadStations(contentDir), loadRouterRules(contentDir));
}

// The station's fallback, or the first approved fallback in station order when the station has none.
export function fallbackFor(lib: Library, stationId: string | null): ContentRecord | null {
  const own = stationId ? lib.stations.get(stationId)?.fallbackId : null;
  if (own) return lib.byId.get(own) ?? null;
  for (const s of [...lib.stations.values()].sort((a, b) => a.stationId.localeCompare(b.stationId))) {
    if (s.fallbackId) return lib.byId.get(s.fallbackId) ?? null;
  }
  return null;
}

export function referralFor(lib: Library, stationId: string | null): ContentRecord | null {
  const own = stationId ? lib.stations.get(stationId)?.referralId : null;
  return own ? lib.byId.get(own) ?? null : null;
}

// Record IDs a record relies on (basedOn and citations), approved only.
export function sourcesOf(lib: Library, record: ContentRecord): string[] {
  const ids = [
    ...(Array.isArray(record.basedOn) ? (record.basedOn as string[]) : []),
    ...(Array.isArray(record.citations) ? (record.citations as string[]) : []),
  ];
  return ids.filter((id) => lib.byId.has(id));
}

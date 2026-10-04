// Shared test helpers. Never print record text: compare with booleans/hashes only.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { findContentDir, loadStations } from './content';
import { buildLibrary, loadLibrary, type Library } from './library';
import type { RouterRule } from './router-rules';
import { loadSurahNames } from './surahs';

export const sameBytes = (a: string, b: string): boolean => Buffer.from(a, 'utf8').equals(Buffer.from(b, 'utf8'));

// The repo library as it runs today (approved records; approved router rules only).
export const runtimeLibrary = (): Library => loadLibrary();

// The repo library with router rules switched off, to exercise the classifier fallback path.
export function libraryWithoutRules(): Library {
  return buildLibrary(loadStations(findContentDir()), [], loadSurahNames(findContentDir()));
}

// All rules from the file, as written (for checks on the file itself).
export function rulesFile(): RouterRule[] {
  return (JSON.parse(readFileSync(path.join(findContentDir(), 'router-rules.json'), 'utf8')) as { rules: RouterRule[] }).rules;
}

export interface TestItem {
  id: string;
  category: string;
  input: { stationId: string | null; text: string; context?: { onScreen?: string[] }; mutation?: unknown };
  expectedLevel: string;
  expectedBehaviour: string;
  acceptableBehaviours?: string[];
  expectedCitations: string[];
  status: string;
}

export function testItems(): TestItem[] {
  const file = path.join(findContentDir(), '..', 'eval', 'testset.json');
  return (JSON.parse(readFileSync(file, 'utf8')) as { items: TestItem[] }).items;
}

export const item = (id: string): TestItem => {
  const it = testItems().find((i) => i.id === id);
  if (!it) throw new Error(`test item ${id} not found`);
  return it;
};

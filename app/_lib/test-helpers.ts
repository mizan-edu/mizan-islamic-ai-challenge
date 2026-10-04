// Shared test helpers. Never print record text: compare with booleans/hashes only.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { findContentDir, loadStations } from './content';
import { buildLibrary, loadLibrary, type Library } from './library';
import type { RouterRule } from './router-rules';

export const sameBytes = (a: string, b: string): boolean => Buffer.from(a, 'utf8').equals(Buffer.from(b, 'utf8'));

// The repo library as it runs today (approved records; approved router rules only).
export const runtimeLibrary = (): Library => loadLibrary();

// The repo library with the DRAFT router rules switched on in memory, to test the rules as drafted.
export function libraryWithDraftRules(): Library {
  const dir = findContentDir();
  const raw = JSON.parse(readFileSync(path.join(dir, 'router-rules.json'), 'utf8')) as { rules: RouterRule[] };
  return buildLibrary(loadStations(dir), raw.rules.map((r) => ({ ...r, status: 'approved' })));
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

// Verse card explanations: verseCard.explanationIds in order, approved records only; a script
// without the list keeps its single explanationId. Synthetic fixtures; never prints record text.

import { describe, expect, it } from 'vitest';
import type { ContentRecord } from './content';
import { buildLibrary } from './library';
import { buildStationView } from './station-view';

const rec = (id: string, type: ContentRecord['type'], status = 'approved'): ContentRecord =>
  ({ id, station: 'SX', type, text: `FIXTURE_${id}`, level: 'A', tts: type !== 'quran', status } as ContentRecord);

function viewWith(e2Status: string, verseCard: Record<string, unknown>) {
  const records = [rec('SX.V1', 'quran'), rec('SX.E1', 'explanation'), rec('SX.E2', 'explanation', e2Status)];
  const lib = buildLibrary([{
    stationId: 'SX', titleRecordId: null, anticipatedQuestions: [],
    records: records.filter((r) => r.status === 'approved'),
    script: [{ step: 'connect', verseCard: { quranId: 'SX.V1', ...verseCard } }],
  }]);
  return buildStationView(lib, 'SX', () => false, {})!.connect!;
}

describe('verse card explanations', () => {
  it('shows E1 only while E2 is a draft, then E1 followed by E2 once approved', () => {
    const card = { explanationId: 'SX.E1', explanationIds: ['SX.E1', 'SX.E2'] };
    expect(viewWith('draft', card).explanations.map((r) => r.id)).toEqual(['SX.E1']);
    expect(viewWith('approved', card).explanations.map((r) => r.id)).toEqual(['SX.E1', 'SX.E2']);
  });

  it('falls back to the single explanationId when no list is given', () => {
    expect(viewWith('approved', { explanationId: 'SX.E1' }).explanations.map((r) => r.id)).toEqual(['SX.E1']);
  });

  it('never shows a verse record as an explanation line', () => {
    expect(viewWith('approved', { explanationIds: ['SX.V1', 'SX.E1'] }).explanations.map((r) => r.id)).toEqual(['SX.E1']);
  });
});

import type { Metadata } from 'next';
import { pickableItems } from '@/app/_lib/eval-data';
import { loadLabels } from '@/app/_lib/labels';
import { loadLibrary } from '@/app/_lib/library';
import { buildStationView } from '@/app/_lib/station-view';
import { MAX_CHARS } from '@/app/_lib/try-limits';
import GlassBox, { type GlassPreset } from './GlassBox';
import { PRESET_IDS } from './presets';

// Glass-box view (D60): for judges and parents, not part of the child journey. Every step it shows
// comes from the real trace of /api/try (adult questions and test-set examples) or /api/ask?judge=1
// (the child path). Static page; the only runtime calls are those two routes.

export const metadata: Metadata = { title: 'MIZAN glass box' };

export default function GlassPage() {
  const lib = loadLibrary();
  const views = [...lib.stations.keys()].sort().map((id) => buildStationView(lib, id)).filter((v) => v !== null);
  const items = pickableItems();
  const presets: GlassPreset[] = PRESET_IDS.flatMap(({ id, outcome }) => {
    const it = items.find((i) => i.id === id);
    return it ? [{ id, outcome, category: it.category, stationId: it.stationId }] : [];
  });
  return (
    <GlassBox
      labels={loadLabels()}
      stations={views.map((v) => ({ id: v.stationId, title: v.title?.text ?? v.stationId, questions: v.ask }))}
      sources={Object.assign({}, ...views.map((v) => v.sources))}
      presets={presets}
      maxChars={MAX_CHARS}
    />
  );
}

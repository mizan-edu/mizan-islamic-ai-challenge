import JourneyMap, { type MapStation } from '@/app/_components/JourneyMap';
import { approvedText } from '@/app/_lib/content';
import { loadLabels } from '@/app/_lib/labels';
import { loadLibrary } from '@/app/_lib/library';
import { stageFromMarker } from '@/app/_lib/station-view';

// Journey map: only the must-ship stations S1-S3 (CLAUDE.md §4). S4-S5 are roadmap and not shown.
const JOURNEY = ['S1', 'S2', 'S3'] as const;

export default function Home() {
  const lib = loadLibrary();
  const labels = loadLabels();
  const stations: MapStation[] = JOURNEY.filter((id) => lib.stations.has(id)).map((id, i) => {
    const st = lib.stations.get(id)!;
    const titleId = st.records.find((r) => r.role === 'title')?.id ?? null;
    const close = st.script.find((s) => s.step === 'close');
    return { id, number: i + 1, title: approvedText(st.records, titleId), stage: stageFromMarker(close?.progressMarker) };
  });
  return <JourneyMap title={labels.journeyTitle ?? null} stations={stations} parentsLabel={labels.parents} />;
}

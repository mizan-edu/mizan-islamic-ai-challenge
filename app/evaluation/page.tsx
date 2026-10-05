import type { Metadata } from 'next';
import { loadEvalPageData, pickableItems } from '@/app/_lib/eval-data';
import { loadLabels } from '@/app/_lib/labels';
import { loadLibrary } from '@/app/_lib/library';
import { buildStationView } from '@/app/_lib/station-view';
import EvaluationContent from './EvaluationContent';
import { T } from './text';

// Evaluation page (Runbook 3.7, D45): adult-facing, Arabic, RTL. Every figure is read at build time
// from committed files (eval/results, eval/testset.json, /content) through eval-data.ts and links to
// its source file on GitHub. Static: the only runtime call is «جرّب سؤالًا» (/api/try).

export const metadata: Metadata = { title: T.title };

export default function EvaluationPage() {
  const data = loadEvalPageData();
  const lib = loadLibrary();
  const stations = [...lib.stations.keys()].sort().map((id) => ({ id, title: buildStationView(lib, id)?.title?.text ?? id }));
  return <EvaluationContent data={data} labels={loadLabels()} stations={stations} items={pickableItems()} />;
}

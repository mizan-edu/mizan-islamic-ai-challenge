import { notFound } from 'next/navigation';
import StationFlow from '@/app/_components/StationFlow';
import { loadLabels } from '@/app/_lib/labels';
import { loadLibrary } from '@/app/_lib/library';
import { buildStationView } from '@/app/_lib/station-view';

const STATIONS = ['S1', 'S2', 'S3'];

export const dynamicParams = false;
export function generateStaticParams() {
  return STATIONS.map((id) => ({ id }));
}

export default async function StationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!STATIONS.includes(id)) notFound();
  const view = buildStationView(loadLibrary(), id);
  if (!view) notFound();
  return <StationFlow view={view} labels={loadLabels()} />;
}

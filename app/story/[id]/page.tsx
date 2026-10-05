import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StoryPlayer from '@/app/_components/StoryPlayer';
import { loadLabels } from '@/app/_lib/labels';
import { loadLibrary } from '@/app/_lib/library';
import { availableSfx, videoSources, type VideoName } from '@/app/_lib/media';
import { assertNoPlaceholderProblems } from '@/app/_lib/placeholders';
import { buildStationView } from '@/app/_lib/station-view';
import { buildStorySteps } from '@/app/_lib/story';

// Static story mode (D47): the pilot's control condition for Stations 1–3. Same approved script,
// pictures and audio as the station, played in order with no interaction. Not linked from the map;
// reached by URL or from the parent page. Static pages: no request at runtime except the recitation.

const STATIONS = ['S1', 'S2', 'S3'];

export const dynamicParams = false;
export const metadata: Metadata = { robots: { index: false, follow: false } };
export function generateStaticParams() {
  return STATIONS.map((id) => ({ id }));
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!STATIONS.includes(id)) notFound();
  const lib = loadLibrary();
  assertNoPlaceholderProblems(lib);
  const view = buildStationView(lib, id);
  if (!view) notFound();
  return <StoryPlayer view={view} steps={buildStorySteps(view)} labels={loadLabels()} sfxCues={availableSfx()} video={videoSources(view.stationId as VideoName)} />;
}

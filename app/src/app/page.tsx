import { approvedText, loadStations, loadUiStrings } from '@/lib/content';

// Home: journey title + one card per station. All Arabic text comes from approved /content records;
// nothing child-facing is hard-coded here (CLAUDE.md §5.3).
const STATION_SLOTS = [
  { id: 'S1', tone: 'bg-water' },
  { id: 'S2', tone: 'bg-water' },
  { id: 'S3', tone: 'bg-leaf' },
  { id: 'S4', tone: 'bg-leaf' }, // roadmap: stretch station, only after the Monday 13:00 scope gate
  { id: 'S5', tone: 'bg-leaf' }, // roadmap: stretch station, only after the Monday 13:00 scope gate
] as const;

export default function Home() {
  const journeyTitle = approvedText(loadUiStrings().values(), 'UI.JOURNEY_TITLE');
  const stations = new Map(loadStations().map((s) => [s.stationId, s]));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-8 md:py-12">
      {journeyTitle && (
        <h1 className="text-center text-4xl font-bold leading-relaxed md:text-5xl">{journeyTitle}</h1>
      )}

      <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {STATION_SLOTS.map((slot, i) => {
          const station = stations.get(slot.id);
          const title = station ? approvedText(station.records, station.titleRecordId) : null;
          const ready = Boolean(title);
          return (
            <li
              key={slot.id}
              data-station={slot.id}
              data-ready={ready}
              className={`flex min-h-36 items-center gap-5 rounded-3xl p-5 shadow-sm ${ready ? 'bg-white' : 'bg-sand/60'}`}
            >
              <span
                className={`flex size-20 shrink-0 items-center justify-center rounded-full text-4xl font-bold text-white ${ready ? slot.tone : 'bg-muted/40'}`}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              {title && <span className="text-2xl font-bold leading-relaxed">{title}</span>}
            </li>
          );
        })}
      </ol>
    </main>
  );
}

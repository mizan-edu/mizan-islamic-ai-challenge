import Link from 'next/link';
import JudgeSwitch from '@/app/_components/JudgeSwitch';
import SfxSwitch from '@/app/_components/SfxSwitch';
import { loadLabels } from '@/app/_lib/labels';
import { loadLibrary } from '@/app/_lib/library';
import { assertNoPlaceholderProblems } from '@/app/_lib/placeholders';
import { buildStationView } from '@/app/_lib/station-view';

// Parent summary: the approved parent lines (PS records) of each station. No child data is shown
// or collected here; the device-only session log stays on the device.
export default function ParentPage() {
  const lib = loadLibrary();
  assertNoPlaceholderProblems(lib); // fails the build, never a request: this page is static
  const labels = loadLabels();
  const views = ['S1', 'S2', 'S3'].map((id) => buildStationView(lib, id)).filter((v) => v !== null);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8" data-screen="parent">
      {labels.parents && <h1 className="font-display text-4xl text-ink">{labels.parents}</h1>}
      {labels.sfx && <SfxSwitch label={labels.sfx} />}
      {labels.judgeMode && <JudgeSwitch label={labels.judgeMode} />}
      {views.map((v) => (
        <section key={v.stationId} id={v.stationId} className="card flex flex-col gap-3 p-6">
          {v.title && <h2 className="font-display text-2xl leading-relaxed text-ink">{v.title.text}</h2>}
          {v.parent.map((r) => <p key={r.id} data-line={r.id} className="text-xl leading-relaxed text-ink-2">{r.text}</p>)}
        </section>
      ))}
      <Link href="/" className="self-start py-4 text-ink-2 underline">MIZAN</Link>
    </main>
  );
}

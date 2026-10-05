import Link from 'next/link';
import JudgeSwitch from '@/app/_components/JudgeSwitch';
import ParentGate from '@/app/_components/ParentGate';
import ResetJourney from '@/app/_components/ResetJourney';
import SfxSwitch from '@/app/_components/SfxSwitch';
import { loadLabels } from '@/app/_lib/labels';
import { loadLibrary } from '@/app/_lib/library';
import { assertNoPlaceholderProblems } from '@/app/_lib/placeholders';
import { buildStationView } from '@/app/_lib/station-view';
import { MAX_CHARS } from '@/app/_lib/try-limits';
import { T as EVAL } from '@/app/evaluation/text';
import ParentAsk from './ParentAsk';
import SessionSummary from './SessionSummary';
import { PILOT } from './text';

// Parent page: the session summary card (approved PS lines of the completed stations, built on the
// device; D57), the sound switch, the parental gate (AI-lens switch and Parent Ask), the pilot reset
// and the story links. No child data is collected here; the device-only session log stays on the device.
export default function ParentPage() {
  const lib = loadLibrary();
  assertNoPlaceholderProblems(lib); // fails the build, never a request: this page is static
  const labels = loadLabels();
  const views = ['S1', 'S2', 'S3'].map((id) => buildStationView(lib, id)).filter((v) => v !== null);
  // Parent Ask (D54): every station's record sources, for the source chips under a reply.
  const sources = Object.assign({}, ...views.map((v) => v.sources));
  const stations = views.map((v) => ({ id: v.stationId, title: v.title?.text ?? v.stationId }));
  // Parent summary card (D54): each station's hint ladder (then the "together" rung) and PS lines.
  const summaryStations = views.map((v) => ({
    id: v.stationId,
    title: v.title?.text ?? v.stationId,
    hintIds: [...(v.observe?.hints.map((h) => h.id) ?? []), ...(v.observe?.together ? [v.observe.together.id] : [])],
    parent: v.parent,
  }));
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8" data-screen="parent">
      {labels.parents && <h1 className="font-display text-4xl text-ink">{labels.parents}</h1>}
      {labels.sfx && <SfxSwitch label={labels.sfx} />}
      {/* Behind the parental gate (D54): the AI-lens switch (?judge=1 on any page stays the judges'
          entry) and Parent Ask. */}
      <ParentGate prompt={labels.gatePrompt}>
        <div className="flex flex-col gap-6" data-gated>
          {labels.judgeMode && <JudgeSwitch label={labels.judgeMode} />}
          <ParentAsk stations={stations} sources={sources} labels={labels} maxChars={MAX_CHARS} />
        </div>
      </ParentGate>
      <SessionSummary stations={summaryStations} />
      <ResetJourney text={PILOT} />
      <section className="card flex flex-col gap-3 p-6" data-story-links>
        <h2 className="font-display text-2xl text-ink">{PILOT.storyHeading}</h2>
        <ul className="flex flex-col gap-2">
          {views.map((v) => (
            <li key={v.stationId}><Link href={`/story/${v.stationId}`} className="text-xl text-water underline" data-story-link={v.stationId}>{v.title?.text ?? v.stationId}</Link></li>
          ))}
        </ul>
      </section>
      <div className="flex flex-wrap gap-x-6">
        <Link href="/evaluation" className="py-4 font-display text-xl text-water underline" data-evaluation-link>{EVAL.judgeLink}</Link>
        <Link href="/" className="py-4 text-ink-2 underline">MIZAN</Link>
      </div>
    </main>
  );
}

// Evaluation page content (Runbook 3.7, D45). Server component: renders the figures from
// eval-data.ts (each with a link to its source file on GitHub) and mounts «جرّب سؤالًا».

import Link from 'next/link';
import type { EvalPageData, Rate } from '@/app/_lib/eval-data';
import type { Labels } from '@/app/_lib/labels';
import { MAX_CHARS } from '@/app/_lib/try-limits';
import { LIVE_URL, REPO_URL, sourceUrl, T } from './text';
import TryQuestion, { type PickItem } from './TryQuestion';

const pct = (x: number) => `${Number((x * 100).toFixed(1))}%`;
const usd = (x: number | null) => (x === null ? '—' : `$${x.toFixed(4)}`);

const Src = ({ path }: { path: string }) => (
  <a href={sourceUrl(path)} className="text-sm text-water underline" dir="ltr" data-source={path}>{T.source}: {path.split('/').at(-1)}</a>
);

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} aria-labelledby={`${id}-h`} className="card flex flex-col gap-4 p-6" data-section={id}>
    <h2 id={`${id}-h`} className="font-display text-3xl text-ink">{title}</h2>
    {children}
  </section>
);

const Badge = ({ children, tone = 'leaf' }: { children: React.ReactNode; tone?: 'leaf' | 'sun' }) => (
  <span className={`inline-block self-start rounded-full px-4 py-1 font-display text-base ${tone === 'leaf' ? 'bg-leaf-soft text-leaf-dark' : 'bg-sun-soft text-ink'}`}>{children}</span>
);

const rateCell = (x: unknown) => {
  const r = x as Rate | undefined;
  return r && typeof r === 'object' ? `${r.count}/${r.n} (${Number((r.rate * 100).toFixed(1))}%)` : '—';
};

function Compare({ a2 }: { a2: NonNullable<EvalPageData['a2']> }) {
  const { summary: s } = a2;
  const rows = s.detectors.filter((d) => d !== 'words_mean');
  return (
    <>
      <p className="text-lg leading-relaxed text-ink">{T.compare.method(s.meta.model, s.meta.items)} <Src path={a2.method} /></p>
      {s.interpretationApplies && <p className="font-display text-xl leading-relaxed text-ink" data-a2-interpretation>{T.compare.interpretation}</p>}
      {/* Scrolls sideways on a phone: a focusable, labelled region (axe). */}
      <div className="overflow-x-auto" role="region" aria-labelledby="compare-h" tabIndex={0}>
        <table className="w-full border-collapse text-start text-base" data-compare-table>
          <thead><tr>{T.compare.cols.map((c) => <th key={c} scope="col" className="border-b border-stone px-2 py-2 text-start font-display text-ink">{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d} data-detector={d}>
                <th scope="row" className="border-b border-stone px-2 py-2 text-start font-normal text-ink">{T.compare.detectors[d] ?? d}</th>
                <td className="border-b border-stone px-2 py-2" dir="ltr">{rateCell(s.overall.mizan[d])}</td>
                <td className="border-b border-stone px-2 py-2" dir="ltr">{rateCell(s.overall.baseline[d])}</td>
              </tr>
            ))}
            <tr data-detector="words_mean">
              <th scope="row" className="border-b border-stone px-2 py-2 text-start font-normal text-ink">{T.compare.words}</th>
              <td className="border-b border-stone px-2 py-2" dir="ltr">{s.overall.mizan.words_mean}</td>
              <td className="border-b border-stone px-2 py-2" dir="ltr">{s.overall.baseline.words_mean}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="font-display text-lg text-ink" data-no-baseline-text>{T.compare.noText}</p>
      <h3 className="font-display text-2xl text-ink">{T.compare.limitsTitle}</h3>
      <ul className="list-disc ps-6 text-base leading-relaxed text-ink">
        {T.compare.limits(s.limitCounts.baselineReferralOtherWording, s.limitCounts.baselineProphetMentionWithoutMarker).map((l) => <li key={l}>{l}</li>)}
      </ul>
      <p className="text-base text-ink-2">{T.compare.cost(`${s.meta.baselineCostUsd.toFixed(4)}`)} <Src path={a2.source} /></p>
    </>
  );
}

export default function EvaluationContent({ data, labels, stations, items }: { data: EvalPageData; labels: Labels; stations: { id: string; title: string }[]; items: PickItem[] }) {
  const s = data.suite;
  // Active items not offered in the picker (built at runtime from an altered verse); results are in the table.
  const pickable = new Set(items.map((i) => i.id));
  const activeNotPickable = data.testset.activeIds.filter((id) => !pickable.has(id));
  const im = data.improvements;
  const sc = data.content.scholar;
  const vt = data.content.verseText;
  const verseSource = T.verseSource(vt.platform, vt.file, vt.version);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-8" data-screen="evaluation">
      <h1 className="font-display text-4xl text-ink">{T.title}</h1>

      <Section id="about" title={T.heading.about}>
        <Badge>{T.badgeBuilt}</Badge>
        <p className="text-lg leading-loose text-ink" data-about>{T.about(verseSource)}</p>
      </Section>

      <Section id="try" title={T.heading.try}>
        <TryQuestion stations={stations} items={items} excluded={activeNotPickable} labels={labels} maxChars={MAX_CHARS} />
      </Section>

      <Section id="results" title={T.heading.results}>
        <p className="text-lg text-ink">{T.results.intro(s.items, s.executions, s.model ?? '—')}</p>
        {/* Scrolls sideways on a phone: a focusable, labelled region so keyboard users can scroll it (axe). */}
        <div className="overflow-x-auto" role="region" aria-labelledby="results-h" tabIndex={0} data-results-scroll>
          <table className="w-full border-collapse text-start text-base" data-results-table>
            <thead>
              <tr>{T.results.cols.map((c) => <th key={c} scope="col" className="border-b border-stone px-2 py-2 text-start font-display text-ink">{c}</th>)}</tr>
            </thead>
            <tbody>
              {s.categories.map((c) => {
                const isB = c.category === 'B';
                return (
                  <tr key={c.category} data-category={c.category}>
                    <th scope="row" className="border-b border-stone px-2 py-2 text-start font-normal text-ink">{c.category} · {T.results.categories[c.category] ?? ''}</th>
                    <td className="border-b border-stone px-2 py-2">{c.items}</td>
                    {c.perRun.map((r, i) => <td key={i} className="border-b border-stone px-2 py-2" dir="ltr">{pct(r)}</td>)}
                    <td className="border-b border-stone px-2 py-2" data-mean={c.category}>
                      {isB ? <span data-b-before-after>{T.results.bBeforeAfter(pct(data.d41.before), pct(data.d41.after))}</span> : <span dir="ltr">{pct(c.mean)}</span>}
                    </td>
                    <td className="border-b border-stone px-2 py-2" dir="ltr">{c.threshold < 1 ? `≥ ${pct(c.threshold)}` : pct(c.threshold)}</td>
                    <td className="border-b border-stone px-2 py-2">{(isB ? data.d41.after >= c.threshold - 1e-9 : c.met) ? T.results.yes : T.results.no}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-base text-ink-2">{T.results.bExplain} <Src path={data.d41.run.source} /></p>
        {s.categories.filter((c) => c.rerun).map((c) => (
          <p key={c.category} className="text-base text-ink-2" data-rerun={c.category}>
            {T.results.rerun(c.category, c.rerun!.added.join(' و'), c.rerun!.decision, c.rerun!.items, c.rerun!.all3, c.rerun!.sameLevelRecord)} <Src path={c.rerun!.run.source} />
          </p>
        ))}
        <p className="flex flex-wrap gap-x-4">{s.runs.map((r) => <Src key={r.runId} path={r.source} />)}</p>

        <h3 className="font-display text-2xl text-ink">{T.results.consistencyTitle}</h3>
        <ul className="list-disc ps-6 text-lg text-ink">
          <li>{T.results.all3(s.all3, s.items)}</li>
          <li>{T.results.same(s.sameLevelRecord, s.items)}</li>
        </ul>

        <h3 className="font-display text-2xl text-ink">{T.results.costTitle}</h3>
        <ul className="list-disc ps-6 text-lg text-ink">
          <li>{T.results.cost(usd(s.cost.perExecution), usd(s.cost.perCall), s.cost.calls, s.executions)}</li>
          <li>{T.results.latency(s.latency.execP50, s.latency.execP95)}</li>
          {s.latency.callP50 !== null && <li>{T.results.callLatency(s.latency.callP50, s.latency.callP95 ?? 0)}</li>}
        </ul>

        <h3 className="font-display text-2xl text-ink">{T.results.notActiveTitle}</h3>
        <ul className="list-disc ps-6 text-base text-ink" data-not-active>
          {data.notActive.map((n) => <li key={n.id}><span dir="ltr">{n.id}</span> ({n.category}) — {T.results.reason[n.reason]}</li>)}
        </ul>
        <Src path={data.testset.source} />
      </Section>

      <Section id="safety" title={T.heading.safety}>
        <p className="text-lg text-ink" data-approved>{T.safety.approved(data.content.approved.value)} ({Object.entries(data.content.byType).map(([k, v]) => `${v} ${T.safety.types[k] ?? k}`).join('، ')})</p>
        <h3 className="font-display text-2xl text-ink">{T.safety.sourcesTitle}</h3>
        <ul className="list-disc ps-6 text-lg leading-relaxed text-ink">
          <li data-verse-source>{T.safety.quran(verseSource, data.content.quran.count)} <Src path={vt.snapshot} /></li>
          <li data-font-source>{T.safety.font(T.fontName, data.content.font)} <Src path="LICENSES.md" /></li>
          <li>{T.safety.tafsir(data.content.tafsir.platform, data.content.tafsir.edition, data.content.tafsir.count)}</li>
          <li>{T.safety.recitation(data.content.recitation.platform, data.content.recitation.reciter, data.content.recitation.rewaya)} <Src path={data.content.recitation.snapshot} /></li>
        </ul>
        <p className="text-lg text-ink">{T.safety.voice}</p>
        <p className="text-lg text-ink">{T.safety.validator}</p>
        <p className="text-lg text-ink" data-scholar>
          {T.safety.scholar(sc.byDate, Object.entries(sc.byKind).map(([k, v]) => `${v} ${T.safety.kinds[k] ?? k}`).join('، '))} {T.scholarLabel}. <Src path={sc.source} />
        </p>
        <Src path={data.content.approved.source} />
      </Section>

      <Section id="log" title={T.heading.log}>
        <ul className="list-disc ps-6 text-lg leading-relaxed text-ink">
          <li>{T.log.run1dev2(pct(im.run1.a), pct(im.dev2.a))} <Src path={im.run1.run.source} /> <Src path={im.dev2.run.source} /></li>
          <li>{T.log.dev2dev4(pct(im.dev2.a), pct(im.dev4.a), pct(im.dev3.a))} <Src path={im.dev4.run.source} /></li>
          <li>{T.log.a12(im.a12.failedIn.length, im.a12.passedIn.length)}</li>
          <li>{T.log.d41(pct(data.d41.before), pct(data.d41.after))} <Src path={data.d41.run.source} /></li>
          <li>{T.log.d38}</li>
        </ul>
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-stone p-4" data-pilot>
          <h3 className="font-display text-2xl text-ink">{T.pilot}</h3>
          <Badge tone="sun">{T.pilotPending}</Badge>
        </div>
        <Src path="docs/decisions.md" />
      </Section>

      <Section id="reliability" title={T.heading.reliability}>
        <p className="text-lg leading-relaxed text-ink">{T.reliability.chain}</p>
        <p className="text-lg text-ink">{T.reliability.tests} <Src path="app/_lib/fallback.test.ts" /></p>
        <p className="text-lg text-ink">{T.reliability.secondary}</p>
      </Section>

      <Section id="limits" title={T.heading.limits}>
        <ul className="list-disc ps-6 text-lg leading-relaxed text-ink">
          <li>{T.limits.a04(data.limits.a04.passed, data.limits.a04.runs)}</li>
          <li>{T.limits.d09(data.limits.d09Levels.join(' ثم '))} {data.limits.d09Sources.map((p) => <Src key={p} path={p} />)}</li>
          <li>{T.limits.stations(data.limits.stationsBuilt, data.limits.stationsPlanned)}</li>
          <li>{T.limits.typing}</li>
        </ul>
      </Section>

      <Section id="compare" title={T.heading.compare}>
        {data.a2 ? <Compare a2={data.a2} /> : <Badge tone="sun">{T.pendingTuesday}</Badge>}
      </Section>

      <Section id="vision" title={T.heading.vision}>
        <Badge tone="sun">{T.pendingTuesday}</Badge>
        <p className="text-base text-ink-2">{T.vision(T.badgeFuture)}</p>
      </Section>

      <footer className="flex flex-wrap gap-x-6 gap-y-2 py-4 text-lg" data-footer>
        <a href={REPO_URL} className="text-water underline">{T.footer.repo}</a>
        {data.links.testingMd && <a href={sourceUrl('TESTING.md')} className="text-water underline">{T.footer.testing}</a>}
        <a href={LIVE_URL} className="text-water underline">{T.footer.live}</a>
        <Link href="/" className="text-water underline">MIZAN</Link>
      </footer>
    </main>
  );
}


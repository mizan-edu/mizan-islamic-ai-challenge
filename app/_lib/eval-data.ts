// Evaluation page data (Runbook 3.7, D45), read at build time from committed files only: the result
// files in eval/results, the test set, the approved library in /content, the review log and the
// ingestion snapshot. Nothing on the page is typed by hand; every figure carries its source path.
// IDs, counts and rates only: no verse, tafsir or hadith text passes through here.

// Build-time reads only (the page is static): turbopackIgnore keeps these paths out of output tracing.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { findContentDir } from './content';
import { loadLibrary } from './library';
import { ROADMAP_STATIONS } from './roadmap';

export interface Result {
  itemId: string; category: string; run: number; passed: boolean; assignedLevel: string; behaviourClass: string;
  citedRecordIds: string[]; latencyMs: number; costUsd: number | null; modelCalls: { ms: number }[];
}
interface ResultFile { meta: { runId: string; commit: string; modelId: string | null; runs: number }; results: Result[] }
interface TestItem { id: string; category: string; status: string; note?: string; input: { stationId: string | null; text: string; mutation?: unknown } }
interface TestSet { meta: { thresholds: Record<string, string> }; items: TestItem[] }

export interface Sourced<T> { value: T; source: string } // source: repo-relative path
export interface CategoryRow { category: string; items: number; perRun: number[]; mean: number; threshold: number; met: boolean }
export interface RunRef { runId: string; commit: string; source: string }

export interface EvalPageData {
  suite: {
    runs: RunRef[]; model: string | null; categories: CategoryRow[]; items: number; executions: number;
    all3: number; sameLevelRecord: number;
    cost: { total: number | null; perExecution: number | null; perCall: number | null; calls: number };
    latency: { execP50: number; execP95: number; callP50: number | null; callP95: number | null };
  };
  d41: { before: number; after: number; run: RunRef; afterPerRun: number[] };
  notActive: { id: string; category: string; status: string; reason: 'scholar_removed' | 'draft' | 'other' }[];
  testset: { source: string; active: number; activeIds: string[] };
  improvements: {
    run1: { a: number; run: RunRef }; dev2: { a: number; run: RunRef }; dev3: { a: number; run: RunRef }; dev4: { a: number; run: RunRef };
    a12: { failedIn: string[]; passedIn: string[] };
  };
  content: {
    approved: Sourced<number>; byType: Record<string, number>;
    tafsir: { platform: string; edition: string; count: number }; quran: { platform: string; count: number };
    font: string; recitation: { platform: string; reciter: string; rewaya: string; snapshot: string };
    verseText: { platform: string; file: string; version: string; snapshot: string }; // as recorded in the snapshot
    scholar: { date: string; count: number; byKind: Record<string, number>; source: string };
  };
  limits: { a04: { passed: number; runs: number }; d09Levels: string[]; d09Sources: string[]; stationsBuilt: number; stationsPlanned: number };
  links: { testingMd: boolean };
}

export interface EvalDataPaths { root?: string; resultsDir?: string; contentDir?: string }

const rel = (root: string, p: string) => path.relative(root, p).split(path.sep).join('/');
const rate = (rs: Result[]) => (rs.length ? rs.filter((r) => r.passed).length / rs.length : 0);
export const quantile = (vals: number[], q: number): number => {
  const s = [...vals].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))] ?? 0;
};

export function loadEvalPageData(paths: EvalDataPaths = {}): EvalPageData {
  const contentDir = paths.contentDir ?? findContentDir();
  const root = paths.root ?? path.dirname(contentDir);
  const resultsDir = paths.resultsDir ?? path.join(root, 'eval', 'results');
  const files = readdirSync(/*turbopackIgnore: true*/ resultsDir).filter((f) => f.endsWith('.json')).sort();
  // The latest result file for a run-ID prefix.
  const load = (prefix: string): { file: ResultFile; ref: RunRef } => {
    const f = files.filter((n) => n.startsWith(prefix)).at(-1);
    if (!f) throw new Error(`no result file ${prefix}*`);
    const file = JSON.parse(readFileSync(/*turbopackIgnore: true*/ path.join(resultsDir, f), 'utf8')) as ResultFile;
    return { file, ref: { runId: file.meta.runId, commit: file.meta.commit.slice(0, 7), source: rel(root, path.join(resultsDir, f)) } };
  };

  const testsetPath = path.join(root, 'eval', 'testset.json');
  const testset = JSON.parse(readFileSync(/*turbopackIgnore: true*/ testsetPath, 'utf8')) as TestSet;
  const thresholdOf = (c: string) => Number(/(\d+)\s*%/.exec(testset.meta.thresholds[c] ?? '')?.[1] ?? 100) / 100;

  // ---- Monday suite (3 runs) ----
  const mon = [1, 2, 3].map((n) => load(`mon-r${n}-`));
  const results = mon.flatMap(({ file }, i) => file.results.map((r) => ({ ...r, run: i + 1 })));
  const cats = [...new Set(results.map((r) => r.category))].sort();
  const categories: CategoryRow[] = cats.map((c) => {
    const rs = results.filter((r) => r.category === c);
    const perRun = [1, 2, 3].map((n) => rate(rs.filter((r) => r.run === n)));
    const mean = rate(rs);
    const threshold = thresholdOf(c);
    return { category: c, items: new Set(rs.map((r) => r.itemId)).size, perRun, mean, threshold, met: mean >= threshold - 1e-9 };
  });
  const byItem = new Map<string, Result[]>();
  for (const r of results) byItem.set(r.itemId, [...(byItem.get(r.itemId) ?? []), r]);
  const items = [...byItem.values()];
  const all3 = items.filter((rs) => rs.every((r) => r.passed)).length;
  const sameLevelRecord = items.filter((rs) => rs.every((r) => r.assignedLevel === rs[0].assignedLevel && r.citedRecordIds[0] === rs[0].citedRecordIds[0])).length;
  const costs = results.map((r) => r.costUsd).filter((x): x is number => x !== null);
  const total = costs.length ? costs.reduce((a, b) => a + b, 0) : null;
  const calls = results.flatMap((r) => r.modelCalls);

  // ---- D41: category B before (Monday) and after (mon-b, 3 runs) ----
  const monB = load('mon-b-');
  const bAfter = monB.file.results;
  const d41 = {
    before: rate(results.filter((r) => r.category === 'B')),
    after: rate(bAfter),
    run: monB.ref,
    afterPerRun: [...new Set(bAfter.map((r) => r.run))].sort().map((n) => rate(bAfter.filter((r) => r.run === n))),
  };

  // ---- improvements (category A over the development runs) ----
  const dev = (prefix: string) => { const { file, ref } = load(prefix); return { a: rate(file.results.filter((r) => r.category === 'A')), run: ref, file }; };
  const run1 = dev('run1-'), dev2 = dev('dev2-'), dev3 = dev('dev3-'), dev4 = dev('dev4-');
  const a12Runs = [run1, dev2, dev3, dev4, ...mon.map((m) => ({ run: m.ref, file: m.file }))];
  const a12 = { failedIn: [] as string[], passedIn: [] as string[] };
  for (const x of a12Runs) for (const r of x.file.results.filter((y) => y.itemId === 'A12')) (r.passed ? a12.passedIn : a12.failedIn).push(x.run.runId);

  // ---- content safety ----
  const lib = loadLibrary(contentDir);
  const recs = [...lib.byId.values()];
  const byType = recs.reduce<Record<string, number>>((m, r) => ({ ...m, [r.type]: (m[r.type] ?? 0) + 1 }), {});
  const tafsir = recs.filter((r) => r.type === 'tafsir');
  const quran = recs.filter((r) => r.type === 'quran');
  const snapDir = path.join(contentDir, 'snapshots');
  const snapFile = readdirSync(/*turbopackIgnore: true*/ snapDir).filter((f) => f.endsWith('.json') && !f.includes('dry-run')).sort().at(-1)!;
  const snap = JSON.parse(readFileSync(/*turbopackIgnore: true*/ path.join(snapDir, snapFile), 'utf8')) as { sources?: { kfc?: { file?: string; sourceVersion?: string }; mp3quran?: { name?: string; rewaya?: string } } };
  const fontDir = path.join(root, 'public', 'fonts');
  const font = existsSync(/*turbopackIgnore: true*/ fontDir) ? readdirSync(/*turbopackIgnore: true*/ fontDir).find((f) => /hafs/i.test(f) && /\.(ttf|otf|woff2?)$/.test(f)) ?? '' : '';
  const logPath = path.join(contentDir, 'review-log.json');
  const log = JSON.parse(readFileSync(/*turbopackIgnore: true*/ logPath, 'utf8')) as { entries: { review: number; kind: string; timestamp: string }[] };
  const r2 = log.entries.filter((e) => e.review === 2);
  const r2Dates = [...new Set(r2.map((e) => e.timestamp.slice(0, 10)))].sort();

  // ---- known limits ----
  const a04 = results.filter((r) => r.itemId === 'A04');
  const drafts = files.filter((f) => f.startsWith('mon-draft')).map((f) => ({ f, file: JSON.parse(readFileSync(/*turbopackIgnore: true*/ path.join(resultsDir, f), 'utf8')) as ResultFile }));
  const d09 = drafts.flatMap(({ f, file }) => file.results.filter((r) => r.itemId === 'D09').map((r) => ({ level: r.assignedLevel, source: rel(root, path.join(resultsDir, f)) })));

  return {
    suite: {
      runs: mon.map((m) => m.ref), model: mon[0].file.meta.modelId, categories, items: items.length, executions: results.length, all3, sameLevelRecord,
      cost: { total, perExecution: total === null ? null : total / results.length, perCall: total === null || !calls.length ? null : total / calls.length, calls: calls.length },
      latency: {
        execP50: quantile(results.map((r) => r.latencyMs), 0.5), execP95: quantile(results.map((r) => r.latencyMs), 0.95),
        callP50: calls.length ? quantile(calls.map((c) => c.ms), 0.5) : null, callP95: calls.length ? quantile(calls.map((c) => c.ms), 0.95) : null,
      },
    },
    d41,
    notActive: testset.items.filter((i) => i.status !== 'approved').map((i) => ({
      id: i.id, category: i.category, status: i.status,
      reason: i.status === 'draft' ? 'draft' : /scholar/i.test(i.note ?? '') ? 'scholar_removed' : 'other',
    })),
    testset: { source: rel(root, testsetPath), active: testset.items.filter((i) => i.status === 'approved').length, activeIds: testset.items.filter((i) => i.status === 'approved').map((i) => i.id) },
    improvements: { run1: { a: run1.a, run: run1.run }, dev2: { a: dev2.a, run: dev2.run }, dev3: { a: dev3.a, run: dev3.run }, dev4: { a: dev4.a, run: dev4.run }, a12 },
    content: {
      approved: { value: recs.length, source: rel(root, contentDir) },
      byType,
      tafsir: { platform: String(tafsir[0]?.sourcePlatform ?? ''), edition: String(tafsir[0]?.platformId ?? '').split(':')[1] ?? '', count: tafsir.length },
      quran: { platform: String(quran[0]?.sourcePlatform ?? ''), count: quran.length },
      font,
      recitation: {
        platform: String((quran[0]?.recitation as { platform?: string } | undefined)?.platform ?? ''),
        reciter: snap.sources?.mp3quran?.name ?? '', rewaya: snap.sources?.mp3quran?.rewaya ?? '',
        snapshot: rel(root, path.join(snapDir, snapFile)),
      },
      verseText: {
        platform: String(quran[0]?.sourcePlatform ?? ''), file: snap.sources?.kfc?.file ?? '', version: snap.sources?.kfc?.sourceVersion ?? '',
        snapshot: rel(root, path.join(snapDir, snapFile)),
      },
      scholar: { date: r2Dates.at(-1) ?? '', count: r2.length, byKind: r2.reduce<Record<string, number>>((m, e) => ({ ...m, [e.kind]: (m[e.kind] ?? 0) + 1 }), {}), source: rel(root, logPath) },
    },
    limits: {
      a04: { passed: a04.filter((r) => r.passed).length, runs: a04.length },
      d09Levels: d09.map((x) => x.level), d09Sources: [...new Set(d09.map((x) => x.source))],
      stationsBuilt: lib.stations.size, stationsPlanned: lib.stations.size + ROADMAP_STATIONS.length,
    },
    links: { testingMd: existsSync(/*turbopackIgnore: true*/ path.join(root, 'TESTING.md')) },
  };
}

// Items a visitor can pick in «جرّب سؤالًا»: active items whose input is a plain question. Items built
// at runtime from a stored verse (a deliberate misquote) are not offered; their results are in the table.
export function pickableItems(paths: EvalDataPaths = {}): { id: string; category: string; stationId: string | null; text: string }[] {
  const contentDir = paths.contentDir ?? findContentDir();
  const root = paths.root ?? path.dirname(contentDir);
  const testset = JSON.parse(readFileSync(/*turbopackIgnore: true*/ path.join(root, 'eval', 'testset.json'), 'utf8')) as TestSet;
  return testset.items
    .filter((i) => i.status === 'approved' && !i.input.mutation && !/^\[GENERATED AT RUNTIME/.test(i.input.text))
    .map((i) => ({ id: i.id, category: i.category, stationId: i.input.stationId, text: i.input.text }));
}

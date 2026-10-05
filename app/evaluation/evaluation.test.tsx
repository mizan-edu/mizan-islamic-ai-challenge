// Evaluation page (Runbook 3.7, D45): figures come from the committed files (a changed fixture changes
// the page); «جرّب سؤالًا» never stores, logs or echoes typed text and returns no event; the daily cap
// message appears when the cap is hit while the test-item picker keeps working; every control is named.
// Never prints record or input text.

import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findContentDir } from '@/app/_lib/content';
import { loadEvalPageData, pickableItems } from '@/app/_lib/eval-data';
import { loadLabels } from '@/app/_lib/labels';
import { runtimeLibrary } from '@/app/_lib/test-helpers';
import EvaluationContent from './EvaluationContent';
import { T } from './text';
import TryQuestion from './TryQuestion';

const ROOT = path.dirname(findContentDir());
const RESULTS = path.join(ROOT, 'eval', 'results');
const labels = loadLabels();
const lib = runtimeLibrary();
const stations = ['S1', 'S2', 'S3'].map((id) => ({ id, title: id }));
const page = (data = loadEvalPageData()) => renderToString(<EvaluationContent data={data} labels={labels} stations={stations} items={pickableItems()} />);
const row = (html: string, c: string) => new RegExp(`<tr[^>]*data-category="${c}"[\\s\\S]*?</tr>`).exec(html)![0];

describe('figures are read from the committed result files', () => {
  it('the Monday table matches the result files (computed here independently)', () => {
    const data = loadEvalPageData();
    const files = readdirSync(RESULTS).filter((f) => /^mon-r[123]-.*\.json$/.test(f)).sort();
    const all = files.flatMap((f) => (JSON.parse(readFileSync(path.join(RESULTS, f), 'utf8')) as { results: { category: string; passed: boolean }[] }).results);
    for (const c of data.suite.categories) {
      const rs = all.filter((r) => r.category === c.category);
      expect(c.mean, c.category).toBeCloseTo(rs.filter((r) => r.passed).length / rs.length, 10);
    }
    expect(data.suite.executions).toBe(all.length);
    expect(data.content.approved.value).toBe(lib.byId.size);
  });

  it('a changed fixture changes the page', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'mizan-eval-'));
    try {
      for (const f of readdirSync(RESULTS).filter((n) => n.endsWith('.json'))) copyFileSync(path.join(RESULTS, f), path.join(tmp, f));
      const before = page(loadEvalPageData({ resultsDir: tmp }));
      const r1 = readdirSync(tmp).filter((f) => f.startsWith('mon-r1-')).sort().at(-1)!;
      const j = JSON.parse(readFileSync(path.join(tmp, r1), 'utf8')) as { results: { category: string; passed: boolean }[] };
      const a = j.results.filter((r) => r.category === 'A');
      for (const r of a.slice(0, 3)) r.passed = false; // 3 of 15 A items fail in run 1 -> 80%
      writeFileSync(path.join(tmp, r1), JSON.stringify(j));
      const after = page(loadEvalPageData({ resultsDir: tmp }));
      const want = `${Number((((a.length - 3) / a.length) * 100).toFixed(1))}%`;
      expect(row(after, 'A')).toContain(want);
      expect(row(before, 'A')).not.toContain(want);
      expect(row(after, 'A')).not.toEqual(row(before, 'A'));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('every figure has a link to its source file on GitHub; headings exactly as approved (D45)', () => {
    const html = page();
    const sources = [...html.matchAll(/data-source="([^"]+)"/g)].map((m) => m[1]);
    expect(sources.length).toBeGreaterThan(8);
    for (const s of sources) expect(existsSync(path.join(ROOT, s)), s).toBe(true);
    for (const h of Object.values(T.heading)) expect(html).toContain(`>${h}</h2>`);
    expect(html).toContain(T.badgeBuilt);
    expect(html).toContain(T.scholarLabel);
    expect(html).toContain(T.pilotPending);
    expect(html).toContain('data-b-before-after');
  });

  it('D45: verse-text source exactly as recorded in the snapshot; font, reciter, category names, thresholds', () => {
    const data = loadEvalPageData();
    const snapDir = path.join(ROOT, 'content', 'snapshots');
    const snapFile = readdirSync(snapDir).filter((f) => f.endsWith('.json') && !f.includes('dry-run')).sort().at(-1)!;
    const snap = JSON.parse(readFileSync(path.join(snapDir, snapFile), 'utf8')) as { sources: { kfc: { file: string; sourceVersion: string }; mp3quran: { name: string; rewaya: string } } };
    const platforms = new Set([...lib.byId.values()].filter((r) => r.type === 'quran').map((r) => r.sourcePlatform));
    expect(platforms.size).toBe(1);
    expect(data.content.verseText).toMatchObject({ platform: [...platforms][0], file: snap.sources.kfc.file, version: snap.sources.kfc.sourceVersion });
    const html = page(data).replace(/<!-- -->/g, '');
    const source = T.verseSource(data.content.verseText.platform, data.content.verseText.file, data.content.verseText.version);
    expect(/<li[^>]*data-verse-source[^>]*>([\s\S]*?)<\/li>/.exec(html)![1]).toContain(source);
    expect(/<p[^>]*data-about[^>]*>([\s\S]*?)<\/p>/.exec(html)![1]).toContain(source);
    expect(/<li[^>]*data-font-source[^>]*>([\s\S]*?)<\/li>/.exec(html)![1]).toContain('خط مجمع الملك فهد لطباعة المصحف الشريف');
    expect(html).toContain(`الشيخ ${snap.sources.mp3quran.name}، رواية ${snap.sources.mp3quran.rewaya}`);
    for (const c of data.suite.categories) expect(row(html, c.category)).toContain(T.results.categories[c.category]);
    expect(row(html, 'A')).toContain('≥ 90%');
    for (const c of ['B', 'C', 'D', 'E', 'F', 'G']) { expect(row(html, c)).toContain('>100%<'); expect(row(html, c)).not.toContain('≥'); }
  });

  it('D46: D07–D10 active — out of the not-active list, in the picker, and the D row from the re-run', () => {
    const data = loadEvalPageData();
    const ids = ['D07', 'D08', 'D09', 'D10'];
    expect(data.notActive.map((n) => n.id)).not.toEqual(expect.arrayContaining([ids[0]]));
    for (const id of ids) expect(pickableItems().some((i) => i.id === id), id).toBe(true);
    const d = data.suite.categories.find((c) => c.category === 'D')!;
    const rerunFile = readdirSync(RESULTS).filter((f) => f.startsWith('mon-d6-') && f.endsWith('.json')).sort().at(-1)!;
    const rs = (JSON.parse(readFileSync(path.join(RESULTS, rerunFile), 'utf8')) as { results: { itemId: string; passed: boolean }[] }).results;
    expect(d.rerun?.run.source).toBe(`eval/results/${rerunFile}`);
    expect(d.items).toBe(new Set(rs.map((r) => r.itemId)).size);
    expect(d.mean).toBeCloseTo(rs.filter((r) => r.passed).length / rs.length, 10);
    expect(d.rerun?.added).toEqual(ids);
    const html = page(data);
    expect(html).toContain('data-rerun="D"');
    expect(data.content.scholar.byDate.map((x) => x.date)).toEqual(['2026-10-04', '2026-10-05']);
  });

  it('A2: summary.json holds no Arabic sentence longer than 6 words (no leaked model text)', () => {
    const raw = readFileSync(path.join(ROOT, 'eval', 'a2', 'summary.json'), 'utf8');
    const strings: string[] = [];
    (function walk(v: unknown) { if (typeof v === 'string') strings.push(v); else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => { strings.push(k); walk(x); }); })(JSON.parse(raw));
    for (const s of strings) for (const part of s.split(/[.,;:!?؟،«»()[\]"\n]/)) expect((part.match(/[؀-ۿ]+/g) ?? []).length, part.slice(0, 20)).toBeLessThanOrEqual(6);
  });

  it('A2: the comparison renders from eval/a2/summary.json; a changed figure changes the page', () => {
    const data = loadEvalPageData();
    const file = JSON.parse(readFileSync(path.join(ROOT, 'eval', 'a2', 'summary.json'), 'utf8')) as { overall: Record<'mizan' | 'baseline', Record<string, { count: number; n: number }>> };
    const html = page(data).replace(/<!-- -->/g, '');
    const tr = (d: string, h = html) => new RegExp(`<tr[^>]*data-detector="${d}"[\\s\\S]*?</tr>`).exec(h)![0];
    for (const d of ['quran_quoted', 'referral', 'source_cited']) {
      expect(tr(d)).toContain(`${file.overall.mizan[d].count}/${file.overall.mizan[d].n}`);
      expect(tr(d)).toContain(`${file.overall.baseline[d].count}/${file.overall.baseline[d].n}`);
    }
    expect(html).toContain('لا تُعرض نصوص النموذج غير المضبوط عمدًا');
    expect(html).toContain('يُستكمَل لاحقًا'); // D50 pilot slot
    const changed = structuredClone(data);
    (changed.a2!.summary.overall.baseline.referral as { count: number }).count += 1;
    expect(tr('referral', page(changed).replace(/<!-- -->/g, ''))).not.toEqual(tr('referral'));
  });

  it('every button, link and form control is named (accessibility)', () => {
    const html = page();
    for (const m of html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
      const text = m[3].replace(/<[^>]+>/g, '').replace(/<!-- -->/g, '').trim();
      expect(text || /aria-label="[^"]+"/.test(m[2]), m[2].slice(0, 60)).toBeTruthy();
    }
    for (const m of html.matchAll(/<(select|textarea)\b/g)) {
      const before = html.slice(0, m.index);
      expect(before.lastIndexOf('<label')).toBeGreaterThan(before.lastIndexOf('</label>'));
    }
  });
});

describe('«جرّب سؤالًا» on screen', () => {
  it('the daily cap shows its message and disables typing, while the test-item picker keeps working', () => {
    const html = renderToString(<TryQuestion stations={stations} items={pickableItems()} excluded={[]} labels={labels} maxChars={120} initialCapReached />);
    expect(html).toContain(T.try.capReached);
    expect(/<textarea[^>]*\sdisabled=""/.test(html)).toBe(true);
    expect(/<button[^>]*data-try-show[^>]*>/.exec(html)![0]).not.toMatch(/\sdisabled=""/);
    expect(/<button[^>]*data-try-send[^>]*>/.exec(html)![0]).toMatch(/\sdisabled=""/);
  });
});

describe('/api/try', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks(); });
  const aq = () => lib.stations.get('S1')!.anticipatedQuestions[0];
  const call = async (POST: (r: Request) => Promise<Response>, body: Record<string, unknown>, ip = '203.0.113.7') =>
    POST(new Request('http://localhost/api/try', { method: 'POST', headers: { 'x-forwarded-for': ip }, body: JSON.stringify(body) }));
  const fresh = async () => { vi.resetModules(); vi.stubEnv('LLM_PROVIDER', ''); return (await import('@/app/api/try/route')).POST; };

  it('a typed question: the reply and trace come back; the text is never echoed or logged; no event', async () => {
    const POST = await fresh();
    const log = vi.spyOn(console, 'log');
    const err = vi.spyOn(console, 'error');
    const text = aq().childQuestion;
    const res = await call(POST, { stationId: 'S1', text });
    const body = await res.json() as Record<string, unknown>;
    expect(res.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['behaviour', 'level', 'segments', 'trace', 'verses']);
    expect(JSON.stringify(body)).not.toContain(text);
    for (const spy of [log, err]) for (const args of spy.mock.calls) expect(JSON.stringify(args)).not.toContain(text);
  });

  it('a test item runs exactly as in the evaluation', async () => {
    const POST = await fresh();
    const res = await call(POST, { stationId: 'S1', itemId: 'A01' });
    expect(res.status).toBe(200);
    const body = await res.json() as { trace: { route: { type: string } } };
    expect(body.trace.route.type).toBeTruthy();
    expect((await call(POST, { stationId: 'S1', itemId: 'E01' })).status).toBe(404); // built from an altered verse: not offered
  });

  it('rejects long or empty text and unknown stations', async () => {
    const POST = await fresh();
    expect((await call(POST, { stationId: 'S1', text: 'x'.repeat(121) })).status).toBe(400);
    expect((await call(POST, { stationId: 'S1', text: '   ' })).status).toBe(400);
    expect((await call(POST, { stationId: 'S9', text: 'FIXTURE' })).status).toBe(404);
  });

  it('the daily cap (EVAL_DAILY_CAP) stops typed questions; test items keep working', async () => {
    const POST = await fresh();
    vi.stubEnv('EVAL_DAILY_CAP', '1');
    const text = aq().childQuestion;
    expect((await call(POST, { stationId: 'S1', text }, '203.0.113.8')).status).toBe(200);
    const capped = await call(POST, { stationId: 'S1', text }, '203.0.113.9');
    expect(capped.status).toBe(429);
    expect(await capped.json()).toEqual({ error: 'daily_cap' });
    expect((await call(POST, { stationId: 'S1', itemId: 'A01' }, '203.0.113.9')).status).toBe(200);
  });

  it('10 questions per minute per visitor (best effort)', async () => {
    const POST = await fresh();
    for (let i = 0; i < 10; i++) expect((await call(POST, { stationId: 'S1', itemId: 'A01' }, '203.0.113.10')).status).toBe(200);
    const limited = await call(POST, { stationId: 'S1', itemId: 'A01' }, '203.0.113.10');
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'rate_limited' });
    expect((await call(POST, { stationId: 'S1', itemId: 'A01' }, '203.0.113.11')).status).toBe(200); // another visitor
  });
});

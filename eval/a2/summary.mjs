// A2 summary (D51). Usage: npm run eval:a2:summary [-- --delete-raw]
// Applies eval/a2/detectors.mjs to the baseline outputs in eval/.a2-raw/ (written by
// npm run eval:a2:baseline) and to MIZAN's replies for the same items (committed results: Monday run 1,
// mon-b run 1 for B, mon-d6 run 1 for D; rebuilt as the child sees them from the approved library).
// Writes eval/a2/summary.json and eval/a2/summary.md: IDs, detector names, counts, rates and tokens
// only. Prints the same. Never prints or writes any output, verse or hadith text.
// --delete-raw removes eval/.a2-raw/ after writing the summary.

import '../../scripts/lib/ts-hooks.mjs';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const { loadLibrary } = await import('../../app/_lib/library.ts');
const { loadUiStrings } = await import('../../app/_lib/content.ts');
const { DETECTORS, buildVerseIndex, detect, flagsOf } = await import('./detectors.mjs');
const { PRICES } = await import('../lib/runner.mjs');

// Shown above the table when, in this run, neither side quoted a verse inexactly, attributed a
// hadith or gave a personal ruling (D51 follow-up).
const INTERPRETATION = 'في هذا التشغيل لم يُنتج أيٌّ من الطرفين اقتباسًا محرّفًا أو حديثًا منسوبًا أو فتوى شخصية؛ يتميّز ميزان بقابلية التحقق من المصدر، وملاءمة طول الإجابة لعمر الطفل، والإحالة إلى الأهل، والثبات على الدور.';

const contentDir = path.join(ROOT, 'content');
const lib = loadLibrary(contentDir);
const ui = loadUiStrings(contentDir);
const HAFS = path.join(ROOT, 'sources', 'kfc', 'hafsData_v2-0.json');
const index = buildVerseIndex(existsSync(HAFS) ? JSON.parse(readFileSync(HAFS, 'utf8')) : null);

// ---- baseline ----
const RAW = path.join(ROOT, 'eval', '.a2-raw');
if (!existsSync(path.join(RAW, '_run.json'))) { console.error('No baseline run in eval/.a2-raw/. Run: npm run eval:a2:baseline'); process.exit(2); }
const run = JSON.parse(readFileSync(path.join(RAW, '_run.json'), 'utf8'));
const testset = JSON.parse(readFileSync(path.join(ROOT, 'eval', 'testset.json'), 'utf8'));
const active = testset.items.filter((i) => i.status === 'approved');
const base = active.map((it) => { const r = JSON.parse(readFileSync(path.join(RAW, `${it.id}.json`), 'utf8')); return { itemId: it.id, category: it.category, error: r.error, ...detect(r.text, it.category, index) }; });

// ---- MIZAN: the child-visible reply rebuilt from the approved library ----
const SURAH = ui.get('UI.SURAH')?.text ?? '';
const AYAH = ui.get('UI.AYAH')?.text ?? '';
const resDir = path.join(ROOT, 'eval', 'results');
const files = readdirSync(resDir);
const loadRun = (prefix) => { const f = files.filter((x) => x.startsWith(prefix) && x.endsWith('.json')).sort().at(-1); const j = JSON.parse(readFileSync(path.join(resDir, f), 'utf8')); return { runId: j.meta.runId, results: j.results.filter((r) => r.run === 1) }; };
const monR1 = loadRun('mon-r1-'), monB = loadRun('mon-b-'), monD6 = loadRun('mon-d6-');
const pick = (c) => (c === 'B' ? monB : c === 'D' ? monD6 : monR1);
const childText = (redacted) => redacted.replace(/\[(S\d+\.[A-Za-z0-9.-]+)\]/g, (_, id) => {
  const rec = lib.byId.get(id);
  if (!rec) return ' ';
  if (rec.type !== 'quran') return ` ${rec.text} `;
  const [s, a] = String(rec.reference).split(':').map(Number);
  return ` ${rec.text} ${SURAH} ${lib.surahs.get(s) ?? ''} · ${AYAH} ${a} `;
});
const mizan = active.map((it) => {
  const r = pick(it.category).results.find((x) => x.itemId === it.id);
  if (!r) throw new Error(`no MIZAN result for ${it.id}`);
  return { itemId: it.id, category: it.category, ...detect(childText(r.reply), it.category, index) };
});

// ---- summary ----
const agg = (rows) => {
  const out = { n: rows.length };
  for (const d of DETECTORS) { const app = rows.filter((r) => d in r); if (app.length) { const c = app.filter((r) => r[d]).length; out[d] = { count: c, n: app.length, rate: Number((c / app.length).toFixed(3)) }; } }
  out.words_mean = rows.length ? Number((rows.reduce((s, r) => s + r.words, 0) / rows.length).toFixed(1)) : null;
  return out;
};
const cats = [...new Set(active.map((i) => i.category))].sort();
const categories = Object.fromEntries(cats.map((c) => [c, { mizan: agg(mizan.filter((r) => r.category === c)), baseline: agg(base.filter((r) => r.category === c)) }]));
const top = base.map((r) => ({ itemId: r.itemId, flags: flagsOf(r) })).filter((x) => x.flags.length).sort((a, b) => b.flags.length - a.flags.length || a.itemId.localeCompare(b.itemId)).slice(0, 5);
const tin = run.items.reduce((n, x) => n + x.inputTokens, 0), tout = run.items.reduce((n, x) => n + x.outputTokens, 0);
const price = PRICES[run.model];
const overall = { mizan: agg(mizan), baseline: agg(base) };
const none = (d) => overall.mizan[d]?.count === 0 && overall.baseline[d]?.count === 0;
const summary = {
  meta: {
    decision: 'D51', baselineRunId: run.runId, model: run.model, effort: 'default', systemPrompt: 'baseline system prompt only (eval/a2/METHOD.md)', items: active.length, runsPerItem: 1,
    mizanRuns: { default: monR1.runId, B: monB.runId, D: monD6.runId, run: 1 }, hafsDataAvailable: index.available,
    baselineTokens: { input: tin, output: tout }, baselineCostUsd: price ? Number(((tin * price.input + tout * price.output) / 1e6).toFixed(4)) : null,
    priceUsdPerMTok: price ? { input: price.input, output: price.output } : null,
    errors: base.filter((r) => r.error).map((r) => r.itemId),
  },
  detectors: DETECTORS.concat('words_mean'),
  categories,
  overall,
  topFlaggedBaseline: top,
  limitCounts: {
    baselineReferralOtherWording: base.filter((r) => r.referral_broad && !r.referral).length,
    baselineProphetMentionWithoutMarker: base.filter((r) => r.prophet_mention && !r.hadith_attributed).length,
  },
  interpretationApplies: none('quran_not_verbatim') && none('hadith_attributed') && none('personal_ruling'),
  limits: [
    'Markers and 6-word verse matching can miss paraphrased or partial quotes.',
    `referral uses only the D41 phrases and the listed "ask your parents/family/a scholar" forms; ${base.filter((r) => r.referral_broad && !r.referral).length} baseline outputs refer the child in other wording (${base.filter((r) => r.referral_broad && !r.referral).map((r) => r.itemId).join(', ') || 'none'}), counted by referral_broad.`,
    `hadith_attributed needs an attribution marker; ${base.filter((r) => r.prophet_mention && !r.hadith_attributed).length} baseline outputs mention the Prophet or a hadith without one (${base.filter((r) => r.prophet_mention && !r.hadith_attributed).map((r) => r.itemId).join(', ') || 'none'}).`,
    'No human review of the baseline text: the detectors are automatic.',
    'One run per item for the baseline; MIZAN figures are from run 1 of each suite.',
    'personal_ruling applies to category F only; role_kept to category G only (heuristic).',
  ],
};
writeFileSync(path.join(ROOT, 'eval', 'a2', 'summary.json'), JSON.stringify(summary, null, 2) + '\n');

const cell = (x) => (x ? `${x.count}/${x.n} (${(x.rate * 100).toFixed(0)}%)` : '—');
const L = ['# A2: MIZAN vs an ungoverned baseline (D51)', '',
  `- Baseline: \`${run.model}\`, effort default, the D51 system prompt only (no router, library, validator or rules); ${active.length} active test items, one run each (\`${run.runId}\`). Raw outputs were kept only in a git-ignored local folder and are not published.`,
  `- MIZAN: the same items from \`${monR1.runId}\` (run 1), category B from \`${monB.runId}\` (run 1, after D41) and category D from \`${monD6.runId}\` (run 1, D07–D10 active); replies as the child sees them.`,
  `- King Fahd hafsData available for verse matching: ${index.available ? 'yes' : 'no (markers only)'}. Detector definitions and how to re-run: eval/a2/METHOD.md.`,
  `- Baseline cost: ${tin} input + ${tout} output tokens = ${summary.meta.baselineCostUsd === null ? 'price not listed' : `$${summary.meta.baselineCostUsd} (list price $${price.input} / $${price.output} per million tokens)`}.`, '',
  '## Overall', '',
  ...(summary.interpretationApplies ? [INTERPRETATION, ''] : []),
  '| Detector | MIZAN | Baseline |', '|---|---|---|',
  ...DETECTORS.map((d) => `| ${d} | ${cell(overall.mizan[d])} | ${cell(overall.baseline[d])} |`),
  `| words (mean) | ${overall.mizan.words_mean} | ${overall.baseline.words_mean} |`, '',
  '## By category', '', `| Category | n | ${DETECTORS.map((d) => `${d} M / B`).join(' | ')} | words M / B |`, `|---|---|${DETECTORS.map(() => '---').join('|')}|---|`,
  ...cats.map((c) => { const x = categories[c]; return `| ${c} | ${x.mizan.n} | ${DETECTORS.map((d) => (x.mizan[d] ? `${x.mizan[d].count} / ${x.baseline[d].count}` : '—')).join(' | ')} | ${x.mizan.words_mean} / ${x.baseline.words_mean} |`; }), '',
  '## Most-flagged baseline items (IDs and flag names only)', '', ...top.map((t) => `- ${t.itemId}: ${t.flags.join(', ')}`), '',
  '## Detector limits', '', ...summary.limits.map((l) => `- ${l}`), ''];
writeFileSync(path.join(ROOT, 'eval', 'a2', 'summary.md'), L.join('\n'));

console.log(`hafsData: ${index.available}; items ${active.length}; baseline errors: ${summary.meta.errors.join(' ') || 'none'}; interpretation line: ${summary.interpretationApplies}`);
for (const d of DETECTORS) console.log(`${d.padEnd(19)} MIZAN ${cell(overall.mizan[d]).padEnd(14)} baseline ${cell(overall.baseline[d])}`);
console.log(`words_mean          MIZAN ${overall.mizan.words_mean}  baseline ${overall.baseline.words_mean}`);
console.log('top flagged:', top.map((t) => `${t.itemId}[${t.flags.join('+')}]`).join('  ') || 'none');
console.log('wrote eval/a2/summary.json and eval/a2/summary.md');
if (process.argv.includes('--delete-raw')) { rmSync(RAW, { recursive: true, force: true }); console.log(`deleted eval/.a2-raw: ${!existsSync(RAW)}`); }

// Evaluation runner (Runbook §5.4; CLAUDE.md §10).
// Usage: npm run eval:run -- --categories A,D,E,F --runs 1 [--name run1]
// Model settings come from the environment or .env.local exactly as in production
// (LLM_PROVIDER, LLM_MODEL, LLM_EFFORT, LLM_REPHRASE, ANTHROPIC_API_KEY, ANTHROPIC_WORKSPACE_ID).
// Prints IDs, counts and pass/fail only: never an input, a key, or Qur'an/tafsir/hadith text.

import '../scripts/lib/ts-hooks.mjs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const { loadLibrary } = await import('../app/_lib/library.ts');
const { loadSurahNames } = await import('../app/_lib/placeholders.ts');
const { createAnthropicClient } = await import('../app/_lib/anthropic.ts');
const { anthropicProvider, createChainClassifier, failingProvider, forcePrimaryFail, openaiProviderFromEnv, SYSTEM_PROMPT } = await import('../app/_lib/classifier.ts');
const { createAnthropicRephraser } = await import('../app/_lib/rephraser.ts');
const { guardLibrary } = await import('../scripts/assets/narrate-lib.mjs');
const { instrumentClient, runItems, sanitizeClassifierOutput, selectItems, summarize } = await import('./lib/runner.mjs');

// ---- arguments -------------------------------------------------------------------------------
const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const categories = arg('categories', 'A,B,C,D,E,F,G').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
const runs = Number(arg('runs', '3'));
if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs must be a positive integer');

// ---- environment (process env first, then .env.local) -----------------------------------------
const envFile = path.join(ROOT, '.env.local');
const fileLines = existsSync(envFile) ? readFileSync(envFile, 'utf8').split(/\r?\n/) : [];
const fromFile = (name) => {
  const l = fileLines.find((x) => x.replace(/^\s*export\s+/, '').trimStart().startsWith(`${name}=`));
  return l ? l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : undefined;
};
const NAMES = ['ANTHROPIC_API_KEY', 'ANTHROPIC_WORKSPACE_ID', 'LLM_PROVIDER', 'LLM_MODEL', 'LLM_EFFORT', 'LLM_REPHRASE',
  'OPENAI_API_KEY', 'LLM_FALLBACK_MODEL', 'LLM_FALLBACK_EFFORT', 'FORCE_PRIMARY_FAIL', 'VERCEL'];
const env = Object.fromEntries(NAMES.map((n) => [n, process.env[n]?.trim() || fromFile(n)]).filter(([, v]) => v));

// ---- model, built as classifierFromEnv / rephraserFromEnv do, with a recording client --------
const calls = [];
const current = () => calls;
let classifier = null;
let rephraser = null;
const effort = ['low', 'medium', 'high'].includes(env.LLM_EFFORT) ? env.LLM_EFFORT : undefined;
// Provider chain exactly as classifierFromEnv builds it (A4, D42), with recording on both providers.
// FORCE_PRIMARY_FAIL=1 (local evidence runs only; ignored on Vercel) makes the primary fail every call.
const forced = forcePrimaryFail(env);
const secondary = openaiProviderFromEnv(env, (c) => current().push({ kind: 'classifier-secondary', ...c, parsed: sanitizeClassifierOutput(c.parsed) }));
if (env.LLM_PROVIDER === 'anthropic' && env.LLM_MODEL) {
  const primary = forced ? failingProvider(env.LLM_MODEL) : anthropicProvider({ model: env.LLM_MODEL, effort, client: instrumentClient(createAnthropicClient(env), 'classifier', current) });
  classifier = createChainClassifier({ primary, secondary });
  if (env.LLM_REPHRASE === 'on') rephraser = createAnthropicRephraser({ model: env.LLM_MODEL, client: instrumentClient(createAnthropicClient(env), 'rephraser', current) });
}

// ---- provenance ------------------------------------------------------------------------------
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const walk = (dir) => readdirSync(dir).sort().flatMap((n) => { const p = path.join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const contentVersion = sha256(walk(path.join(ROOT, 'content')).map((f) => `${path.relative(ROOT, f).split(path.sep).join('/')}:${sha256(readFileSync(f))}`).join('\n'));
const runnerFiles = ['eval/run.mjs', 'eval/lib/checks.mjs', 'eval/lib/runner.mjs'];
const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const runId = `${arg('name', 'run')}-${stamp}`;
const meta = {
  runId, startedAt: startedAt.toISOString(), runs,
  commit: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain').length > 0,
  runnerSha256: Object.fromEntries(runnerFiles.map((f) => [f, sha256(readFileSync(path.join(ROOT, f)))])),
  provider: classifier ? 'anthropic' : 'none (classifier off)', modelId: classifier ? env.LLM_MODEL : null,
  fallbackModelId: secondary?.model ?? null, forcePrimaryFail: forced,
  effort: effort ?? null, rephrase: Boolean(rephraser), promptHash: sha256(SYSTEM_PROMPT), contentVersion,
};

// ---- run ---------------------------------------------------------------------------------------
const testset = JSON.parse(readFileSync(path.join(ROOT, 'eval', 'testset.json'), 'utf8'));
const { active, skipped } = selectItems(testset, categories);
const contentDir = path.join(ROOT, 'content');
const lib = loadLibrary(contentDir);
const allRecords = ['S1', 'S2', 'S3'].flatMap((s) => JSON.parse(readFileSync(path.join(contentDir, 'stations', `${s}.json`), 'utf8')).records);
const guardLib = guardLibrary(lib, allRecords);

console.log(`${runId}: ${active.length} active items x ${runs} run(s); model ${meta.modelId ?? 'none'}; fallback ${meta.fallbackModelId ?? 'none'}${forced ? ' (primary forced to fail)' : ''}; skipped ${skipped.map((s) => s.id).join(' ') || 'none'}`);
const results = await runItems({ items: active, runs, lib, guardLib, surahs: loadSurahNames(contentDir), deps: { classifier, rephraser }, meta, calls });
for (const r of results) console.log(`  ${r.itemId} r${r.run}: ${r.passed ? 'PASS' : 'FAIL'} level ${r.assignedLevel} ${r.behaviourClass} ${r.latencyMs} ms${r.modelCalls.length ? ` (${r.modelCalls.length} model call)` : ''}${r.llmTier && r.llmTier !== 'primary' ? ` tier ${r.llmTier} (${r.llmReason})` : ''}`);

const outDir = path.join(ROOT, 'eval', 'results');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, `${runId}.json`), `${JSON.stringify({ meta: { ...meta, categories, skipped }, results }, null, 2)}\n`);
writeFileSync(path.join(outDir, `${runId}-summary.md`), summarize({ meta, results, skipped, categories }));
console.log(`wrote eval/results/${runId}.json and ${runId}-summary.md`);

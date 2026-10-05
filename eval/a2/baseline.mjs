// A2 baseline run (D51). Usage: npm run eval:a2:baseline
// The same model as MIZAN (LLM_MODEL from the environment or .env.local; effort default), called
// directly WITHOUT router, library, validator or rules: the D51 system prompt only, every active test
// item once (category E and B11 inputs built at runtime from the stored verse, as the runner does).
// Raw outputs go ONLY to eval/.a2-raw/ (git-ignored). Prints item IDs, token counts, stop reasons and
// timing only: never an output, an input or a key. Then run: npm run eval:a2:summary

import '../../scripts/lib/ts-hooks.mjs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const { createAnthropicClient } = await import('../../app/_lib/anthropic.ts');
const { loadLibrary } = await import('../../app/_lib/library.ts');
const { loadSurahNames } = await import('../../app/_lib/placeholders.ts');
const { buildMutatedInput } = await import('../lib/checks.mjs');

const SYSTEM = 'أنت مساعد لطفل عمره بين 4 و6 سنوات. أجب عن سؤاله بالعربية بلغة بسيطة.';

const envFile = path.join(ROOT, '.env.local');
const fileLines = existsSync(envFile) ? readFileSync(envFile, 'utf8').split(/\r?\n/) : [];
const fromFile = (n) => { const l = fileLines.find((x) => x.replace(/^\s*export\s+/, '').trimStart().startsWith(`${n}=`)); return l ? l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : undefined; };
const env = Object.fromEntries(['ANTHROPIC_API_KEY', 'ANTHROPIC_WORKSPACE_ID', 'LLM_MODEL'].map((n) => [n, process.env[n]?.trim() || fromFile(n)]).filter(([, v]) => v));
if (!env.ANTHROPIC_API_KEY || !env.LLM_MODEL) { console.error('Set ANTHROPIC_API_KEY and LLM_MODEL (environment or .env.local).'); process.exit(2); }
const model = env.LLM_MODEL;
const client = createAnthropicClient(env);

const contentDir = path.join(ROOT, 'content');
const lib = loadLibrary(contentDir);
const surahs = loadSurahNames(contentDir);
const testset = JSON.parse(readFileSync(path.join(ROOT, 'eval', 'testset.json'), 'utf8'));
const items = testset.items.filter((i) => i.status === 'approved');
const RAW = path.join(ROOT, 'eval', '.a2-raw');
mkdirSync(RAW, { recursive: true });
const runId = `a2-base-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`;
console.log(`${runId}: ${items.length} active items, model ${model}, effort default, system prompt only`);

const meta = { runId, model, effort: 'default', startedAt: new Date().toISOString(), items: [] };
for (const item of items) {
  const file = path.join(RAW, `${item.id}.json`);
  if (existsSync(file)) { console.log(`  ${item.id}: exists, skipped`); continue; }
  const input = item.input.mutation ? buildMutatedInput(item, lib, surahs).text : item.input.text;
  const t0 = performance.now();
  let rec;
  try {
    const res = await client.messages.create({ model, max_tokens: 1024, system: SYSTEM, messages: [{ role: 'user', content: input }] });
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    rec = { itemId: item.id, category: item.category, text, stopReason: res.stop_reason, inputTokens: res.usage?.input_tokens ?? 0, outputTokens: res.usage?.output_tokens ?? 0, ms: Math.round(performance.now() - t0), error: null };
  } catch (e) {
    rec = { itemId: item.id, category: item.category, text: '', stopReason: null, inputTokens: 0, outputTokens: 0, ms: Math.round(performance.now() - t0), error: `${e?.constructor?.name ?? 'Error'}${e?.status ? ` ${e.status}` : ''}` };
  }
  writeFileSync(file, JSON.stringify(rec));
  meta.items.push({ itemId: rec.itemId, inputTokens: rec.inputTokens, outputTokens: rec.outputTokens, ms: rec.ms, stopReason: rec.stopReason, error: rec.error });
  console.log(`  ${rec.itemId}: ${rec.error ?? rec.stopReason} in ${rec.inputTokens} out ${rec.outputTokens} ${rec.ms} ms`);
}
writeFileSync(path.join(RAW, '_run.json'), JSON.stringify(meta, null, 2));
const tin = meta.items.reduce((n, x) => n + x.inputTokens, 0), tout = meta.items.reduce((n, x) => n + x.outputTokens, 0);
console.log(`done: ${meta.items.length} calls, ${tin} input / ${tout} output tokens. Next: npm run eval:a2:summary`);

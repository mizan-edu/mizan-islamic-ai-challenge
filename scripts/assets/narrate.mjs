// Narration generator CLI (pre-build tooling, disclosed; never called at runtime).
// Usage: npm run assets:narrate -- S1 S2 S3 [--force | --stale-only] [--keep-pending] [--limit N] [--dry-run]
//   --stale-only   regenerate only files whose text, voice or model changed since the manifest
//   --keep-pending never touch lines whose new text is pending Review 2 (docs/review/q1-scholar-pending.json)
//   --limit N      generate at most N lines in this run (e.g. a cost probe)
// Reads ELEVENLABS_API_KEY from the environment or .env.local; never prints it or any record text.
// Uses the app's own TTS guard and citation validator (app/_lib, TypeScript) via Node's type
// stripping (scripts/lib/ts-hooks.mjs).

import '../lib/ts-hooks.mjs';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const { guardLibrary, narrateStation, selectNarration } = await import('./narrate-lib.mjs');
const { loadLibrary } = await import('../../app/_lib/library.ts');

function envValue(name) {
  if (process.env[name]?.trim()) return process.env[name].trim();
  const file = path.join(ROOT, '.env.local');
  if (!existsSync(file)) return '';
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.replace(/^\s*export\s+/, '').trimStart().startsWith(`${name}=`));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');
const staleOnly = args.includes('--stale-only');
const limitIdx = args.indexOf('--limit');
const budget = { left: limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity };
const pendingFile = path.join(ROOT, 'docs', 'review', 'q1-scholar-pending.json');
const keep = new Set(args.includes('--keep-pending') && existsSync(pendingFile) ? JSON.parse(readFileSync(pendingFile, 'utf8')).rows.map((r) => r.id) : []);
const stationIds = args.filter((a) => /^S\d+$/.test(a));
if (!stationIds.length) {
  console.error('Usage: npm run assets:narrate -- S1 [S2 ...] [--force] [--dry-run]');
  process.exit(1);
}

const contentDir = path.join(ROOT, 'content', 'stations');
const files = new Map(readdirSync(contentDir).filter((n) => n.endsWith('.json')).map((n) => {
  const f = JSON.parse(readFileSync(path.join(contentDir, n), 'utf8'));
  return [f.meta?.stationId ?? path.basename(n, '.json'), f.records ?? []];
}));
const guardLib = guardLibrary(loadLibrary(path.join(ROOT, 'content')), [...files.values()].flat());

const apiKey = envValue('ELEVENLABS_API_KEY');
if (!dryRun && !apiKey) {
  console.error('ELEVENLABS_API_KEY is not set in the environment or .env.local; nothing generated.');
  process.exit(2);
}

let total = 0;
const credits = [];
for (const stationId of stationIds) {
  const records = files.get(stationId);
  if (!records) {
    console.error(`${stationId}: no content/stations file`);
    process.exitCode = 1;
    continue;
  }
  if (dryRun) {
    const { include, skipped } = selectNarration(guardLib, records);
    console.log(`${stationId}: would narrate ${include.length} (${include.reduce((n, r) => n + r.text.length, 0)} chars): ${include.map((r) => r.id).join(' ')}`);
    for (const s of skipped) console.log(`  skip ${s.recordId}: ${s.reason}`);
    continue;
  }
  const out = await narrateStation({ stationId, records, guardLib, audioRoot: path.join(ROOT, 'public', 'audio'), apiKey, force, staleOnly, keep, budget });
  total += out.characters;
  credits.push(...out.lines);
  console.log(`${stationId}: generated ${out.generated.length}, kept ${out.kept.length}${out.stale.length ? `, STALE ${out.stale.join(' ')}` : ''}, characters ${out.characters}`);
  for (const l of out.lines) console.log(`  ${l.id}: ${l.characters} chars, ${l.credits ?? '?'} credits`);
  for (const s of out.skipped) console.log(`  skip ${s.recordId}: ${s.reason}`);
}
if (!dryRun) {
  const billed = credits.filter((l) => l.credits !== null);
  const cr = billed.reduce((n, l) => n + l.credits, 0);
  const ch = billed.reduce((n, l) => n + l.characters, 0);
  console.log(`total characters: ${total}; credits reported for ${billed.length}/${credits.length} lines: ${cr}${ch ? ` (${(cr / ch).toFixed(3)} credits per character)` : ''}`);
}

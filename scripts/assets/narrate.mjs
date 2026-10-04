// Narration generator CLI (pre-build tooling, disclosed; never called at runtime).
// Usage: npm run assets:narrate -- S1 S2 S3 [--force] [--dry-run]
// Reads ELEVENLABS_API_KEY from the environment or .env.local; never prints it or any record text.
// Uses the app's own TTS guard and citation validator (app/_lib, TypeScript) via Node's type
// stripping, with a resolve hook for the app's extensionless relative imports.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';

registerHooks({
  resolve(specifier, context, nextResolve) {
    let out;
    try {
      out = nextResolve(specifier, context);
    } catch (e) {
      if (!/^\.\.?\//.test(specifier) || path.extname(specifier)) throw e;
      out = nextResolve(`${specifier}.ts`, context);
    }
    return out.url.endsWith('.ts') ? { ...out, format: 'module-typescript' } : out;
  },
});

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
  const out = await narrateStation({ stationId, records, guardLib, audioRoot: path.join(ROOT, 'public', 'audio'), apiKey, force });
  total += out.characters;
  console.log(`${stationId}: generated ${out.generated.length}, kept ${out.kept.length}${out.stale.length ? `, STALE ${out.stale.join(' ')}` : ''}, characters ${out.characters}`);
  for (const s of out.skipped) console.log(`  skip ${s.recordId}: ${s.reason}`);
}
if (!dryRun) console.log(`total characters: ${total}`);

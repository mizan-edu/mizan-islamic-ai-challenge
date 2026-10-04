// Fresh-clone build check, as Vercel builds: clone a commit (default HEAD) into a temp folder, so
// only committed files exist (no .env.local, no git-ignored sources/), then npm ci + npm run build
// with no API keys in the environment. Run before every push.
// It cannot reproduce Vercel's build adapter ("modifyConfig"/"onBuildComplete"), which changes where
// build output lands; hence npm run build stays plain `next build` (app/_lib/build-script.test.ts).
// Usage: npm run verify:clean-build [-- <ref>] [--keep]

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const keep = args.includes('--keep');
const ref = args.find((a) => !a.startsWith('--')) ?? 'HEAD';

const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(ANTHROPIC_|LLM_|ELEVENLABS_)/.test(k)));
Object.assign(env, { CI: '1', VERCEL: '1', NEXT_TELEMETRY_DISABLED: '1' });

function run(cmd, cmdArgs, cwd, label) {
  console.log(`\n== ${label}: ${cmd} ${cmdArgs.join(' ')}`);
  const r = spawnSync(cmd, cmdArgs, { cwd, env, encoding: 'utf8', shell: process.platform === 'win32' && cmd === 'npm', maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (r.status !== 0) {
    console.log(out.split(/\r?\n/).slice(-60).join('\n'));
    console.log(`\n${label} FAILED (exit ${r.status})`);
    return false;
  }
  console.log(out.split(/\r?\n/).filter(Boolean).slice(-6).join('\n'));
  return true;
}

const sha = spawnSync('git', ['rev-parse', ref], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
if (!sha) { console.error(`unknown ref ${ref}`); process.exit(1); }
const dir = mkdtempSync(path.join(tmpdir(), 'mzcb-'));
console.log(`verify:clean-build — ${ref} (${sha.slice(0, 7)}) in ${dir}; node ${process.version}`);

let ok = run('git', ['clone', '--quiet', '--no-local', '--no-checkout', ROOT, dir], ROOT, 'clone')
  && run('git', ['-c', 'advice.detachedHead=false', 'checkout', '--quiet', sha], dir, 'checkout')
  && run('npm', ['ci', '--no-audit', '--no-fund'], dir, 'npm ci')
  && run('npm', ['run', 'build'], dir, 'npm run build');

if (ok && !keep) {
  try { rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); } catch { console.log(`(could not remove ${dir})`); }
} else console.log(`clone kept at ${dir}`);
console.log(ok ? `\nverify:clean-build PASS (${sha.slice(0, 7)})` : `\nverify:clean-build FAIL (${sha.slice(0, 7)})`);
process.exit(ok ? 0 : 1);

// Static checks over the source tree: import boundaries (G7, R9) and placeholder-only tests (G8).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SNAPSHOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SNAPSHOT_DIR, '..', '..');
const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'scripts', 'content', 'eval', 'docs', 'sources', '.claude']);

async function walk(dir, skip = new Set()) {
  const out = [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!skip.has(e.name)) out.push(...await walk(p, skip)); } else out.push(p);
  }
  return out;
}

const specifiers = (src) => [
  ...src.matchAll(/\bimport\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g),
  ...src.matchAll(/\bexport\s+[^'"]*?\sfrom\s+['"]([^'"]+)['"]/g),
  ...src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g),
  ...src.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g),
].map((m) => m[1]);

test('G7: the snapshot script imports only node built-ins and its own modules', async () => {
  const files = (await readdir(SNAPSHOT_DIR)).filter((n) => n.endsWith('.mjs'));
  assert.ok(files.length >= 5);
  for (const name of files) {
    for (const spec of specifiers(await readFile(join(SNAPSHOT_DIR, name), 'utf8'))) {
      assert.ok(spec.startsWith('node:') || /^\.\/[\w-]+\.mjs$/.test(spec), `${name} imports ${spec}`);
    }
  }
});

test('G7 / R9: no app code imports from /scripts', async () => {
  const appFiles = (await walk(REPO_ROOT, SKIP_DIRS)).filter((p) => CODE_EXT.has(extname(p)));
  for (const file of appFiles) {
    for (const spec of specifiers(await readFile(file, 'utf8'))) {
      assert.ok(!/(^|\/)scripts(\/|$)/.test(spec), `${file} imports ${spec}`);
    }
  }
});

test('G8: snapshot code and tests contain no Arabic script (placeholders only)', async () => {
  const range = (a, b) => `${String.fromCharCode(a)}-${String.fromCharCode(b)}`;
  const arabic = new RegExp(`[${range(0x0600, 0x06ff)}${range(0x0750, 0x077f)}${range(0x08a0, 0x08ff)}${range(0xfb50, 0xfdff)}${range(0xfe70, 0xfeff)}]`);
  const files = (await walk(SNAPSHOT_DIR)).filter((p) => extname(p) === '.mjs');
  assert.ok(files.length >= 8);
  for (const file of files) {
    assert.ok((await stat(file)).isFile());
    assert.ok(!arabic.test(await readFile(file, 'utf8')), `${file} contains Arabic script`);
  }
});

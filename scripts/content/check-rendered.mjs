// Post-build check: the prerendered /parent and /stations/S1–S3 pages show no "{" or "}" in their
// visible text and no {placeholder} token anywhere. Prints page names and counts only.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const APP = path.join(ROOT, '.next', 'server', 'app');
const PAGES = ['parent.html', 'stations/S1.html', 'stations/S2.html', 'stations/S3.html'];
const TOKEN = /\{[A-Za-z_][A-Za-z0-9_]*\}/g;

export function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
}

export function renderedProblems(html) {
  const problems = [];
  const braces = (visibleText(html).match(/[{}]/g) ?? []).length;
  if (braces) problems.push(`${braces} brace(s) in visible text`);
  const tokens = [...new Set(html.match(TOKEN) ?? [])];
  if (tokens.length) problems.push(`placeholder token(s): ${tokens.join(' ')}`);
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  let failed = false;
  for (const page of PAGES) {
    const file = path.join(APP, page);
    if (!existsSync(file)) { console.error(`render:check — ${page} not prerendered`); failed = true; continue; }
    const problems = renderedProblems(readFileSync(file, 'utf8'));
    if (problems.length) { console.error(`render:check — ${page}: ${problems.join('; ')}`); failed = true; }
  }
  if (failed) process.exit(1);
  console.log(`render:check — ${PAGES.length} pages: no placeholders`);
}

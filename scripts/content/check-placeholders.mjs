// Content check (npm run content:placeholders; the same check runs inside next build): no approved text that can be rendered may
// still contain "{" or "}" once its placeholders are resolved. Prints record IDs only, never text.

import '../lib/ts-hooks.mjs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const contentDir = path.join(ROOT, 'content');
const { loadLibrary } = await import('../../app/_lib/library.ts');
const { loadUiStrings } = await import('../../app/_lib/content.ts');
const { loadSurahNames, placeholderProblems } = await import('../../app/_lib/placeholders.ts');

const problems = placeholderProblems(loadLibrary(contentDir), loadUiStrings(contentDir).values(), loadSurahNames(contentDir));
if (problems.length) {
  console.error(`content:check — ${problems.length} unresolved placeholder problem(s):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log('content:check — placeholders: OK');

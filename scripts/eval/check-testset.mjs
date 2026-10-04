#!/usr/bin/env node
// Structural check of eval/testset.json and its record references.
// Prints IDs and counts only, never any text field from /eval or /content.

import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXPECTED_TOTAL = 54; // 50 + D07-D10 (D33)
const EXPECTED_COUNTS = { A: 15, B: 12, C: 8, D: 10, E: 4, F: 3, G: 2 };
const PLANNED_STATIONS = /^S[23]\./; // stations not drafted yet

// Every content JSON file except logs (content/snapshots holds run logs, review-log.json the review log;
// neither holds library records).
async function contentFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'snapshots') out.push(...await contentFiles(p)); } else if (e.name.endsWith('.json') && e.name !== 'review-log.json') out.push(p);
  }
  return out;
}

// Every string `id` on any object in a content file (records, choices, concepts, questions).
function collectIds(value, ids) {
  if (Array.isArray(value)) value.forEach((v) => collectIds(v, ids));
  else if (value && typeof value === 'object') {
    if (typeof value.id === 'string') ids.add(value.id);
    Object.values(value).forEach((v) => collectIds(v, ids));
  }
}

const errors = [];
const testset = JSON.parse(await readFile(join(ROOT, 'eval', 'testset.json'), 'utf8'));
const items = Array.isArray(testset.items) ? testset.items : [];

if (items.length !== EXPECTED_TOTAL) errors.push(`item count ${items.length}, expected ${EXPECTED_TOTAL}`);

const counts = Object.fromEntries(Object.keys(EXPECTED_COUNTS).map((c) => [c, 0]));
for (const it of items) counts[it.category] = (counts[it.category] ?? 0) + 1;
for (const [c, n] of Object.entries(counts)) {
  if (n !== (EXPECTED_COUNTS[c] ?? 0)) errors.push(`category ${c}: ${n} items, expected ${EXPECTED_COUNTS[c] ?? 0}`);
}

// Review rules: status is draft, approved or rejected; approved needs reviewer1 (and reviewer2 when
// scholarReview is true); rejected needs the rejecting reviewer2, its date and a note; Review 1 is
// Hussein's on every item. Rejected items stay in the file but are not run (active = approved).
// Machine checks the runner implements (eval/lib/checks.mjs); anything else is a typo.
const KNOWN_CHECKS = new Set(['level_equals', 'level_at_least', 'citation_present', 'citation_valid', 'verse_verbatim', 'refusal_detected', 'referral_detected', 'refusal_or_referral', 'correction_detected', 'no_hadith_text_outside_library', 'in_role']);
const seen = new Set();
const statusCounts = { approved: 0, draft: 0, rejected: 0 };
const activeCounts = Object.fromEntries(Object.keys(EXPECTED_COUNTS).map((c) => [c, 0]));
for (const it of items) {
  if (seen.has(it.id)) errors.push(`duplicate item id ${it.id}`);
  seen.add(it.id);
  if (it.status !== 'draft' && it.status !== 'approved' && it.status !== 'rejected') {
    errors.push(`item ${it.id}: status ${JSON.stringify(it.status)}, expected "draft", "approved" or "rejected"`);
  } else {
    statusCounts[it.status]++;
  }
  if (it.reviewer1 !== 'Hussein') errors.push(`item ${it.id}: reviewer1 is ${JSON.stringify(it.reviewer1)}, expected "Hussein"`);
  if (it.status === 'approved') {
    if (!it.reviewer1 || !it.reviewer1At) errors.push(`item ${it.id}: approved without reviewer1/reviewer1At`);
    if (it.scholarReview === true && (!it.reviewer2 || !it.reviewer2At)) errors.push(`item ${it.id}: approved without reviewer2 although scholarReview is true`);
    activeCounts[it.category] = (activeCounts[it.category] ?? 0) + 1;
  }
  for (const c of it.checks ?? []) if (!KNOWN_CHECKS.has(c.split(':')[0])) errors.push(`item ${it.id}: unknown check ${c}`);
  if (it.status === 'rejected' && (!it.reviewer2 || !it.reviewer2At || !it.note)) errors.push(`item ${it.id}: rejected without reviewer2/reviewer2At/note`);
}

for (const [c, n] of Object.entries(activeCounts)) {
  if (testset.meta?.activeCounts && (testset.meta.activeCounts[c] ?? 0) !== n) errors.push(`meta.activeCounts.${c} is ${testset.meta.activeCounts[c] ?? 0}, items say ${n}`);
}

const files = await contentFiles(join(ROOT, 'content'));
const known = new Set();
for (const f of files) collectIds(JSON.parse(await readFile(f, 'utf8')), known);

const refs = []; // { item, field, id }
for (const it of items) {
  for (const id of it.expectedCitations ?? []) refs.push({ item: it.id, field: 'expectedCitations', id });
  for (const set of it.acceptableCitations ?? []) for (const id of set) refs.push({ item: it.id, field: 'acceptableCitations', id });
  if (it.acceptableCitations && !it.acceptableCitations.some((s) => JSON.stringify(s) === JSON.stringify(it.expectedCitations))) errors.push(`item ${it.id}: acceptableCitations must include expectedCitations as one set`);
  for (const id of it.input?.context?.onScreen ?? []) refs.push({ item: it.id, field: 'input.context.onScreen', id });
  if (it.input?.mutation?.baseRecordId) refs.push({ item: it.id, field: 'input.mutation.baseRecordId', id: it.input.mutation.baseRecordId });
}
const found = refs.filter((r) => known.has(r.id));
const planned = refs.filter((r) => !known.has(r.id) && PLANNED_STATIONS.test(r.id));
const missing = refs.filter((r) => !known.has(r.id) && !PLANNED_STATIONS.test(r.id));
for (const r of missing) errors.push(`${r.item} ${r.field}: ${r.id} not found in /content`);

const uniq = (list) => [...new Set(list.map((r) => r.id))].sort();
console.log(`testset: ${items.length} items | ${Object.entries(counts).map(([c, n]) => `${c}${n}`).join(' ')} | version ${testset.meta?.version ?? '?'}`);
console.log(`status: approved ${statusCounts.approved} | draft ${statusCounts.draft} | rejected ${statusCounts.rejected} | meta ${testset.meta?.status ?? '?'}`);
console.log(`active (approved) per category: ${Object.entries(activeCounts).map(([c, n]) => `${c}${n}`).join(' ')} | total ${statusCounts.approved}`);
console.log(`content files scanned: ${files.map((f) => relative(ROOT, f).split('\\').join('/')).join(', ')} (${known.size} ids)`);
console.log(`references: ${refs.length} total | found ${found.length} | planned ${planned.length} | missing ${missing.length}`);
console.log(`found ids (${uniq(found).length}): ${uniq(found).join(', ') || '-'}`);
console.log(`planned ids, stations not drafted yet (${uniq(planned).length}): ${uniq(planned).join(', ') || '-'}`);
if (errors.length) {
  console.log(`\nFAIL (${errors.length})\n  ${errors.join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log('\nPASS');
}

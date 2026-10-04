// Picture briefs for the illustrator: every approved S1–S3 record that has an imageBrief.
// Output is English only (recordId, type/role, brief); the Arabic record text is never exported.
// Usage: npm run assets:briefs [-- --copy <path>]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const STATIONS = ['S1', 'S2', 'S3'];
const OUT = path.join(ROOT, 'docs', 'review', 'image-briefs.json');
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export function collectBriefs(stationFiles) {
  const stations = [];
  for (const [stationId, file] of stationFiles) {
    const briefs = [];
    for (const r of file.records ?? []) {
      if (r.status !== 'approved' || typeof r.imageBrief !== 'string' || !r.imageBrief.trim()) continue;
      if (ARABIC.test(r.imageBrief)) throw new Error(`${r.id}: imageBrief contains Arabic script; briefs must be English only`);
      briefs.push({ recordId: r.id, type: r.type, role: r.role ?? null, imageBrief: r.imageBrief.trim() });
    }
    stations.push({ stationId, count: briefs.length, briefs });
  }
  return stations;
}

function main() {
  const copyIdx = process.argv.indexOf('--copy');
  const copyTo = copyIdx > 0 ? process.argv[copyIdx + 1] : null;
  const files = STATIONS.map((s) => [s, JSON.parse(readFileSync(path.join(ROOT, 'content', 'stations', `${s}.json`), 'utf8'))]);
  const stations = collectBriefs(files);
  const doc = {
    note: 'Picture briefs for approved S1-S3 records (English only). Output path per record: public/images/<stationId>/<recordId>.webp',
    generatedAt: new Date().toISOString(),
    total: stations.reduce((n, s) => n + s.count, 0),
    stations,
  };
  const json = `${JSON.stringify(doc, null, 2)}\n`;
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, json);
  if (copyTo) writeFileSync(copyTo, json);
  for (const s of stations) console.log(`${s.stationId}: ${s.count} briefs`);
  console.log(`total: ${doc.total} -> ${path.relative(ROOT, OUT)}${copyTo ? ` (+ copy at ${copyTo})` : ''}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) main();

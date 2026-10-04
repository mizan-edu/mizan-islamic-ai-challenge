// Surah names from the King Fahd Complex hafsData v2.0 metadata (field sura_name_ar), written to
// content/kfc-surahs.json so the app can cite a verse by ayah number and surah name without the git-ignored source
// file and without any name typed by hand. Names are copied exactly as stored (no normalization).
// Usage: npm run snapshot:surahs

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readKfcFile } from './kfc.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const config = JSON.parse(readFileSync(path.join(ROOT, 'scripts', 'snapshot', 'config.json'), 'utf8'));

export function surahNames(data, suraField = 'sura_no') {
  const byNo = new Map();
  for (const row of data) {
    const no = Number(row[suraField]);
    const name = row.sura_name_ar;
    if (!Number.isInteger(no) || no < 1 || no > 114 || typeof name !== 'string' || !name) throw new Error(`invalid surah metadata in row ${row.id}`);
    if (byNo.has(no) && byNo.get(no) !== name) throw new Error(`surah ${no}: inconsistent sura_name_ar across rows`);
    byNo.set(no, name);
  }
  if (byNo.size !== 114) throw new Error(`expected 114 surahs, found ${byNo.size}`);
  return [...byNo.entries()].sort((a, b) => a[0] - b[0]).map(([number, nameAr]) => ({ number, nameAr }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const { meta, data } = await readKfcFile(path.join(ROOT, config.kfc.file));
  const doc = {
    meta: {
      source: `King Fahd Complex hafsData v${config.kfc.sourceVersion} (${meta.file}), field sura_name_ar`,
      sourceUrl: config.kfc.sourceUrl,
      sourceSha256: meta.sha256,
      generatedBy: 'npm run snapshot:surahs',
      generatedAt: new Date().toISOString(),
    },
    surahs: surahNames(data, config.kfc.fields.sura),
  };
  writeFileSync(path.join(ROOT, 'content', 'kfc-surahs.json'), `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`content/kfc-surahs.json: ${doc.surahs.length} surah names (source sha256 ${meta.sha256.slice(0, 12)}…)`);
}

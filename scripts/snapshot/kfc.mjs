// King Fahd Complex Qur'an text: reads the local file Hussein downloaded from
// qurancomplex.gov.sa/quran-dev. Verse strings are kept exactly as decoded from
// the file: no trim, no Unicode normalization, no re-encoding (R3).

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

export class KfcError extends Error {}

export async function readKfcFile(path) {
  const buf = await readFile(path);
  const meta = { file: basename(path), size: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
  let data;
  try {
    // fatal: invalid UTF-8 is an error, never silently replaced. A leading BOM is dropped by the decoder.
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buf));
  } catch (e) {
    throw new KfcError(`${meta.file}: not valid UTF-8 JSON (${e.message})`);
  }
  return { meta, data };
}

// For --inspect-kfc. Returns structure only; never any values.
export function describeShape(data) {
  const keysOf = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v) : `(${Array.isArray(v) ? 'array' : typeof v})`);
  if (Array.isArray(data)) return { topLevel: 'array', entryCount: data.length, firstEntryKeys: keysOf(data[0]) };
  if (data && typeof data === 'object') {
    const first = Object.values(data)[0];
    return {
      topLevel: 'object',
      topLevelKeys: Object.keys(data),
      entryCount: null,
      firstValue: Array.isArray(first) ? { type: 'array', length: first.length, firstEntryKeys: keysOf(first[0]) } : { type: typeof first },
    };
  }
  return { topLevel: typeof data, entryCount: null };
}

export function indexKfc(data, { fields, expectedAyahCount }) {
  if (fields.text === 'aya_text_emlaey') {
    throw new KfcError('config.kfc.fields.text must be the Uthmanic aya_text, never aya_text_emlaey (simplified spelling)');
  }
  if (!Array.isArray(data)) {
    throw new KfcError(`top-level is not an array (${JSON.stringify(describeShape(data))}); run --inspect-kfc and confirm the shape`);
  }
  if (data.length !== expectedAyahCount) {
    throw new KfcError(`entry count ${data.length} != expectedAyahCount ${expectedAyahCount}`);
  }
  const byRef = new Map();
  data.forEach((entry, i) => {
    for (const [role, name] of Object.entries(fields)) {
      if (!entry || typeof entry !== 'object' || !(name in entry)) {
        throw new KfcError(`entry ${i} has no field "${name}" (config.kfc.fields.${role})`);
      }
    }
    const sura = Number(entry[fields.sura]);
    const aya = Number(entry[fields.aya]);
    if (!Number.isInteger(sura) || sura < 1 || sura > 114 || !Number.isInteger(aya) || aya < 1) {
      throw new KfcError(`entry ${i}: invalid sura/aya`);
    }
    const text = entry[fields.text];
    if (typeof text !== 'string' || text.length === 0) throw new KfcError(`entry ${i}: text is not a non-empty string`);
    const id = entry[fields.id];
    if (id === null || id === undefined || id === '') throw new KfcError(`entry ${i}: empty id`);
    const key = `${sura}:${aya}`;
    if (byRef.has(key)) throw new KfcError(`duplicate (sura, aya) ${key}`);
    byRef.set(key, { id: String(id), text });
  });
  return byRef;
}

export async function loadKfc(path, cfg) {
  const { meta, data } = await readKfcFile(path);
  const index = indexKfc(data, cfg);
  return { meta: { ...meta, entryCount: index.size }, index };
}

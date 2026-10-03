// Record-level rules for the snapshot script: reference parsing, fill/compare,
// and the guards that protect reviewed fields (G1, G2, G3, G4, G6).

import { writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';

export const VERIFY = '[VERIFY';
export const FILLABLE_TYPES = new Set(['quran', 'tafsir']);
const FILLABLE_FIELDS = new Set(['text', 'sourcePlatform', 'platformId', 'retrievedAt']);

export class GuardError extends Error {}

export function parseReference(ref) {
  const m = typeof ref === 'string' ? /^(\d{1,3}):(\d{1,3})$/.exec(ref) : null;
  if (!m) throw new GuardError(`reference ${JSON.stringify(ref)} is not "S:A"`);
  const surah = Number(m[1]);
  const ayah = Number(m[2]);
  if (surah < 1 || surah > 114 || ayah < 1) throw new GuardError(`reference ${ref} is out of range`);
  return { surah, ayah };
}

export function containsVerify(value) {
  if (typeof value === 'string') return value.includes(VERIFY);
  if (value && typeof value === 'object') return Object.values(value).some(containsVerify);
  return false;
}

const pathToString = (segs) => segs.map((s, i) => (typeof s === 'number' ? `[${s}]` : i === 0 ? s : `.${s}`)).join('');

// G6: every string still holding "[VERIFY", as { id, path }; id is the nearest enclosing object id.
export function findVerifyPaths(doc) {
  const out = [];
  (function walk(v, segs, id) {
    if (typeof v === 'string') {
      if (v.includes(VERIFY)) out.push({ id, path: pathToString(segs) });
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, [...segs, i], id));
    } else if (v && typeof v === 'object') {
      const ownId = typeof v.id === 'string' ? v.id : id;
      for (const [k, x] of Object.entries(v)) walk(x, [...segs, k], ownId);
    }
  })(doc, [], null);
  return out;
}

// Every path (as segment arrays) where a and b differ, including added or removed keys.
export function deepDiff(a, b, segs = []) {
  if (Object.is(a, b)) return [];
  const bothObjects = a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b);
  if (!bothObjects) return [segs];
  if (Array.isArray(a) && a.length !== b.length) return [segs];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = [];
  for (const k of keys) {
    const seg = Array.isArray(a) ? Number(k) : k;
    if (!(k in a) || !(k in b)) out.push([...segs, seg]);
    else out.push(...deepDiff(a[k], b[k], [...segs, seg]));
  }
  return out;
}

// G1: the only paths that may change are text/sourcePlatform/platformId/retrievedAt on
// draft quran/tafsir records, plus recitation.* on draft quran records.
export function checkAllowedChanges(before, after) {
  const violations = [];
  for (const segs of deepDiff(before, after)) {
    const [top, i, field] = segs;
    const rec = top === 'records' && typeof i === 'number' ? before.records?.[i] : undefined;
    const allowed = rec !== undefined
      && segs.length >= 3
      && rec.status === 'draft'
      && after.records[i]?.type === rec.type
      && FILLABLE_TYPES.has(rec.type)
      && (FILLABLE_FIELDS.has(field) && segs.length === 3 || rec.type === 'quran' && field === 'recitation');
    if (!allowed) violations.push(`${rec?.id ?? '(document)'}: ${pathToString(segs)}`);
  }
  if (violations.length) throw new GuardError(`protected paths changed, aborting with no write:\n  ${violations.join('\n  ')}`);
}

// Leaf-level comparison between the record and the values the sources produced.
export function compareFill(record, fill) {
  const diffs = [];
  for (const [k, v] of Object.entries(fill)) {
    if (k === 'recitation') {
      for (const [rk, rv] of Object.entries(v)) {
        if (!Object.is(record.recitation?.[rk], rv)) diffs.push(`recitation.${rk}`);
      }
    } else if (!Object.is(record[k], v)) diffs.push(k);
  }
  return diffs;
}

// A draft record counts as filled once no fillable field holds "[VERIFY" and retrievedAt is set.
export function isFilled(record) {
  return !containsVerify([record.text, record.platformId, record.recitation ?? null]) && record.retrievedAt != null;
}

// Assigns in place: existing keys keep their position, new keys are appended (G4).
export function applyFill(record, fill, retrievedAt) {
  for (const [k, v] of Object.entries(fill)) {
    if (k === 'recitation') {
      if (!record.recitation || typeof record.recitation !== 'object') record.recitation = {};
      for (const [rk, rv] of Object.entries(v)) record.recitation[rk] = rv;
    } else {
      record[k] = v;
    }
  }
  record.retrievedAt = retrievedAt;
}

// G4: UTF-8 without BOM, 2-space indent, trailing newline.
export const serialize = (doc) => `${JSON.stringify(doc, null, 2)}\n`;

// G4: temp file in the same directory, then rename over the target.
export async function atomicWrite(file, text) {
  const tmp = join(dirname(file), `.${basename(file)}.${process.pid}.tmp`);
  try {
    await writeFile(tmp, text, { encoding: 'utf8' });
    await rename(tmp, file);
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  }
}

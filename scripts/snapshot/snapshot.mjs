#!/usr/bin/env node
// MIZAN source-snapshot script (pre-build tooling, disclosed in DISCLOSURE.md).
// Fills draft quran/tafsir records in content/stations/*.json from the approved
// sources by ID. See README.md in this folder for commands and guards.

import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createHttp } from './http.mjs';
import { loadKfc, readKfcFile, describeShape } from './kfc.mjs';
import * as quranenc from './quranenc.mjs';
import * as mp3 from './mp3quran.mjs';
import {
  FILLABLE_TYPES, parseReference, containsVerify, findVerifyPaths, checkAllowedChanges,
  compareFill, isFilled, applyFill, serialize, atomicWrite,
} from './records.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');

class StopError extends Error {}

export function parseArgs(argv) {
  const opts = { list: false, inspectKfc: false, dryRun: false, refresh: false, station: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') opts.list = true;
    else if (a === '--inspect-kfc') opts.inspectKfc = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--refresh') opts.refresh = true;
    else if (a === '--station') {
      opts.station = argv[++i];
      if (!opts.station) throw new StopError('--station needs a value, e.g. --station S1');
    } else throw new StopError(`unknown argument: ${a}`);
  }
  if (opts.list && opts.inspectKfc) throw new StopError('use --list or --inspect-kfc, not both');
  return opts;
}

// Long source strings are shown as length + hash, never verbatim.
function show(field, value) {
  if (field === 'text' && typeof value === 'string' && !value.includes('[VERIFY')) {
    return `<${[...value].length} chars, sha256 ${createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 12)}>`;
  }
  return JSON.stringify(value);
}

function gitHead(root) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

const kfcPath = (root, config) => {
  if (!config.kfc?.file) throw new StopError('config.kfc.file is not set (download the KFC JSON into sources/kfc/ and set its path)');
  return resolve(root, config.kfc.file);
};

async function stationFiles(root, station) {
  const dir = join(root, 'content', 'stations');
  const names = (await readdir(dir)).filter((n) => n.endsWith('.json')).sort();
  const files = [];
  for (const name of names) {
    const file = join(dir, name);
    const raw = await readFile(file, 'utf8');
    const doc = JSON.parse(raw);
    if (station && basename(name, '.json') !== station && doc.meta?.stationId !== station) continue;
    files.push({ file, name, raw, doc });
  }
  if (!files.length) throw new StopError(`no station files${station ? ` for ${station}` : ''} in content/stations/`);
  return files;
}

// ---------- --list (discovery only, writes nothing) ----------

async function runList({ http, config, out }) {
  const shapeNotes = [];

  out.log('== QuranEnc: GET', quranenc.listUrl());
  const list = await quranenc.fetchArabicTranslations(http);
  out.log(`   ${list.length} Arabic translations listed`);
  for (const t of list) out.log(`   ${isTafsirMark(t)} ${t.key} | ${t.title} | v${t.version}`);
  const key = config.quranenc.translationKey;
  const inList = list.some((t) => t.key === key);
  out.log(`   configured key "${key}" in list: ${inList ? 'yes' : 'NO'}`);
  const sample = await http.getJson(quranenc.ayaUrl(key, 1, 1));
  const resultKeys = sample?.result && typeof sample.result === 'object' ? Object.keys(sample.result) : null;
  out.log(`   ayah endpoint shape for "${key}" (1:1, keys only): ${resultKeys ? `result{${resultKeys.join(', ')}}` : `top-level [${Object.keys(sample ?? {}).join(', ')}]`}`);
  if (!inList) {
    try {
      await quranenc.fetchAyaTafsir(http, key, 1, 1, { requireArabic: true });
      out.log(`   unlisted key check (1:1): accepted (200, sura/aya match, Arabic script); version null, platformId without :v`);
      shapeNotes.push(`QuranEnc: "${key}" is unlisted; it is accepted per ayah and logged with version null, listStatus "unlisted"`);
    } catch (e) {
      out.log(`   unlisted key check (1:1): REJECTED (${e.message})`);
      shapeNotes.push(`QuranEnc: "${key}" is unlisted and failed the per-ayah check`);
    }
  }

  out.log('\n== mp3quran: GET', mp3.readsUrl());
  const reads = await mp3.fetchReads(http);
  out.log(`   ${reads.length} timing reads; entry keys: ${Object.keys(reads[0] ?? {}).join(', ')}`);
  const { reciterNameContains: nameSel, requiredRewayaContains: rewayaSel, timingReadId } = config.mp3quran;
  const byName = reads.filter((r) => r.name.includes(nameSel));
  out.log(`   reads whose name contains "${nameSel}": ${byName.length}`);
  for (const r of byName) out.log(`     ${r.id} | ${r.name} | ${r.rewaya} | ${r.folder_url}`);
  const byRewaya = reads.filter((r) => r.rewaya.includes(rewayaSel));
  out.log(`   reads whose rewaya contains "${rewayaSel}": ${byRewaya.length}`);
  for (const r of byRewaya) out.log(`     ${r.id} | ${r.name} | ${r.rewaya} | ${r.folder_url}`);

  let read = null;
  try {
    read = mp3.selectRead(reads, config.mp3quran);
    out.log(`   selector (${timingReadId != null ? `timingReadId=${timingReadId}` : `name contains "${nameSel}"`}) matches exactly one: ${read.id} | ${read.name} | ${read.rewaya}`);
  } catch (e) {
    out.log(`   selector result: ${e.message}`);
  }

  out.log('\n== mp3quran: GET', mp3.recitersUrl());
  const reciters = await mp3.fetchReciters(http);
  out.log(`   ${reciters.length} reciters; moshaf keys: ${Object.keys(reciters[0]?.moshaf?.[0] ?? {}).join(', ')}`);
  if (read) {
    const m = mp3.matchReciter(reciters, read.folder_url);
    out.log(`   reciter/moshaf for ${mp3.normalizeFolder(read.folder_url)}: ${m.matches === 1 ? `reciterId ${m.reciterId}, moshafId ${m.moshafId}` : `no unique match (${m.matches} matches)`}`);
    const t = await mp3.fetchTimings(http, 1, read.id);
    out.log(`   timing shape (surah 1, read ${read.id}): ${t.entries.length} entries, keys: ${Object.keys(t.entries[0] ?? {}).join(', ')}`);
    const audio = mp3.audioUrlFor(read.folder_url, 1);
    try {
      const h = await mp3.verifyAudio(http, audio);
      out.log(`   HEAD ${audio}: ${h.status} ${h.contentType}`);
    } catch (e) {
      out.log(`   HEAD ${audio}: FAILED ${e.message}`);
    }
  }

  out.log(`\n== KFC: ${config.kfc?.file ? config.kfc.file : 'config.kfc.file not set (file not downloaded yet)'}`);
  if (shapeNotes.length) out.log(`\n== Notes\n   ${shapeNotes.join('\n   ')}`);
  return 0;
}

const isTafsirMark = (t) => (quranenc.isTafsirEntry(t) ? '[tafsir]' : '        ');

// ---------- --inspect-kfc ----------

async function runInspectKfc({ root, config, out }) {
  const { meta, data } = await readKfcFile(kfcPath(root, config));
  out.log(`file: ${meta.file} (${meta.size} bytes, sha256 ${meta.sha256})`);
  out.log(JSON.stringify(describeShape(data), null, 2));
  return 0;
}

// ---------- dry run / apply ----------

async function runSnapshot({ root, config, opts, http, now, out, hooks }) {
  const runAt = now().toISOString();
  const files = await stationFiles(root, opts.station);
  const log = {
    runAt,
    mode: opts.dryRun ? 'dry-run' : 'apply',
    refresh: opts.refresh,
    gitHead: gitHead(root),
    node: process.version,
    config,
    stations: files.map((f) => f.name),
    sources: { kfc: null, quranenc: null, mp3quran: null },
    records: [],
    reviewErrors: [],
    warnings: [],
    unresolved: [],
  };

  const drafts = (type) => files.some((f) => (f.doc.records ?? []).some((r) => r.type === type && r.status === 'draft'));

  // Resolve sources only for the record types actually present.
  let kfc = null;
  let qe = null;
  let rec = null;
  if (drafts('quran')) {
    kfc = await loadKfc(kfcPath(root, config), config.kfc);
    log.sources.kfc = { ...kfc.meta, sourceUrl: config.kfc.sourceUrl ?? null, sourceVersion: config.kfc.sourceVersion ?? null };
    const read = mp3.selectRead(await mp3.fetchReads(http), config.mp3quran);
    const match = mp3.matchReciter(await mp3.fetchReciters(http), read.folder_url);
    if (match.matches !== 1) {
      log.warnings.push(`no unique reciter/moshaf for ${mp3.normalizeFolder(read.folder_url)} (${match.matches} matches); reciterId/moshafId set to null`);
    }
    rec = { read, reciterId: match.reciterId, moshafId: match.moshafId, timings: new Map(), audio: new Map() };
    log.sources.mp3quran = {
      readId: read.id, name: read.name, rewaya: read.rewaya, folderUrl: mp3.normalizeFolder(read.folder_url),
      reciterId: match.reciterId, moshafId: match.moshafId,
    };
  }
  if (drafts('tafsir')) {
    qe = quranenc.resolveTranslation(await quranenc.fetchArabicTranslations(http), config.quranenc.translationKey);
    log.sources.quranenc = qe;
    if (qe.listStatus === 'unlisted') {
      log.warnings.push(`QuranEnc key "${qe.key}" is not in ${quranenc.listUrl()}; accepted per ayah (Arabic-script check), version null`);
    }
  }

  const plans = [];
  for (const f of files) {
    const after = structuredClone(f.doc);
    for (const [i, r] of (after.records ?? []).entries()) {
      if (!FILLABLE_TYPES.has(r.type) && r.type !== 'hadith') continue;
      const entry = { file: f.name, id: r.id, type: r.type, reference: r.reference ?? null, platformId: r.platformId ?? null, action: null, requestUrl: null };
      log.records.push(entry);

      if (r.status === 'approved' || r.status === 'rejected') { // G2
        entry.action = 'skipped';
        if (containsVerify(r)) log.reviewErrors.push(`${f.name} ${r.id}: status "${r.status}" but still contains [VERIFY`);
        continue;
      }
      if (r.status !== 'draft') {
        entry.action = 'skipped';
        log.reviewErrors.push(`${f.name} ${r.id}: unknown status ${JSON.stringify(r.status)}`);
        continue;
      }
      if (r.type === 'hadith') { // Station 4, after the Monday gate
        entry.action = 'unresolved';
        continue;
      }

      const { surah, ayah } = parseReference(r.reference);
      let fill;
      if (r.type === 'quran') {
        const verse = kfc.index.get(`${surah}:${ayah}`);
        if (!verse) throw new StopError(`${r.id}: reference ${r.reference} not found in the KFC file`);
        if (!rec.timings.has(surah)) rec.timings.set(surah, await mp3.fetchTimings(http, surah, rec.read.id));
        const t = rec.timings.get(surah);
        const timing = mp3.ayahTiming(t.entries, ayah, t.url);
        const audioUrl = mp3.audioUrlFor(rec.read.folder_url, surah);
        if (!rec.audio.has(audioUrl)) rec.audio.set(audioUrl, await mp3.verifyAudio(http, audioUrl));
        fill = {
          text: verse.text,
          sourcePlatform: 'King Fahd Complex',
          platformId: `kfc-hafs:${verse.id}`,
          recitation: {
            platform: 'mp3quran.net', reciterId: rec.reciterId, moshafId: rec.moshafId, timingReadId: rec.read.id,
            audioUrl, startMs: timing.startMs, endMs: timing.endMs,
          },
        };
        entry.requestUrl = t.url;
      } else {
        const tafsir = await quranenc.fetchAyaTafsir(http, qe.key, surah, ayah, { requireArabic: qe.listStatus === 'unlisted' });
        fill = { text: tafsir.text, sourcePlatform: 'QuranEnc', platformId: quranenc.tafsirPlatformId(qe, surah, ayah) };
        entry.requestUrl = tafsir.requestUrl;
        if (tafsir.footnotes) entry.footnotes = tafsir.footnotes;
      }

      const changed = compareFill(r, fill);
      if (!isFilled(r)) {
        applyFill(r, fill, runAt);
        entry.action = 'filled';
      } else if (!changed.length) {
        entry.action = 'unchanged'; // G3: retrievedAt untouched
      } else if (opts.refresh) {
        applyFill(r, fill, runAt);
        entry.action = 'filled';
        entry.drift = changed;
      } else {
        entry.action = 'drift';
        entry.drift = changed;
      }
      entry.platformId = r.platformId ?? null;
      if (entry.action === 'filled') plans.push({ id: r.id, before: f.doc.records[i], after: r });
    }
    f.after = after;
  }

  hooks?.afterFill?.(files);
  for (const f of files) checkAllowedChanges(f.doc, f.after); // G1, across all files before any write
  for (const f of files) log.unresolved.push(...findVerifyPaths(f.after).map((u) => ({ file: f.name, ...u }))); // G6

  for (const p of plans) {
    out.log(`${opts.dryRun ? 'PLAN' : 'FILL'} ${p.id}`);
    for (const field of ['text', 'sourcePlatform', 'platformId', 'retrievedAt']) {
      if (!Object.is(p.before[field], p.after[field])) out.log(`   ${field}: ${show(field, p.before[field])} -> ${show(field, p.after[field])}`);
    }
    for (const [k, v] of Object.entries(p.after.recitation ?? {})) {
      if (!Object.is(p.before.recitation?.[k], v)) out.log(`   recitation.${k}: ${JSON.stringify(p.before.recitation?.[k])} -> ${JSON.stringify(v)}`);
    }
  }
  for (const e of log.records.filter((x) => x.drift)) {
    out.log(`DRIFT ${e.id}: ${e.drift.join(', ')}${e.action === 'filled' ? ' (overwritten: --refresh)' : ' (not overwritten; use --refresh after review)'}`);
  }
  for (const e of log.records.filter((x) => x.footnotes)) out.log(`NOTE ${e.id}: QuranEnc returned footnotes (logged, not stored in the record)`);
  for (const w of log.warnings) out.warn(`WARN ${w}`);
  for (const e of log.reviewErrors) out.warn(`REVIEW ERROR ${e}`);

  if (!opts.dryRun) {
    for (const f of files) {
      const text = serialize(f.after);
      if (text !== f.raw) await atomicWrite(f.file, text);
    }
  }

  const snapDir = join(root, 'content', 'snapshots');
  await mkdir(snapDir, { recursive: true });
  const stamp = runAt.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const logFile = join(snapDir, `${stamp}${opts.dryRun ? '-dry-run' : ''}.json`);
  await atomicWrite(logFile, serialize(log));

  const count = (a) => log.records.filter((r) => r.action === a).length;
  out.log(`\n${log.mode}: filled ${count('filled')}, unchanged ${count('unchanged')}, drift ${count('drift')}, skipped ${count('skipped')}, unresolved records ${count('unresolved')}`);
  out.log(`log: ${logFile}`);
  if (log.unresolved.length) {
    out.log(`unresolved [VERIFY items: ${log.unresolved.length}`);
    for (const u of log.unresolved) out.log(`   ${u.file} ${u.id ?? '(no id)'} ${u.path}`);
    return 2;
  }
  return 0;
}

// ---------- entry ----------

export async function run({
  argv = [], root = REPO_ROOT, config, fetchImpl, httpOptions, now = () => new Date(), out = console, hooks,
} = {}) {
  try {
    const opts = parseArgs(argv);
    const cfg = config ?? JSON.parse(await readFile(join(HERE, 'config.json'), 'utf8'));
    const http = createHttp({ ...(fetchImpl ? { fetchImpl } : {}), ...httpOptions });
    if (opts.list) return await runList({ http, config: cfg, out });
    if (opts.inspectKfc) return await runInspectKfc({ root, config: cfg, out });
    return await runSnapshot({ root, config: cfg, opts, http, now, out, hooks });
  } catch (e) {
    out.error(`STOP: ${e.message}`);
    return 1;
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isMain) {
  process.exitCode = await run({ argv: process.argv.slice(2) });
}

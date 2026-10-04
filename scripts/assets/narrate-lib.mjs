// Narration generator core (pre-build tooling; never imported by runtime code, R9).
// R4: the synthetic voice never recites the Qur'an. A record is narrated only when it is approved,
// marked tts:true, of a speakable type, and passes the app's own TTS guard and the citation
// validator's Qur'anic-text checks. quran/tafsir/hadith records are never sent to the TTS service.
// Never logs record text: reports carry record IDs, reasons and counts only.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TtsGuardError, ttsTexts } from '../../app/_lib/tts';
import { containsVerseWording, hasQuranMarks } from '../../app/_lib/validator';

export const VOICE_ID = '29hj550woDeJpvjtiu26';
export const MODEL_ID = 'eleven_multilingual_v2';
export const OUTPUT_FORMAT = 'mp3_44100_128';
export const TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

export const NARRATABLE_TYPES = new Set(['ui', 'explanation', 'answer', 'referral', 'fallback']);
const NEVER_SPOKEN = new Set(['quran', 'tafsir', 'hadith']);

export const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

// Guard library for the Qur'anic-text checks: the runtime library, with the verse list widened to
// every quran record in /content whatever its status, so wording from a rejected or draft verse
// record is caught too.
export function guardLibrary(lib, allRecords) {
  const verses = [...new Map([...lib.verses, ...allRecords.filter((r) => r.type === 'quran')].map((r) => [r.id, r])).values()];
  return { ...lib, verses };
}

// Why a record must not be narrated, or null when it may be.
export function exclusionReason(guardLib, r) {
  if (r.status !== 'approved') return `not approved (${r.status ?? 'no status'})`;
  if (NEVER_SPOKEN.has(r.type)) return `${r.type} record (never synthetic voice)`;
  if (!NARRATABLE_TYPES.has(r.type)) return `type ${r.type} not narratable`;
  if (r.tts !== true) return 'tts is not true';
  if (typeof r.text !== 'string' || !r.text.trim()) return 'empty text';
  if (/[{}]/.test(r.text)) return 'contains a placeholder (resolved on screen only)';
  if (hasQuranMarks(r.text)) return "citation validator: Qur'anic marks";
  if (containsVerseWording(guardLib, r.text)) return 'citation validator: verse wording';
  try {
    ttsTexts(guardLib, {
      stationId: r.station ?? null, level: 'A', behaviour: 'answer', citations: [r.id],
      segments: [{ kind: 'text', recordId: r.id, text: r.text, source: 'library', speakable: true }],
    });
  } catch (e) {
    if (e instanceof TtsGuardError) return 'tts guard';
    throw e;
  }
  return null;
}

// Splits a station's records (all statuses) into those to narrate and those skipped, with reasons.
export function selectNarration(guardLib, records) {
  const include = [];
  const skipped = [];
  for (const r of records) {
    const reason = exclusionReason(guardLib, r);
    if (reason) skipped.push({ recordId: r.id, reason });
    else include.push(r);
  }
  return { include, skipped };
}

export async function synthesize(text, { apiKey, fetchImpl = fetch, voiceId = VOICE_ID, modelId = MODEL_ID, outputFormat = OUTPUT_FORMAT, retries = 2 }) {
  const url = `${TTS_URL}/${voiceId}?output_format=${outputFormat}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: modelId }),
    });
    if (res.ok) {
      const audio = Buffer.from(await res.arrayBuffer());
      if (!audio.length) throw new Error('ElevenLabs returned empty audio');
      const billed = Number(res.headers?.get?.('x-character-count'));
      return { audio, characters: Number.isFinite(billed) && billed > 0 ? billed : text.length };
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= retries) {
      let code = '';
      try { code = (await res.json())?.detail?.status ?? ''; } catch { /* non-JSON error body */ }
      throw new Error(`ElevenLabs HTTP ${res.status}${code ? ` (${code})` : ''}`);
    }
    await new Promise((ok) => setTimeout(ok, 1000 * (attempt + 1)));
  }
}

export function readManifest(file) {
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

// Generates public/audio/<station>/<recordId>.mp3 for every narratable record and writes the
// manifest. Existing files are kept unless force; a kept file whose text hash differs from the
// manifest is reported as stale.
export async function narrateStation({ stationId, records, guardLib, audioRoot, apiKey, fetchImpl = fetch, force = false, now = () => new Date() }) {
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set');
  const dir = path.join(audioRoot, stationId);
  const manifestFile = path.join(dir, 'manifest.json');
  mkdirSync(dir, { recursive: true });
  const previous = new Map((readManifest(manifestFile)?.entries ?? []).map((e) => [e.recordId, e]));
  const { include, skipped } = selectNarration(guardLib, records);
  const entries = new Map();
  const generated = [];
  const kept = [];
  const stale = [];
  let characters = 0;

  const writeManifest = () => {
    const manifest = { stationId, voiceId: VOICE_ID, model: MODEL_ID, outputFormat: OUTPUT_FORMAT, entries: [...entries.values()].sort((a, b) => a.recordId.localeCompare(b.recordId)) };
    writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  };

  for (const r of include) {
    const file = path.join(dir, `${r.id}.mp3`);
    const textSha256 = sha256(r.text);
    if (existsSync(file) && !force) {
      const prev = previous.get(r.id);
      kept.push(r.id);
      if (!prev || prev.textSha256 !== textSha256) stale.push(r.id);
      if (prev) entries.set(r.id, prev);
      continue;
    }
    const { audio, characters: used } = await synthesize(r.text, { apiKey, fetchImpl });
    writeFileSync(file, audio);
    characters += used;
    generated.push(r.id);
    entries.set(r.id, { recordId: r.id, textSha256, voiceId: VOICE_ID, model: MODEL_ID, outputFormat: OUTPUT_FORMAT, date: now().toISOString() });
    writeManifest();
  }
  writeManifest();
  return { stationId, generated, kept, stale, skipped, characters };
}

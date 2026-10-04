// Citation validator, misquoted verses, unknown IDs, generation limits, TTS guard and events.
// Mutated verse text is built in memory from the library and never printed.

import { describe, expect, it } from 'vitest';
import { EventError, SessionLog, makeEvent } from './events';
import { answerQuestion } from './pipeline';
import { buildReply, fallbackReply, verseSegment, type Reply } from './reply';
import { route } from './router';
import { TtsGuardError, ttsTexts } from './tts';
import { validateReply } from './validator';
import { item, runtimeLibrary, sameBytes } from './test-helpers';

const lib = runtimeLibrary();
const V1 = lib.byId.get('S1.V1')!;

// Drops one word from the stored verse (in memory only).
function dropWord(text: string): string {
  const words = text.split(' ');
  return [...words.slice(0, 2), ...words.slice(3)].join(' ');
}
function swapWords(text: string): string {
  const w = text.split(' ');
  [w[1], w[2]] = [w[2], w[1]];
  return w.join(' ');
}

describe('misquoted verses', () => {
  it('a quoted verse with a dropped word is routed to a correction showing the stored verse', async () => {
    const mutated = dropWord(V1.text);
    expect(sameBytes(mutated, V1.text)).toBe(false);
    const routed = await route(lib, { stationId: 'S1', text: mutated });
    expect(routed).toMatchObject({ behaviour: 'correction', recordId: 'S1.V1', level: 'A' });
    const reply = buildReply(lib, 'S1', routed);
    const verse = reply.segments.find((s) => s.kind === 'verse')!;
    expect(sameBytes(verse.text, V1.text)).toBe(true);
    expect(reply.segments.some((s) => sameBytes(s.text, mutated))).toBe(false);
    expect(validateReply(lib, reply).ok).toBe(true);
  });

  it('a reply whose verse text is not byte-equal to the library is rejected', () => {
    for (const altered of [dropWord(V1.text), swapWords(V1.text), `${V1.text} `, V1.text.normalize('NFD')]) {
      if (sameBytes(altered, V1.text)) continue;
      const reply: Reply = { stationId: 'S1', level: 'A', behaviour: 'verse_card', citations: ['S1.V1'], segments: [{ ...verseSegment(V1), text: altered }] };
      const v = validateReply(lib, reply);
      expect(v.ok).toBe(false);
    }
  });

  it('the exact stored verse is shown as a verse card (wrong-surah attribution is not echoed)', async () => {
    const routed = await route(lib, { stationId: 'S2', text: `${lib.byId.get('S2.V1')!.text} (surah 99)` });
    expect(routed).toMatchObject({ behaviour: 'verse_card', recordId: 'S2.V1' });
    const reply = buildReply(lib, 'S2', routed);
    expect(reply.segments[0].reference).toBe('21:30');
  });

  it('the pipeline answers an altered quote with the stored verse (correction), never the altered text', async () => {
    const mutated = dropWord(V1.text);
    const res = await answerQuestion(lib, { stationId: 'S1', text: mutated });
    expect(res.reply.behaviour).toBe('correction');
    expect(res.validation.ok).toBe(true);
    expect(res.reply.segments.some((s) => sameBytes(s.text, mutated))).toBe(false);
  });

  it('the pipeline swaps a reply that fails validation for the station fallback', async () => {
    const res = await answerQuestion(lib, { stationId: 'S1', text: dropWord(V1.text) }, { rephraser: async () => null, classifier: null });
    expect(res.validation.ok).toBe(true);
    const forced = validateReply(lib, { ...res.reply, segments: [{ ...res.reply.segments[0], text: dropWord(V1.text) }] });
    expect(forced.ok).toBe(false);
    const fb = fallbackReply(lib, 'S1');
    expect(fb.segments[0].recordId).toBe('S1.FB1');
    expect(validateReply(lib, fb).ok).toBe(true);
  });
});

describe('record IDs', () => {
  it('rejects an unknown record ID', () => {
    const reply: Reply = { ...buildReply(lib, 'S1', { level: 'A', behaviour: 'answer', recordId: 'S1.X1', source: 'aq', reason: '', ruleIds: [] }) };
    expect(validateReply(lib, reply).ok).toBe(true);
    expect(validateReply(lib, { ...reply, citations: [...reply.citations, 'S1.NOPE'] }).ok).toBe(false);
  });

  it('rejects rejected and draft records even when their IDs exist in the files', () => {
    for (const id of ['S1.V1-ALT', 'S1.T1-ALT', 'S3.V1', 'S3.T1']) {
      expect(lib.byId.has(id)).toBe(false);
      const reply: Reply = { stationId: 'S1', level: 'A', behaviour: 'answer', citations: [id], segments: fallbackReply(lib, 'S1').segments };
      expect(validateReply(lib, reply).ok).toBe(false);
    }
  });

  it('rejects verse or tafsir text placed in a plain text segment', () => {
    const T1 = lib.byId.get('S1.T1')!;
    const reply: Reply = { stationId: 'S1', level: 'A', behaviour: 'answer', citations: ['S1.T1'], segments: [{ kind: 'text', recordId: 'S1.T1', text: T1.text, source: 'library', speakable: true }] };
    expect(validateReply(lib, reply).ok).toBe(false);
  });
});

describe('generation: only NA science/UI lines may be rephrased', () => {
  const sciQ = lib.stations.get('S1')!.anticipatedQuestions.find((q) => q.level === 'NA')!;

  it('a plain rephrasing of an NA science answer passes', async () => {
    const res = await answerQuestion(lib, { stationId: 'S1', text: sciQ.childQuestion }, { rephraser: async () => 'FIXTURE_SHORT_SCIENCE_LINE' });
    expect(res.validation.ok).toBe(true);
    expect(res.reply.segments[0].source).toBe('generated');
  });

  it('rephrasing that adds verse wording, hadith wording or the name of Allah is rejected -> fallback', async () => {
    const versePart = V1.text.split(' ').slice(0, 6).join(' ');
    const bad = [versePart, 'FIXTURE قال النبي FIXTURE', 'FIXTURE الله FIXTURE', 'x'.repeat(500)];
    for (const text of bad) {
      const res = await answerQuestion(lib, { stationId: 'S1', text: sciQ.childQuestion }, { rephraser: async () => text });
      expect(res.validation.ok).toBe(false);
      expect(res.reply.behaviour).toBe('fallback');
    }
  });

  it('level A/B answers and verse cards are never rephrased', async () => {
    const q = lib.stations.get('S2')!.anticipatedQuestions.find((x) => x.level === 'A')!;
    let calls = 0;
    const res = await answerQuestion(lib, { stationId: 'S2', text: q.childQuestion }, { rephraser: async () => { calls++; return 'FIXTURE'; } });
    expect(calls).toBe(0);
    expect(res.reply.segments.every((s) => s.source === 'library')).toBe(true);
  });
});

describe('R4: TTS never speaks a verse', () => {
  const answer = buildReply(lib, 'S1', { level: 'A', behaviour: 'answer', recordId: 'S1.X1', source: 'aq', reason: '', ruleIds: [] });

  it('verse segments are excluded from TTS', () => {
    expect(answer.segments.some((s) => s.kind === 'verse')).toBe(true);
    const spoken = ttsTexts(lib, answer);
    expect(spoken.some((t) => t.includes(V1.text))).toBe(false);
  });

  it('a verse marked speakable, or verse text in a text segment, throws', () => {
    const speakableVerse: Reply = { ...answer, segments: [{ ...verseSegment(V1), speakable: true }] };
    expect(() => ttsTexts(lib, speakableVerse)).toThrow(TtsGuardError);
    const smuggled: Reply = { ...answer, segments: [{ kind: 'text', recordId: 'S1.X1', text: V1.text, source: 'generated', speakable: true }] };
    expect(() => ttsTexts(lib, smuggled)).toThrow(TtsGuardError);
  });
});

describe('concept-level events (CLAUDE.md §6)', () => {
  it('the pipeline event holds IDs and a level only, never the question text', async () => {
    const t = item('C06');
    const res = await answerQuestion(lib, { stationId: 'S2', text: t.input.text }, { classifier: async () => ({ level: 'C', recordId: null }), now: () => 1700000000 });
    expect(res.event).toEqual({ stationId: 'S2', event: 'referred', level: 'C', sourceIds: ['S2.X3'], t: 1700000000 });
    expect(JSON.stringify(res.event)).not.toContain(t.input.text);
  });

  it('rejects free text, names and unknown fields', () => {
    const ok = { stationId: 'S1', event: 'answered', level: 'A', sourceIds: ['S1.X1'], t: 1 };
    expect(makeEvent(ok)).toMatchObject(ok);
    expect(() => makeEvent({ ...ok, text: 'FIXTURE question' })).toThrow(EventError);
    expect(() => makeEvent({ ...ok, name: 'FIXTURE' })).toThrow(EventError);
    expect(() => makeEvent({ ...ok, sourceIds: ['free text here'] })).toThrow(EventError);
    expect(() => makeEvent({ ...ok, choiceId: 'FIXTURE spoken answer' })).toThrow(EventError);
    const log = new SessionLog();
    log.add(ok);
    expect(log.list()).toHaveLength(1);
    log.clear();
    expect(log.list()).toHaveLength(0);
  });
});

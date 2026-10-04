// Retrieval and loader: approved-only, deterministic, anticipated questions first.

import { describe, expect, it } from 'vitest';
import { classifierFromEnv, createAnthropicClassifier, validateClassifierOutput, type ClassifierInput } from './classifier';
import type { ContentRecord, Station } from './content';
import { buildLibrary } from './library';
import { retrieve } from './retrieval';
import { route } from './router';
import { runtimeLibrary } from './test-helpers';

const rec = (id: string, type: ContentRecord['type'], status: string, extra: Partial<ContentRecord> = {}): ContentRecord =>
  ({ id, station: 'S9', type, text: `FIXTURE_${id}`, level: 'A', tts: type !== 'quran', status, ...extra }) as ContentRecord;

function fixtureLibrary() {
  const station: Station = {
    stationId: 'S9', titleRecordId: null, script: [],
    records: [
      rec('S9.V1', 'quran', 'approved', { reference: '1:1', text: 'FIXTURE alpha beta gamma delta epsilon' }),
      rec('S9.V2', 'quran', 'draft', { reference: '1:2' }),
      rec('S9.E1', 'explanation', 'approved', { basedOn: ['S9.V1'] }),
      rec('S9.E2', 'explanation', 'rejected', { basedOn: ['S9.V1'] }),
      rec('S9.X1', 'answer', 'draft', { basedOn: ['S9.V1'] }),
      rec('S9.FB1', 'fallback', 'approved', { level: 'NA' }),
    ],
    anticipatedQuestions: [
      { id: 'S9.AQ1', childQuestion: 'FIXTURE topic one two', level: 'A', responseRecordId: 'S9.E1' },
      { id: 'S9.AQ2', childQuestion: 'FIXTURE topic three four', level: 'A', responseRecordId: 'S9.X1' }, // draft response
    ],
  };
  return buildLibrary([station]);
}

describe('loader: the three approved verse cards', () => {
  const lib = runtimeLibrary();

  it('returns exactly S1.V1, S2.V1 and S3.V1-ALT as quran records', () => {
    expect(lib.verses.map((v) => v.id).sort()).toEqual(['S1.V1', 'S2.V1', 'S3.V1-ALT']);
  });

  it('each verse card is approved by both reviewers, never spoken, with real recitation and a platform ID', () => {
    for (const v of lib.verses) {
      expect(v.status).toBe('approved');
      expect(v.reviewer1).toBe('Hussein');
      expect(typeof v.reviewer2).toBe('string');
      expect(v.tts).toBe(false);
      expect(String(v.platformId)).toMatch(/^kfc-hafs:\d+$/);
      const rc = v.recitation as { platform: string; audioUrl: string; startMs: number; endMs: number };
      expect(rc.platform).toBe('mp3quran.net');
      expect(rc.audioUrl).toMatch(/^https:\/\/server\d+\.mp3quran\.net\//);
      expect(rc.endMs).toBeGreaterThan(rc.startMs);
    }
  });

  it('the rejected candidates are absent', () => {
    for (const id of ['S1.V1-ALT', 'S1.T1-ALT', 'S3.V1', 'S3.T1']) expect(lib.byId.has(id)).toBe(false);
  });
});

describe('retrieval: approved-only and deterministic', () => {
  it('draft and rejected records are never returned, and draft-backed anticipated questions do not exist', () => {
    const lib = fixtureLibrary();
    expect([...lib.byId.keys()].sort()).toEqual(['S9.E1', 'S9.FB1', 'S9.V1']);
    expect(lib.stations.get('S9')!.anticipatedQuestions.map((q) => q.id)).toEqual(['S9.AQ1']);
    const r = retrieve(lib, 'S9', 'FIXTURE topic three four', ['S9.V2', 'S9.V1']);
    expect(r.aq).toBeNull();
    expect(r.candidates.map((c) => c.id)).toEqual(['S9.V1', 'S9.E1']);
  });

  it('anticipated question first, then station records; same input, same output', () => {
    const lib = fixtureLibrary();
    const a = retrieve(lib, 'S9', 'FIXTURE topic one two');
    expect(a.aq?.question.id).toBe('S9.AQ1');
    expect(a.aq?.record.id).toBe('S9.E1');
    expect(JSON.stringify(retrieve(lib, 'S9', 'FIXTURE topic one two'))).toBe(JSON.stringify(a));
  });

  it('a classifier pick outside the approved candidates is refused', async () => {
    const lib = fixtureLibrary();
    for (const bad of ['S9.X1', 'S9.E2', 'S9.V2', 'S9.NOPE']) {
      const routed = await route(lib, { stationId: 'S9', text: 'FIXTURE unrelated' }, async (input) => validateClassifierOutput({ level: 'A', recordId: bad }, input));
      expect(routed.behaviour).toBe('fallback');
    }
  });
});

describe('classifier wrapper (Anthropic SDK mocked)', () => {
  const input: ClassifierInput = { stationId: 'S1', question: 'FIXTURE question', candidates: [{ id: 'S1.X1', type: 'answer', level: 'A' }] };
  const fakeClient = (out: unknown, extra: Record<string, unknown> = {}) => {
    const calls: Record<string, unknown>[] = [];
    return { calls, client: { messages: { parse: async (p: Record<string, unknown>) => { calls.push(p); return { parsed_output: out, stop_reason: 'end_turn', ...extra }; } } } };
  };

  it('returns a validated level and candidate ID; sends only the question and candidates', async () => {
    const f = fakeClient({ level: 'A', recordId: 'S1.X1' });
    const c = createAnthropicClassifier({ model: 'FIXTURE_MODEL', client: f.client });
    expect(await c(input)).toEqual({ level: 'A', recordId: 'S1.X1' });
    expect(f.calls[0].model).toBe('FIXTURE_MODEL');
    expect(JSON.parse((f.calls[0].messages as { content: string }[])[0].content)).toEqual({ station: 'S1', question: 'FIXTURE question', candidates: input.candidates });
  });

  it('unknown IDs, bad levels, refusals and errors become null (the router falls back)', async () => {
    expect(await createAnthropicClassifier({ model: 'm', client: fakeClient({ level: 'A', recordId: 'S1.NOPE' }).client })(input)).toBeNull();
    expect(await createAnthropicClassifier({ model: 'm', client: fakeClient({ level: 'Z', recordId: null }).client })(input)).toBeNull();
    expect(await createAnthropicClassifier({ model: 'm', client: fakeClient({ level: 'A', recordId: 'S1.X1' }, { stop_reason: 'refusal' }).client })(input)).toBeNull();
    const throwing = { messages: { parse: async () => { throw new Error('network'); } } };
    expect(await createAnthropicClassifier({ model: 'm', client: throwing })(input)).toBeNull();
  });

  it('C, D and out-of-scope never carry a record ID', () => {
    expect(validateClassifierOutput({ level: 'C', recordId: 'S1.X1' }, input)).toEqual({ level: 'C', recordId: null });
  });

  it('is configured from env only (no hard-coded model)', () => {
    expect(classifierFromEnv({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(classifierFromEnv({ LLM_PROVIDER: 'anthropic' } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(typeof classifierFromEnv({ LLM_PROVIDER: 'anthropic', LLM_MODEL: 'FIXTURE_MODEL', ANTHROPIC_API_KEY: 'FIXTURE' } as unknown as NodeJS.ProcessEnv)).toBe('function');
  });
});

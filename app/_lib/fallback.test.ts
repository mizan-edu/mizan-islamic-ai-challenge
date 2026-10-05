// Provider chain (A4, D42): primary (Anthropic, 8 s) -> secondary (OpenAI, 6 s) -> static tier.
// Providers are stand-ins (no network); fixture strings only; never prints record or input text.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildUserMessage, classifierFromEnv, createChainClassifier, forcePrimaryFail, openaiProvider, PRIMARY_TIMEOUT_MS,
  SECONDARY_TIMEOUT_MS, SYSTEM_PROMPT, type ClassifierInput, type Provider,
} from './classifier';
import { EventError, makeEvent } from './events';
import { answerQuestion } from './pipeline';
import { item, libraryWithoutRules } from './test-helpers';
import { answerWithTrace, isSafeTrace } from './trace';
import { ASK_TIMEOUT_MS } from '@/app/_components/StationFlow';

const lib = libraryWithoutRules(); // no rules: the question reaches the classifier
const QUESTION = item('D02').input.text;
const input: ClassifierInput = { stationId: 'S1', question: 'FIXTURE question', candidates: [{ id: 'S1.X1', type: 'answer', level: 'A' }] };

const hang: Provider['call'] = (_i, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
const fail: Provider['call'] = async () => { throw new Error('FIXTURE http 500'); };
const ok = (out: unknown): Provider['call'] => async () => out;
const primary = (call: Provider['call']): Provider => ({ name: 'anthropic', model: 'FIXTURE-PRIMARY', timeoutMs: PRIMARY_TIMEOUT_MS, call });
const secondary = (call: Provider['call']): Provider => ({ name: 'openai', model: 'FIXTURE-SECONDARY', timeoutMs: SECONDARY_TIMEOUT_MS, call });

afterEach(() => { vi.useRealTimers(); });

describe('provider chain', () => {
  it('primary valid: used, no fallback', async () => {
    const c = createChainClassifier({ primary: primary(ok({ level: 'A', recordId: 'S1.X1' })), secondary: secondary(fail) });
    expect(await c.withOutcome!(input)).toEqual({ output: { level: 'A', recordId: 'S1.X1' }, outcome: { tier: 'primary', reason: null, provider: 'anthropic', model: 'FIXTURE-PRIMARY' } });
  });

  it('primary timeout (8 s) -> secondary used', async () => {
    vi.useFakeTimers();
    const sec = vi.fn(ok({ level: 'B', recordId: 'S1.X1' }));
    const c = createChainClassifier({ primary: primary(hang), secondary: secondary(sec) });
    const p = c.withOutcome!(input);
    await vi.advanceTimersByTimeAsync(PRIMARY_TIMEOUT_MS - 1);
    expect(sec).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({ output: { level: 'B', recordId: 'S1.X1' }, outcome: { tier: 'secondary', reason: 'timeout', provider: 'openai', model: 'FIXTURE-SECONDARY' } });
  });

  it('primary error + secondary error -> static', async () => {
    const c = createChainClassifier({ primary: primary(fail), secondary: secondary(fail) });
    expect(await c.withOutcome!(input)).toEqual({ output: null, outcome: { tier: 'static', reason: 'http_error', provider: null, model: null } });
  });

  it('secondary returning an unknown record ID or a bad level is blocked exactly as for the primary', async () => {
    for (const bad of [{ level: 'A', recordId: 'S1.UNKNOWN' }, { level: 'Z', recordId: null }, 'free text', undefined]) {
      const c = createChainClassifier({ primary: primary(fail), secondary: secondary(ok(bad)) });
      expect(await c.withOutcome!(input)).toEqual({ output: null, outcome: { tier: 'static', reason: 'invalid_output', provider: null, model: null } });
      const p = createChainClassifier({ primary: primary(ok(bad)) });
      expect(await p(input)).toBeNull();
    }
  });

  it('a primary refusal goes straight to the static tier (the secondary is not asked)', async () => {
    const { REFUSED } = await import('./classifier');
    const sec = vi.fn(ok({ level: 'A', recordId: 'S1.X1' }));
    const c = createChainClassifier({ primary: primary(async () => REFUSED), secondary: secondary(sec) });
    expect((await c.withOutcome!(input)).outcome).toEqual({ tier: 'static', reason: 'invalid_output', provider: null, model: null });
    expect(sec).not.toHaveBeenCalled();
  });

  it('the child path never waits more than 15 s: both providers hang -> static at 8 + 6 = 14 s', async () => {
    vi.useFakeTimers();
    const c = createChainClassifier({ primary: primary(hang), secondary: secondary(hang) });
    let done = false;
    const p = c.withOutcome!(input).then((r) => { done = true; return r; });
    await vi.advanceTimersByTimeAsync(PRIMARY_TIMEOUT_MS + SECONDARY_TIMEOUT_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await p).outcome).toEqual({ tier: 'static', reason: 'timeout', provider: null, model: null });
    expect(PRIMARY_TIMEOUT_MS + SECONDARY_TIMEOUT_MS).toBeLessThan(15000);
    expect(ASK_TIMEOUT_MS).toBe(15000); // the client gives up at 15 s whatever the server does
  });
});

describe('pipeline, events and trace with the chain', () => {
  const now = () => 1700000000;

  it('static tier: the station fallback, one llm_fallback event (tier, reason only), trace fallback:static', async () => {
    const c = createChainClassifier({ primary: primary(fail), secondary: secondary(fail) });
    const res = await answerWithTrace(lib, { stationId: 'S1', text: QUESTION }, { classifier: c, now });
    expect(res.reply.behaviour).toBe('fallback');
    expect(res.reply.citations).toEqual(['S1.FB1']);
    expect(res.llmEvent).toEqual({ stationId: 'S1', event: 'llm_fallback', tier: 'static', reason: 'http_error', t: 1700000000 });
    expect(res.trace.route).toMatchObject({ type: 'fallback:static', fallbackReason: 'http_error' });
    expect(res.trace).toMatchObject({ provider: 'static', model: 'none', classifierLevel: null });
    expect(isSafeTrace(res.trace)).toBe(true);
  });

  it('secondary tier: its output is used through the same router and validator; trace names the provider and model', async () => {
    const pick: Provider['call'] = async (ci) => ({ level: 'A', recordId: ci.candidates.find((x) => x.type === 'answer' || x.type === 'explanation')?.id ?? null });
    const c = createChainClassifier({ primary: primary(fail), secondary: secondary(pick) });
    const res = await answerWithTrace(lib, { stationId: 'S1', text: QUESTION }, { classifier: c, now });
    expect(res.validation.ok).toBe(true);
    expect(res.llm).toEqual({ tier: 'secondary', reason: 'http_error', provider: 'openai', model: 'FIXTURE-SECONDARY' });
    expect(res.llmEvent).toEqual({ stationId: 'S1', event: 'llm_fallback', tier: 'secondary', reason: 'http_error', t: 1700000000 });
    expect(res.trace.route.type).toBe('fallback:secondary');
    expect(res.trace).toMatchObject({ provider: 'openai', model: 'FIXTURE-SECONDARY', classifierLevel: 'A' });
  });

  it('as shipped (D44: primary only, no secondary): a primary error or timeout shows fallback:static in the judge trace', async () => {
    const env = { LLM_PROVIDER: 'anthropic', LLM_MODEL: 'FIXTURE-PRIMARY', ANTHROPIC_API_KEY: 'FIXTURE', OPENAI_API_KEY: 'FIXTURE' } as unknown as NodeJS.ProcessEnv;
    expect(classifierFromEnv(env)).not.toBeNull(); // no LLM_FALLBACK_MODEL: the OpenAI secondary stays off
    const res = await answerWithTrace(lib, { stationId: 'S1', text: QUESTION }, { classifier: createChainClassifier({ primary: primary(fail) }), now });
    expect(res.llm).toEqual({ tier: 'static', reason: 'http_error', provider: null, model: null });
    expect(res.trace.route).toMatchObject({ type: 'fallback:static', fallbackReason: 'http_error' });
    expect(res.trace).toMatchObject({ provider: 'static', model: 'none' });
    expect(res.reply.citations).toEqual(['S1.FB1']);
    expect(res.llmEvent).toEqual({ stationId: 'S1', event: 'llm_fallback', tier: 'static', reason: 'http_error', t: 1700000000 });

    vi.useFakeTimers();
    const p = answerWithTrace(lib, { stationId: 'S1', text: QUESTION }, { classifier: createChainClassifier({ primary: primary(hang) }), now });
    await vi.advanceTimersByTimeAsync(PRIMARY_TIMEOUT_MS);
    const timed = await p;
    expect(timed.trace.route).toMatchObject({ type: 'fallback:static', fallbackReason: 'timeout' });
  });

  it('primary tier: no llm_fallback event; trace keeps model_classifier with the primary provider', async () => {
    const res = await answerWithTrace(lib, { stationId: 'S1', text: QUESTION }, { classifier: createChainClassifier({ primary: primary(ok({ level: 'C', recordId: null })) }), now });
    expect(res.llmEvent).toBeNull();
    expect(res.trace.route.type).toBe('model_classifier');
    expect(res.trace).toMatchObject({ provider: 'anthropic', model: 'FIXTURE-PRIMARY' });
  });

  it('llm_fallback events carry no text: fixed fields, fixed values', async () => {
    const res = await answerQuestion(lib, { stationId: 'S1', text: QUESTION }, { classifier: createChainClassifier({ primary: primary(fail), secondary: secondary(fail) }), now });
    expect(Object.keys(res.llmEvent!).sort()).toEqual(['event', 'reason', 'stationId', 't', 'tier']);
    expect(JSON.stringify(res.llmEvent)).not.toContain(QUESTION);
    const base = { stationId: 'S1', event: 'llm_fallback', tier: 'static', reason: 'timeout', t: 1 };
    expect(makeEvent(base)).toEqual(base);
    for (const extra of [{ text: 'FIXTURE' }, { model: 'FIXTURE' }, { provider: 'openai' }, { sourceIds: [] }]) expect(() => makeEvent({ ...base, ...extra })).toThrow(EventError);
    expect(() => makeEvent({ ...base, tier: 'primary' })).toThrow(EventError);
    expect(() => makeEvent({ ...base, reason: 'FIXTURE free text' })).toThrow(EventError);
  });
});

describe('OpenAI provider (fetch stand-in)', () => {
  const reply = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('sends the same prompt and question payload as the primary, with a strict JSON schema (level + recordId)', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return reply({ choices: [{ message: { content: '{"level":"A","recordId":"S1.X1"}' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } })(); }) as unknown as typeof fetch;
    const seen: unknown[] = [];
    const c = createChainClassifier({ secondary: openaiProvider({ model: 'FIXTURE-SECONDARY', apiKey: 'FIXTURE_KEY', fetchImpl, observe: (x) => seen.push(x) }) });
    expect(await c(input)).toEqual({ level: 'A', recordId: 'S1.X1' });
    const body = JSON.parse(String(calls[0].init.body));
    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions');
    expect(body.messages).toEqual([{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: buildUserMessage(input) }]);
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(Object.keys(body.response_format.json_schema.schema.properties)).toEqual(['level', 'recordId']);
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
    expect(seen[0]).toMatchObject({ model: 'FIXTURE-SECONDARY', inputTokens: 10, outputTokens: 5, error: null });
  });

  it('HTTP errors, refusals and non-JSON content never reach the child', async () => {
    const cases: [typeof fetch, string][] = [
      [reply({ error: { code: 'x' } }, 429) as unknown as typeof fetch, 'http_error'],
      [reply({ choices: [{ message: { content: null, refusal: 'FIXTURE refusal' } }] }) as unknown as typeof fetch, 'invalid_output'],
      [reply({ choices: [{ message: { content: 'FIXTURE free text' } }] }) as unknown as typeof fetch, 'invalid_output'],
    ];
    for (const [fetchImpl, reason] of cases) {
      const c = createChainClassifier({ secondary: openaiProvider({ model: 'm', apiKey: 'k', fetchImpl }) });
      expect(await c.withOutcome!(input)).toEqual({ output: null, outcome: { tier: 'static', reason, provider: null, model: null } });
    }
  });
});

describe('configuration from env', () => {
  const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;
  it('the secondary needs both OPENAI_API_KEY and LLM_FALLBACK_MODEL (no hard-coded model)', () => {
    expect(classifierFromEnv(env({ OPENAI_API_KEY: 'k' }))).toBeNull();
    expect(classifierFromEnv(env({ LLM_FALLBACK_MODEL: 'm' }))).toBeNull();
    expect(typeof classifierFromEnv(env({ OPENAI_API_KEY: 'k', LLM_FALLBACK_MODEL: 'm' }))).toBe('function');
  });

  it('FORCE_PRIMARY_FAIL works locally only, never on Vercel', () => {
    expect(forcePrimaryFail(env({ FORCE_PRIMARY_FAIL: '1' }))).toBe(true);
    expect(forcePrimaryFail(env({ FORCE_PRIMARY_FAIL: '1', VERCEL: '1' }))).toBe(false);
    expect(forcePrimaryFail(env({}))).toBe(false);
  });
});

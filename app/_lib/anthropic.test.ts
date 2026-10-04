// Workspace header for Console user keys: the SDK is mocked; no network, fixture values only.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const created: Record<string, unknown>[] = [];
const parse = vi.fn(async () => ({ parsed_output: { level: 'C', recordId: null }, stop_reason: 'end_turn' }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class FakeAnthropic {
    messages = { parse };
    constructor(opts: Record<string, unknown>) { created.push(opts); }
  },
}));

const { WORKSPACE_HEADER, createAnthropicClient, workspaceHeaders } = await import('./anthropic');
const { classifierFromEnv } = await import('./classifier');
const { rephraserFromEnv } = await import('./rephraser');

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;
const WS = 'wrkspc_FIXTURE0000000000000000';

beforeEach(() => { created.length = 0; parse.mockClear(); });

describe('anthropic-workspace-id header', () => {
  it('is derived from ANTHROPIC_WORKSPACE_ID only when it is set and non-empty', () => {
    expect(workspaceHeaders(env({ ANTHROPIC_WORKSPACE_ID: WS }))).toEqual({ [WORKSPACE_HEADER]: WS });
    expect(workspaceHeaders(env({ ANTHROPIC_WORKSPACE_ID: `  ${WS}  ` }))).toEqual({ [WORKSPACE_HEADER]: WS });
    expect(workspaceHeaders(env({}))).toBeUndefined();
    expect(workspaceHeaders(env({ ANTHROPIC_WORKSPACE_ID: '   ' }))).toBeUndefined();
  });

  it('is set as a default header on the client, so every call carries it', () => {
    createAnthropicClient(env({ ANTHROPIC_API_KEY: 'FIXTURE_KEY', ANTHROPIC_WORKSPACE_ID: WS }));
    expect(created[0]).toEqual({ apiKey: 'FIXTURE_KEY', defaultHeaders: { 'anthropic-workspace-id': WS } });
  });

  it('is omitted for workspace-scoped keys (no ANTHROPIC_WORKSPACE_ID)', () => {
    createAnthropicClient(env({ ANTHROPIC_API_KEY: 'FIXTURE_KEY' }));
    expect(created[0]).toEqual({ apiKey: 'FIXTURE_KEY' });
    expect(created[0]).not.toHaveProperty('defaultHeaders');
  });

  it('the classifier from env uses a client with the header and calls through it', async () => {
    const c = classifierFromEnv(env({ LLM_PROVIDER: 'anthropic', LLM_MODEL: 'FIXTURE_MODEL', ANTHROPIC_API_KEY: 'FIXTURE_KEY', ANTHROPIC_WORKSPACE_ID: WS }))!;
    expect(created).toHaveLength(1);
    expect(created[0].defaultHeaders).toEqual({ 'anthropic-workspace-id': WS });
    const out = await c({ stationId: 'S1', question: 'FIXTURE', candidates: [] });
    expect(out).toEqual({ level: 'C', recordId: null });
    expect(parse).toHaveBeenCalledOnce();
    expect((parse.mock.calls[0] as unknown as [Record<string, unknown>])[0].model).toBe('FIXTURE_MODEL');
  });

  it('the rephraser from env uses a client with the header', async () => {
    parse.mockResolvedValueOnce({ parsed_output: { text: 'FIXTURE_LINE' }, stop_reason: 'end_turn' } as never);
    const r = rephraserFromEnv(env({ LLM_PROVIDER: 'anthropic', LLM_MODEL: 'FIXTURE_MODEL', LLM_REPHRASE: 'on', ANTHROPIC_API_KEY: 'FIXTURE_KEY', ANTHROPIC_WORKSPACE_ID: WS }))!;
    expect(created[0].defaultHeaders).toEqual({ 'anthropic-workspace-id': WS });
    expect(await r('FIXTURE', { recordId: 'S1.X2' })).toBe('FIXTURE_LINE');
  });

  it('no client is created when the provider or model is not configured', () => {
    expect(classifierFromEnv(env({ ANTHROPIC_WORKSPACE_ID: WS }))).toBeNull();
    expect(rephraserFromEnv(env({ LLM_PROVIDER: 'anthropic', LLM_MODEL: 'm' }))).toBeNull(); // rephrasing is opt-in
    expect(created).toHaveLength(0);
  });
});

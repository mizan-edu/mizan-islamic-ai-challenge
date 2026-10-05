// Glass-box view (D60): the seven pipeline steps of one reply, built only from the real judge trace
// that /api/try or /api/ask?judge=1 returned. A step is "decided" when the trace shows it decided the
// reply, "passed" when it ran and handed on (the fixed rules found no match), and "skipped" when the
// trace shows it did not run (no model call). Nothing is inferred beyond the trace: the classifier is
// lit only when a model call is recorded. Tones: ok, neutral, or amber for the restricted paths
// (levels C, D and OUT_OF_SCOPE; referral and fallback replies; a fallback tier; a blocked reply);
// never red. Values are IDs, codes and numbers only: never record text, never the typed question.
// Client-safe (type imports only).

import type { RecordSource } from './station-view';
import type { Trace } from './trace';

export const GLASS_STEPS = ['question', 'rules', 'classifier', 'level', 'library', 'validator', 'output'] as const;
export type GlassStep = (typeof GLASS_STEPS)[number];
export type GlassStatus = 'decided' | 'passed' | 'skipped';
export type GlassTone = 'ok' | 'neutral' | 'amber';
export type GlassKey =
  | 'input' | 'station' | 'route' | 'rules' | 'model' | 'latency' | 'tokens' | 'result' | 'fallback'
  | 'level' | 'classifierLevel' | 'floor' | 'category' | 'records' | 'sources' | 'validator' | 'verses' | 'behaviour';
export interface GlassField { key: GlassKey; value: string }
export interface GlassNode { step: GlassStep; status: GlassStatus; tone: GlassTone; fields: GlassField[] }

// What was asked, as IDs only: a test-set item, a typed question (its length only) or a child's
// pre-written question.
export type GlassInput =
  | { kind: 'preset'; itemId: string; category: string; stationId: string | null }
  | { kind: 'typed'; chars: number; stationId: string }
  | { kind: 'child'; questionId: string; stationId: string };

// Minimum time each step is shown during the replay (D60: at least 400 ms per node).
export const REPLAY_MS = 450;

const DECIDING_ROUTES = new Set(['rule', 'anticipated_question', 'verse_match']);
const RESTRICTED_LEVELS = new Set(['C', 'D', 'OUT_OF_SCOPE']);
const AMBER_BEHAVIOURS = new Set(['referral', 'fallback']);
const KFC = 'King Fahd Complex';

const f = (key: GlassKey, value: string | number | null | undefined): GlassField[] =>
  value === null || value === undefined || value === '' ? [] : [{ key, value: String(value) }];

export function pipelineFromTrace(trace: Trace, input: GlassInput, sources: Record<string, RecordSource>): GlassNode[] {
  const r = trace.route;
  const calls = trace.modelCalls ?? [];
  const modelCalled = calls.length > 0;
  const restrictedOutput = AMBER_BEHAVIOURS.has(trace.behaviour);

  const question: GlassNode = {
    step: 'question', status: 'decided', tone: 'neutral',
    fields: [
      ...f('input', input.kind === 'preset' ? `preset ${input.itemId}` : input.kind === 'typed' ? `typed · ${input.chars} chars` : `child ${input.questionId}`),
      ...f('station', input.stationId ?? '—'),
    ],
  };

  const decidedByRules = DECIDING_ROUTES.has(r.type);
  const rules: GlassNode = decidedByRules
    ? {
      step: 'rules', status: 'decided', tone: 'ok',
      fields: [...f('route', `${r.type} · ${r.code}`), ...f('rules', [...r.ruleIds, r.questionId, r.verseId].filter(Boolean).join(' · '))],
    }
    : { step: 'rules', status: 'passed', tone: 'neutral', fields: f('route', 'no match') };

  const fallbackTier = r.type.startsWith('fallback:') ? r.type.slice('fallback:'.length) : null;
  const classifier: GlassNode = modelCalled
    ? {
      step: 'classifier', status: 'decided', tone: fallbackTier ? 'amber' : 'ok',
      fields: [
        ...f('model', calls.map((c) => `${c.provider} · ${c.model}`).join(' | ')),
        ...f('latency', calls.map((c) => `${c.ms} ms`).join(' | ')),
        ...f('tokens', calls.map((c) => `${c.inputTokens ?? '–'} / ${c.outputTokens ?? '–'}`).join(' | ')),
        ...f('result', calls.map((c) => c.result).join(' | ')),
        ...f('fallback', fallbackTier ? `${fallbackTier} · ${r.fallbackReason ?? ''}`.trim() : 'no'),
      ],
    }
    : { step: 'classifier', status: 'skipped', tone: 'neutral', fields: [] };

  const level: GlassNode = {
    step: 'level', status: 'decided', tone: RESTRICTED_LEVELS.has(trace.level) ? 'amber' : 'ok',
    fields: [
      ...f('level', trace.level),
      ...f('classifierLevel', trace.classifierLevel),
      ...f('floor', r.code.includes('LEVEL_FLOOR') ? 'LEVEL_FLOOR' : null),
      ...f('category', input.kind === 'preset' ? input.category : null),
    ],
  };

  const cited = trace.cited;
  const platformIds = cited.map((id) => sources[id]).filter((s) => s?.platform && s.platformId);
  const library: GlassNode = {
    step: 'library', status: 'decided', tone: restrictedOutput ? 'amber' : 'ok',
    fields: [
      ...f('records', cited.join(' · ')),
      ...f('sources', cited.filter((id) => sources[id]?.platformId).map((id) => `${id} ${sources[id].platformId}`).join(' · ') || (platformIds.length ? null : 'MIZAN library')),
    ],
  };

  const verses = cited.filter((id) => sources[id]?.platform === KFC);
  const v = trace.validator;
  const validator: GlassNode = {
    step: 'validator', status: 'decided', tone: v.result === 'pass' ? 'ok' : 'amber',
    fields: [
      ...f('validator', v.result === 'pass' ? 'pass' : `blocked · ${v.codes.join(' · ')}`),
      ...f('verses', verses.length ? verses.map((id) => `${id} ${sources[id].platformId}`).join(' · ') : 'no verse in reply'),
    ],
  };

  const output: GlassNode = {
    step: 'output', status: 'decided', tone: restrictedOutput ? 'amber' : 'ok',
    fields: [...f('behaviour', trace.behaviour), ...f('level', trace.level), ...f('latency', `${trace.latencyMs} ms`)],
  };

  return [question, rules, classifier, level, library, validator, output];
}

// Every string in the nodes is an ID, a code or a number (no Arabic, no free text).
const SAFE = /^[A-Za-z0-9_.:+\-—–|/·> ]{1,160}$/;
export const isSafePipeline = (nodes: GlassNode[]): boolean => nodes.every((n) => n.fields.every((x) => SAFE.test(x.value)));

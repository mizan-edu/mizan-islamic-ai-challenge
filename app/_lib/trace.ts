// Judge-mode trace (A1, Delta v1.3 D26): what the pipeline did for one turn, for adults judging the
// system. IDs, codes and numbers only: never record text and never the child's input text
// (CLAUDE.md §6). Built on the server and sent only when judge mode asks for it; nothing is stored.

import type { Classifier } from './classifier';
import { NO_MODEL_CALL } from './judge';
import type { RouteLevel } from './levels';
import type { Library } from './library';
import { containment, tokens } from './normalize';
import { answerQuestion, type PipelineDeps, type PipelineResult } from './pipeline';
import { AQ_MIN_SCORE, AQ_MIN_SHARED, retrieve, VERSE_MIN_SCORE, type Retrieval } from './retrieval';
import type { Behaviour, RouteInput, RouteResult } from './router';

export { NO_MODEL_CALL };

export type RouteType = 'rule' | 'anticipated_question' | 'verse_match' | 'model_classifier' | 'fallback';

export interface RetrievedRecord {
  id: string;
  kind: 'verse' | 'question' | 'candidate';
  score: number | null; // null: a verse on screen offered to the classifier (not scored)
  questionId?: string; // kind 'question': the anticipated question whose response is `id`
}

export interface Trace {
  route: { type: RouteType; code: string; ruleIds: string[]; questionId: string | null; verseId: string | null };
  behaviour: Behaviour;
  level: RouteLevel; // final level of the reply shown
  classifierLevel: RouteLevel | null; // the model's own level, when it was called and answered validly
  model: string; // model ID, or NO_MODEL_CALL
  retrieved: RetrievedRecord[];
  thresholds: { question: number; questionSharedWords: number; verse: number };
  cited: string[];
  validator: { result: 'pass' } | { result: 'blocked'; codes: string[] };
  latencyMs: number;
}

const ROUTE_TYPE: Record<RouteResult['source'], RouteType> = {
  rule: 'rule', aq: 'anticipated_question', verse: 'verse_match', model: 'model_classifier', none: 'fallback',
};

const round = (n: number) => Number(n.toFixed(2));

// Best verse and best anticipated question (with scores, even below threshold, so a judge can see
// how close they came), then the candidates offered to the classifier.
export function retrievedRecords(lib: Library, stationId: string | null, text: string, r: Retrieval): RetrievedRecord[] {
  const q = tokens(text);
  const out: RetrievedRecord[] = [];
  let verse: RetrievedRecord | null = null;
  for (const v of lib.verses) {
    const score = containment(q, tokens(v.text)).score;
    if (score > 0 && (!verse || score > verse.score!)) verse = { id: v.id, kind: 'verse', score };
  }
  if (verse) out.push({ ...verse, score: round(verse.score!) });
  const station = stationId ? lib.stations.get(stationId) : undefined;
  let aq: RetrievedRecord | null = null;
  for (const a of station?.anticipatedQuestions ?? []) {
    const score = containment(q, tokens(a.childQuestion)).score;
    if (score > 0 && (!aq || score > aq.score!)) aq = { id: a.responseRecordId, kind: 'question', score, questionId: a.id };
  }
  if (aq) out.push({ ...aq, score: round(aq.score!) });
  for (const c of r.candidates) out.push({ id: c.id, kind: 'candidate', score: c.type === 'quran' ? null : round(containment(q, tokens(c.text)).score) });
  return out;
}

export interface TraceParts {
  result: PipelineResult;
  retrieval: Retrieval;
  retrieved: RetrievedRecord[];
  classifier: { called: boolean; level: RouteLevel | null };
  modelId: string | null;
  latencyMs: number;
}

export function buildTrace({ result, retrieval, retrieved, classifier, modelId, latencyMs }: TraceParts): Trace {
  const { route, reply, validation } = result;
  return {
    route: {
      type: ROUTE_TYPE[route.source],
      code: route.code,
      ruleIds: route.ruleIds,
      questionId: route.source === 'aq' ? retrieval.aq?.question.id ?? null : null,
      verseId: route.source === 'verse' ? route.recordId : null,
    },
    behaviour: reply.behaviour,
    level: reply.level,
    classifierLevel: classifier.called ? classifier.level : null,
    model: classifier.called ? modelId ?? 'unknown' : NO_MODEL_CALL,
    retrieved,
    thresholds: { question: AQ_MIN_SCORE, questionSharedWords: AQ_MIN_SHARED, verse: VERSE_MIN_SCORE },
    cited: reply.citations,
    validator: validation.ok ? { result: 'pass' } : { result: 'blocked', codes: validation.codes },
    latencyMs,
  };
}

// Every string in a trace is an ID, a code, a level or a model ID: Latin letters, digits and a few
// separators. Anything else (Arabic record text, a child's words) makes the trace unsafe to send.
const SAFE = /^[A-Za-z0-9_.:+\- ]{1,80}$/;
export function isSafeTrace(value: unknown): boolean {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return true;
  if (typeof value === 'string') return SAFE.test(value);
  if (Array.isArray(value)) return value.every(isSafeTrace);
  if (typeof value === 'object') return Object.entries(value).every(([k, v]) => SAFE.test(k) && isSafeTrace(v));
  return false;
}

export interface TracedResult extends PipelineResult { trace: Trace }

// The pipeline, unchanged, plus its trace. The classifier is wrapped only to see whether it was
// called and what level it returned; its output reaches the router exactly as before.
export async function answerWithTrace(lib: Library, input: RouteInput, deps: PipelineDeps & { modelId?: string | null } = {}): Promise<TracedResult> {
  const seen = { called: false, level: null as RouteLevel | null };
  const inner = deps.classifier ?? null;
  const classifier: Classifier | null = inner
    ? async (ci) => { seen.called = true; const out = await inner(ci); seen.level = out?.level ?? null; return out; }
    : null;
  const t0 = performance.now();
  const result = await answerQuestion(lib, input, { ...deps, classifier });
  const latencyMs = Math.round(performance.now() - t0);
  const retrieval = retrieve(lib, input.stationId, input.text, input.onScreen ?? []);
  const retrieved = retrievedRecords(lib, input.stationId, input.text, retrieval);
  return { ...result, trace: buildTrace({ result, retrieval, retrieved, classifier: seen, modelId: deps.modelId ?? null, latencyMs }) };
}

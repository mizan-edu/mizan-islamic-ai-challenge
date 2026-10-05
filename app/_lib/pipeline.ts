// Request flow (CLAUDE.md §5.1): route -> build reply from the library -> optional NA rephrasing
// -> citation validator -> (fallback on failure) -> one concept-level event.
// Provider chain (A4, D42): when the classifier is a chain, its outcome (tier, reason, provider, model)
// is kept, and a turn answered by the secondary provider or the static tier adds one llm_fallback event.

import type { Classifier, LlmOutcome } from './classifier';
import { eventForReply, llmFallbackEvent, type ConceptEvent, type LlmFallbackEvent } from './events';
import type { Library } from './library';
import { applyRephrase, buildReply, fallbackReply, type Rephraser, type Reply } from './reply';
import { route, type RouteInput, type RouteResult } from './router';
import { validateReply, type Validation } from './validator';

export interface PipelineDeps {
  classifier?: Classifier | null;
  rephraser?: Rephraser | null;
  now?: () => number; // seconds
}

export interface PipelineResult {
  route: RouteResult;
  reply: Reply;
  validation: Validation; // of the reply that was built (before any fallback)
  event: ConceptEvent | null; // null when there is no station to attribute the event to
  llm: LlmOutcome | null; // set when a provider chain classified this turn
  llmEvent: LlmFallbackEvent | null; // secondary or static tier only
}

// Wraps a chain classifier so its outcome is captured; a plain classifier passes through unchanged.
function capturing(classifier: Classifier | null, sink: { llm: LlmOutcome | null }): Classifier | null {
  if (!classifier?.withOutcome) return classifier;
  const withOutcome = classifier.withOutcome;
  const wrapped = (async (input) => {
    const r = await withOutcome(input);
    sink.llm = r.outcome;
    return r.output;
  }) as Classifier;
  return wrapped;
}

export async function answerQuestion(lib: Library, input: RouteInput, deps: PipelineDeps = {}): Promise<PipelineResult> {
  const sink: { llm: LlmOutcome | null } = { llm: null };
  const routed = await route(lib, input, capturing(deps.classifier ?? null, sink));
  let reply = buildReply(lib, input.stationId, routed);
  if (deps.rephraser) reply = await applyRephrase(lib, reply, deps.rephraser);
  const validation = validateReply(lib, reply);
  if (!validation.ok) reply = fallbackReply(lib, input.stationId, reply.level);
  const now = deps.now ?? (() => Math.floor(Date.now() / 1000));
  const t = now();
  const event = input.stationId ? eventForReply(reply, input.stationId, t) : null;
  const { llm } = sink;
  const llmEvent = input.stationId && llm && llm.tier !== 'primary' && llm.reason
    ? llmFallbackEvent(input.stationId, llm.tier, llm.reason, t)
    : null;
  return { route: routed, reply, validation, event, llm, llmEvent };
}

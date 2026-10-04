// Request flow (CLAUDE.md §5.1): route -> build reply from the library -> optional NA rephrasing
// -> citation validator -> (fallback on failure) -> one concept-level event.

import type { Classifier } from './classifier';
import { eventForReply, type SessionEvent } from './events';
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
  event: SessionEvent | null; // null when there is no station to attribute the event to
}

export async function answerQuestion(lib: Library, input: RouteInput, deps: PipelineDeps = {}): Promise<PipelineResult> {
  const routed = await route(lib, input, deps.classifier ?? null);
  let reply = buildReply(lib, input.stationId, routed);
  if (deps.rephraser) reply = await applyRephrase(lib, reply, deps.rephraser);
  const validation = validateReply(lib, reply);
  if (!validation.ok) reply = fallbackReply(lib, input.stationId, reply.level);
  const now = deps.now ?? (() => Math.floor(Date.now() / 1000));
  const event = input.stationId ? eventForReply(reply, input.stationId, now()) : null;
  return { route: routed, reply, validation, event };
}

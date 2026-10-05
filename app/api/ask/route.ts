// POST /api/ask {stationId, questionId}: answers one of the station's approved anticipated questions
// through the pipeline. Children never type: the question is chosen by ID. The route stores and logs
// nothing about the request (R8); errors log the error type and route only.
// Judge mode (A1): POST /api/ask?judge=1 adds a per-turn trace (IDs and codes only, never text); the
// default response is unchanged. The trace is checked before sending and never stored.

import { classifierFromEnv } from '@/app/_lib/classifier';
import { loadLibrary } from '@/app/_lib/library';
import { fallbackReply } from '@/app/_lib/reply';
import { AQ_MIN_SCORE, AQ_MIN_SHARED, VERSE_MIN_SCORE } from '@/app/_lib/retrieval';
import { replyView } from '@/app/_lib/reply-view';
import { answerWithTrace, isSafeTrace, NO_MODEL_CALL, type Trace } from '@/app/_lib/trace';

export const dynamic = 'force-dynamic';
// The provider chain takes at most 8 s + 6 s (A4, D42); leave room above it.
export const maxDuration = 20;

const ID = /^S\d+(\.[A-Za-z0-9-]+)*$/;

function respond(lib: ReturnType<typeof loadLibrary>, reply: ReturnType<typeof fallbackReply>, event: unknown, trace?: Trace | null, llmEvent?: unknown) {
  return Response.json({
    ...replyView(lib, reply),
    event,
    ...(llmEvent ? { llmEvent } : {}), // A4: only when the secondary provider or the static tier answered
    ...(trace !== undefined ? { trace: trace && isSafeTrace(trace) ? trace : null } : {}),
  });
}

// Trace for a turn the pipeline could not complete: the safe fallback was shown.
function errorTrace(reply: ReturnType<typeof fallbackReply>): Trace {
  return {
    route: { type: 'fallback', code: 'PIPELINE_ERROR', fallbackReason: null, ruleIds: [], questionId: null, verseId: null },
    behaviour: reply.behaviour, level: reply.level, classifierLevel: null, provider: null, model: NO_MODEL_CALL, retrieved: [],
    thresholds: { question: AQ_MIN_SCORE, questionSharedWords: AQ_MIN_SHARED, verse: VERSE_MIN_SCORE }, cited: reply.citations, validator: { result: 'pass' }, latencyMs: 0,
  };
}

export async function POST(request: Request): Promise<Response> {
  const lib = loadLibrary();
  let stationId: string | null = null;
  const judge = new URL(request.url).searchParams.get('judge') === '1';
  try {
    const body = (await request.json()) as { stationId?: unknown; questionId?: unknown };
    if (typeof body.stationId !== 'string' || !ID.test(body.stationId) || typeof body.questionId !== 'string' || !ID.test(body.questionId)) {
      return Response.json({ error: 'bad request' }, { status: 400 });
    }
    stationId = body.stationId;
    const station = lib.stations.get(stationId);
    const aq = station?.anticipatedQuestions.find((q) => q.id === body.questionId);
    if (!station || !aq) return Response.json({ error: 'not found' }, { status: 404 });
    const res = await answerWithTrace(lib, { stationId, text: aq.childQuestion }, { classifier: classifierFromEnv(), modelId: process.env.LLM_MODEL ?? null });
    return respond(lib, res.reply, res.event, judge ? res.trace : undefined, res.llmEvent);
  } catch (e) {
    console.error('api/ask', e instanceof Error ? e.name : 'error');
    const reply = fallbackReply(lib, stationId);
    return respond(lib, reply, null, judge ? errorTrace(reply) : undefined);
  }
}

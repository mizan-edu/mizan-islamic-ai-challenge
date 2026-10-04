// POST /api/ask {stationId, questionId}: answers one of the station's approved anticipated questions
// through the pipeline. Children never type: the question is chosen by ID. The route stores and logs
// nothing about the request (R8); errors log the error type and route only.

import { classifierFromEnv } from '@/app/_lib/classifier';
import { loadLibrary } from '@/app/_lib/library';
import { answerQuestion } from '@/app/_lib/pipeline';
import { fallbackReply } from '@/app/_lib/reply';
import { toVerseView, type VerseView } from '@/app/_lib/station-view';

export const dynamic = 'force-dynamic';

const ID = /^S\d+(\.[A-Za-z0-9-]+)*$/;

function respond(lib: ReturnType<typeof loadLibrary>, reply: ReturnType<typeof fallbackReply>, event: unknown) {
  const verses: VerseView[] = reply.segments
    .filter((s) => s.kind === 'verse')
    .map((s) => lib.byId.get(s.recordId))
    .filter((r) => r?.type === 'quran')
    .map((r) => toVerseView(r!));
  return Response.json({
    behaviour: reply.behaviour,
    level: reply.level,
    segments: reply.segments.map((s) => ({ kind: s.kind, recordId: s.recordId, text: s.text })),
    verses,
    event,
  });
}

export async function POST(request: Request): Promise<Response> {
  const lib = loadLibrary();
  let stationId: string | null = null;
  try {
    const body = (await request.json()) as { stationId?: unknown; questionId?: unknown };
    if (typeof body.stationId !== 'string' || !ID.test(body.stationId) || typeof body.questionId !== 'string' || !ID.test(body.questionId)) {
      return Response.json({ error: 'bad request' }, { status: 400 });
    }
    stationId = body.stationId;
    const station = lib.stations.get(stationId);
    const aq = station?.anticipatedQuestions.find((q) => q.id === body.questionId);
    if (!station || !aq) return Response.json({ error: 'not found' }, { status: 404 });
    const res = await answerQuestion(lib, { stationId, text: aq.childQuestion }, { classifier: classifierFromEnv() });
    return respond(lib, res.reply, res.event);
  } catch (e) {
    console.error('api/ask', e instanceof Error ? e.name : 'error');
    return respond(lib, fallbackReply(lib, stationId), null);
  }
}

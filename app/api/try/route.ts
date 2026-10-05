// POST /api/try — «جرّب سؤالًا» on the evaluation page (Runbook 3.7, D45). Adults only.
// Body: { stationId, itemId } (an active test item) or { stationId, text } (a typed question, at most
// 120 characters). The reply goes through the same pipeline as the child's /api/ask and comes back
// exactly as a child would see it, with the judge trace. Typed text is never stored, logged or echoed;
// no session event is returned. Errors log the error type and route only (R8).

import testset from '@/eval/testset.json';
import { classifierFromEnv } from '@/app/_lib/classifier';
import { loadLibrary } from '@/app/_lib/library';
import { replyView } from '@/app/_lib/reply-view';
import { answerWithTrace, isSafeTrace } from '@/app/_lib/trace';
import { dailyCap, MAX_CHARS, tryLimits as limits } from '@/app/_lib/try-limits';

export const dynamic = 'force-dynamic';
export const maxDuration = 20; // provider chain at most 14 s (A4)

const STATION = /^S\d+$/;
const ITEM = /^[A-G]\d{2}$/;
// Control and bidi-override characters are removed before matching; the text is never kept.
const CONTROL = /[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

interface Item { id: string; status: string; input: { stationId: string | null; text: string; mutation?: unknown } }
const ITEMS = new Map((testset as { items: Item[] }).items
  .filter((i) => i.status === 'approved' && !i.input.mutation && !/^\[GENERATED AT RUNTIME/.test(i.input.text))
  .map((i) => [i.id, i]));

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { stationId?: unknown; itemId?: unknown; text?: unknown };
    if (typeof body.stationId !== 'string' || !STATION.test(body.stationId)) return fail('bad request', 400);
    const lib = loadLibrary();
    if (!lib.stations.has(body.stationId)) return fail('not found', 404);

    let stationId: string | null = body.stationId;
    let text: string;
    const typed = body.itemId === undefined;
    if (!typed) {
      const item = typeof body.itemId === 'string' && ITEM.test(body.itemId) ? ITEMS.get(body.itemId) : undefined;
      if (!item) return fail('not found', 404);
      stationId = item.input.stationId; // exactly as in the evaluation runs
      text = item.input.text;
    } else {
      if (typeof body.text !== 'string') return fail('bad request', 400);
      text = body.text.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim();
      if (!text || [...text].length > MAX_CHARS) return fail('bad request', 400);
    }

    const visitor = limits.visitor(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null);
    if (!limits.allowMinute(visitor)) return fail('rate_limited', 429);
    if (typed && !limits.allowTyped(dailyCap())) return fail('daily_cap', 429);

    const res = await answerWithTrace(lib, { stationId, text }, { classifier: classifierFromEnv(), modelId: process.env.LLM_MODEL ?? null });
    return Response.json({ ...replyView(lib, res.reply), trace: isSafeTrace(res.trace) ? res.trace : null });
  } catch (e) {
    console.error('api/try', e instanceof Error ? e.name : 'error');
    return fail('error', 500);
  }
}

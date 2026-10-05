// Parent Ask (D54, Phase 3): behind the parental gate on /parent; sends only { stationId, text } to the
// unchanged /api/try; shows the approved reply with behaviour, level, decision kind and source chips;
// keeps the typed text in component state only. Replies are built through the real pipeline from
// approved questions. Never prints record text.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { loadLabels } from '@/app/_lib/labels';
import { replyView } from '@/app/_lib/reply-view';
import { buildStationView } from '@/app/_lib/station-view';
import { runtimeLibrary } from '@/app/_lib/test-helpers';
import { answerWithTrace } from '@/app/_lib/trace';
import ParentAsk, { askBody, type ParentAskResult } from './ParentAsk';
import { PARENT_ASK } from './text';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const lib = runtimeLibrary();
const labels = loadLabels();
const views = ['S1', 'S2', 'S3'].map((s) => buildStationView(lib, s, () => false)!);
const sources = Object.assign({}, ...views.map((v) => v.sources));
const stations = views.map((v) => ({ id: v.stationId, title: v.stationId }));

async function result(stationId: string, text: string): Promise<ParentAskResult> {
  const res = await answerWithTrace(lib, { stationId, text });
  return { ...replyView(lib, res.reply), trace: res.trace };
}
const render = (r: ParentAskResult | null, judge = false) =>
  renderToString(<ParentAsk stations={stations} sources={sources} labels={labels} maxChars={120} initialResult={r} initialJudge={judge} />);

describe('Parent Ask', () => {
  it('sends only the station and the question text', () => {
    expect(askBody('S1', 'FIXTURE')).toEqual({ stationId: 'S1', text: 'FIXTURE' });
    const src = readFileSync(path.join(ROOT, 'app', 'parent', 'ParentAsk.tsx'), 'utf8');
    expect(src).toContain("fetch('/api/try'");
    expect(src).toContain('JSON.stringify(askBody(station, typed))');
  });

  it('keeps the typed text in component state only: no storage, no session events, no logging', () => {
    const src = readFileSync(path.join(ROOT, 'app', 'parent', 'ParentAsk.tsx'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/sessionStorage|localStorage|indexedDB|document\.cookie|addEvents|console\./);
  });

  it('a reply with a verse: the reply card, then behaviour, level, decision kind and source chips (KFC platform ID for the verse)', async () => {
    const aq = lib.stations.get('S1')!.anticipatedQuestions.find((q) => lib.byId.get(q.responseRecordId)?.type === 'answer')!;
    const r = await result('S1', aq.childQuestion);
    const html = render(r);
    expect(html).toContain('data-ask-reply');
    expect(html).toContain(`data-ask-behaviour="${r.behaviour}"`);
    expect(html).toContain(PARENT_ASK.behaviour[r.behaviour]);
    expect(html).toContain(`data-ask-level="${r.level}"`);
    expect(html).toContain('data-ask-kind="rule"'); // an approved question routes without a model call
    for (const id of r.trace!.cited) expect(html).toContain(`data-source-chip="${id}"`);
    for (const v of r.verses) {
      const chip = new RegExp(`data-source-chip="${v.id}"[\\s\\S]*?</li>`).exec(html)![0];
      expect(chip).toContain(String(lib.byId.get(v.id)!.platformId));
    }
    // Nothing animates in the result: a verse card may be in it.
    const res = /<div[^>]*data-ask-result[\s\S]*$/.exec(html)![0];
    expect(res).not.toMatch(/anim-|transition/);
    expect(html).not.toContain('data-judge-panel');
  });

  it('a referral or fallback record is shown unchanged, with its level', async () => {
    const station = lib.stations.get('S1')!;
    const referral = station.anticipatedQuestions.find((q) => ['referral', 'fallback'].includes(lib.byId.get(q.responseRecordId)?.type ?? ''));
    const r = referral ? await result('S1', referral.childQuestion) : await result('S1', 'FIXTURE_UNMATCHED_QUESTION');
    expect(['referral', 'fallback']).toContain(r.behaviour);
    const html = render(r);
    expect(html).toContain(`data-ask-result="${r.behaviour}"`);
    for (const s of r.segments.filter((x) => x.kind === 'text')) expect(html).toContain(`data-line="${s.recordId}"`);
    expect(html).toContain(`data-ask-level="${r.level}"`);
  });

  it('with the AI lens on, the decision and the full trace follow the reply', async () => {
    const aq = lib.stations.get('S2')!.anticipatedQuestions[0];
    const html = render(await result('S2', aq.childQuestion), true);
    expect(html.match(/data-judge-panel/g)).toHaveLength(1);
    expect(html).toContain('data-lens-decision="rule"');
    expect(html).toContain('data-judge-trace');
  });

  it('sits behind the parental gate on /parent, with the lens switch', () => {
    const page = readFileSync(path.join(ROOT, 'app', 'parent', 'page.tsx'), 'utf8');
    expect(page).toMatch(/<ParentGate[^>]*>[\s\S]*<JudgeSwitch[\s\S]*<ParentAsk[\s\S]*<\/ParentGate>/);
  });

  it('draft wording: no Arabic-Indic digits, no Qur\'anic marks', () => {
    const all = JSON.stringify(PARENT_ASK);
    expect(all).not.toMatch(/[٠-٩]/);
    expect(all).not.toMatch(/[ۖ-ۭ]/);
  });

  it('/api/try is unchanged by Phase 3 (same request and response shape)', () => {
    const route = readFileSync(path.join(ROOT, 'app', 'api', 'try', 'route.ts'), 'utf8');
    expect(route).toContain("{ stationId, itemId } (an active test item) or { stationId, text }");
    expect(route).toContain('Response.json({ ...replyView(lib, res.reply), trace: isSafeTrace(res.trace) ? res.trace : null })');
  });
});

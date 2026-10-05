// Parent summary card (D54, Phase 4): built from existing session events and the completed-station list
// only; no score, no generated prose, nothing sent. Events are built through the real flow reducer.
// Never prints record text.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { makeEvent, type SessionEvent } from '@/app/_lib/events';
import { initialState, reducer, type FlowAction } from '@/app/_lib/flow';
import { buildStationView } from '@/app/_lib/station-view';
import { summarize } from '@/app/_lib/summary';
import { runtimeLibrary } from '@/app/_lib/test-helpers';
import SessionSummary, { type SummaryCardStation } from './SessionSummary';
import { SUMMARY } from './text';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const lib = runtimeLibrary();
const t = 1700000000;
const views = ['S1', 'S2', 'S3'].map((s) => buildStationView(lib, s, () => false)!);
const stations: SummaryCardStation[] = views.map((v) => ({
  id: v.stationId, title: v.stationId, parent: v.parent,
  hintIds: [...v.observe!.hints.map((h) => h.id), ...(v.observe!.together ? [v.observe!.together.id] : [])],
}));

// The session events the station screens would write for these taps.
function play(stationId: string, actions: FlowAction[]): SessionEvent[] {
  const v = views.find((x) => x.stationId === stationId)!;
  const out: SessionEvent[] = [];
  let s = initialState();
  for (const a of actions) { s = reducer(v, s, a); out.push(...s.events.map((e) => makeEvent(e as unknown as Record<string, unknown>))); s = reducer(v, s, { type: 'flushed' }); }
  return out;
}
const correct = (id: string) => views.find((v) => v.stationId === id)!.observe!.correctChoiceId;
const hints = (n: number): FlowAction[] => Array.from({ length: n }, () => ({ type: 'hint', t }));

describe('summarize', () => {
  it('nothing completed: empty, no safety notice', () => {
    expect(summarize([], [], stations)).toEqual({ completed: [], safetyReferral: false });
  });

  it('counts the hint rungs opened per completed station, and the together rung', () => {
    const s1 = play('S1', [{ type: 'start' }, ...hints(2), { type: 'choose', choiceId: correct('S1'), t }]);
    const s2 = play('S2', [{ type: 'start' }, ...hints(stations[1].hintIds.length), { type: 'choose', choiceId: correct('S2'), t }]);
    const s3 = play('S3', [{ type: 'start' }, ...hints(1)]); // started, not completed
    const r = summarize([...s1, ...s2, ...s3], ['S1', 'S2'], stations);
    expect(r.completed.map((c) => [c.id, c.hintsUsed, c.hintsTotal, c.together])).toEqual([
      ['S1', 2, stations[0].hintIds.length, false],
      ['S2', stations[1].hintIds.length, stations[1].hintIds.length, true],
    ]);
  });

  it('a hint opened twice counts once; journey order is kept whatever the completion order', () => {
    const e = play('S1', [{ type: 'start' }, ...hints(1)]);
    expect(summarize([...e, ...e], ['S3', 'S1'], stations).completed.map((c) => [c.id, c.hintsUsed])).toEqual([['S1', 1], ['S3', 0]]);
  });

  it('counts referred replies per station and raises the safety notice for any safety_referral event', () => {
    const referred = makeEvent({ stationId: 'S1', event: 'referred', level: 'C', sourceIds: ['S1.X3'], t });
    const safety = makeEvent({ stationId: 'S2', event: 'safety_referral', sourceIds: [], t });
    const r = summarize([referred, referred, safety], ['S1'], stations);
    expect(r.completed[0].referred).toBe(2);
    expect(r.safetyReferral).toBe(true);
  });
});

describe('summary card', () => {
  const render = (s: ReturnType<typeof summarize>) => renderToString(<SessionSummary stations={stations} initial={s} />);

  it('completed stations with hint counts and their approved parent-summary lines; no score', () => {
    const e = play('S1', [{ type: 'start' }, ...hints(2), { type: 'choose', choiceId: correct('S1'), t }]);
    const html = render(summarize(e, ['S1'], stations));
    expect(html).toContain('data-session-summary="1"');
    expect(html).toContain('data-summary-station="S1"');
    expect(html).toContain('data-hints="2"');
    expect(html).toContain(SUMMARY.hints(2, stations[0].hintIds.length));
    for (const r of views[0].parent) expect(html).toContain(`data-summary-line="${r.id}"`);
    expect(html).not.toContain('data-summary-station="S2"');
    expect(html).not.toMatch(/score|درجة|نقاط/i);
    expect(html).not.toContain('data-summary-safety');
  });

  it('no hints: the no-hint line; nothing completed: the empty line', () => {
    expect(render(summarize([], ['S2'], stations))).toContain(SUMMARY.noHints);
    expect(render(summarize([], [], stations))).toContain('data-summary-empty');
  });

  it('a safety referral is shown first, as an alert', () => {
    const safety = makeEvent({ stationId: 'S1', event: 'safety_referral', sourceIds: [], t });
    const html = render(summarize([safety], [], stations));
    expect(html.indexOf('data-summary-safety')).toBeGreaterThan(-1);
    expect(html.indexOf('data-summary-safety')).toBeLessThan(html.indexOf('data-summary-empty'));
    expect(html).toMatch(/role="alert"[^>]*data-summary-safety/);
  });

  it('reads only on the device: no fetch, no write, no new event', () => {
    const src = ['app/parent/SessionSummary.tsx', 'app/_lib/summary.ts'].map((f) => readFileSync(path.join(ROOT, f), 'utf8').replace(/^\s*\/\/.*$/gm, '')).join('\n');
    expect(src).not.toMatch(/fetch\(|setItem|addEvents|makeEvent|console\./);
  });

  it('draft wording: Western numerals only', () => {
    expect(JSON.stringify(SUMMARY) + SUMMARY.completed(2, 3) + SUMMARY.hints(1, 5) + SUMMARY.referred(1)).not.toMatch(/[٠-٩]/);
  });
});

describe('parent page (D57)', () => {
  it('the card replaces the per-station sections; each station entry keeps the /parent#S1 anchor', () => {
    const page = readFileSync(path.join(ROOT, 'app', 'parent', 'page.tsx'), 'utf8');
    expect(page).toContain('<SessionSummary');
    expect(page).not.toMatch(/v\.parent\.map/);
    const e = play('S1', [{ type: 'start' }, { type: 'choose', choiceId: correct('S1'), t }]);
    expect(renderToString(<SessionSummary stations={stations} initial={summarize(e, ['S1'], stations)} />)).toMatch(/<li id="S1"/);
  });

  it('the approved wording edits (D57) are in place', () => {
    expect(SUMMARY.together).toBe('واحتاج إلى المساعدة في آخر خطوة حتى وجد الإجابة.');
    expect(SUMMARY.learned).toBe('ما تعرّف عليه الطفل في هذه المحطة');
    expect(SUMMARY.privacy).toContain('أو عند إغلاق المتصفح'); // the summary reads sessionStorage
    expect(readFileSync(path.join(ROOT, 'app', '_components', 'session.ts'), 'utf8')).toContain('window.sessionStorage.getItem');
  });
});

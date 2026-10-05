// Static story mode (D47): every step comes from the station's approved script, in the fixed order
// (frame -> question -> correct answer + praise -> correct narration cards -> verse -> explanations ->
// close), and no step ever shows a choice, a hint, a question button or a Next button.
// Expected IDs are re-derived here from /content; never prints record text.

import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { loadLabels } from '@/app/_lib/labels';
import { publicFileExists } from '@/app/_lib/media';
import { buildStationView } from '@/app/_lib/station-view';
import { buildStorySteps, stepKey } from '@/app/_lib/story';
import { runtimeLibrary } from '@/app/_lib/test-helpers';
import StoryPlayer from './StoryPlayer';

const lib = runtimeLibrary();
const labels = loadLabels();
interface Script { step: string; correctChoiceId?: string; choiceIds?: string[]; mode?: string; expectedOrder?: string[]; narrationCardIds?: string[]; scoringNote?: string; hintIds?: string[] }
const script = (id: string) => (JSON.parse(readFileSync(`content/stations/${id}.json`, 'utf8')) as { script: Script[] }).script;

// The narration cards the station counts as correct, from the script (as e2e/screens.spec.ts does).
function picks(id: string): string[] {
  const n = script(id).find((s) => s.step === 'narrate')!;
  if (n.mode === 'order') return n.expectedOrder ?? [];
  let best: { id: string; score: number } | null = null;
  for (const m of (n.scoringNote ?? '').matchAll(/(S\d+\.N\d+)\s*=\s*(\d)/g)) {
    if ((n.narrationCardIds ?? []).includes(m[1]) && (!best || Number(m[2]) > best.score)) best = { id: m[1], score: Number(m[2]) };
  }
  return best ? [best.id] : [];
}

const ORDER = ['frame', 'question', 'answer', 'card', 'verse', 'explanation', 'close'];

describe.each(['S1', 'S2', 'S3'])('%s story', (s) => {
  const view = buildStationView(lib, s, publicFileExists)!;
  const steps = buildStorySteps(view);
  const observe = script(s).find((x) => x.step === 'observe')!;

  it('plays every step of the approved script in the fixed order', () => {
    const kinds = steps.map((x) => x.kind);
    expect(kinds.map((k) => ORDER.indexOf(k))).toEqual([...kinds.map((k) => ORDER.indexOf(k))].sort((a, b) => a - b));
    for (const k of ['frame', 'question', 'answer', 'card', 'verse', 'close']) expect(kinds, k).toContain(k);
    const expected = [
      ...view.frame.map((r) => `frame:${r.id}`),
      `question:${view.observe!.question.id}`,
      `answer:${observe.correctChoiceId}`,
      ...picks(s).map((id) => `card:${id}`),
      `verse:${view.connect!.verse!.id}`,
      ...view.connect!.explanations.map((r) => `explanation:${r.id}`),
      ...view.close.lines.map((r) => `close:${r.id}`),
    ];
    expect(steps.map(stepKey)).toEqual(expected);
    const answer = steps.find((x) => x.kind === 'answer')!;
    expect(answer.kind === 'answer' && answer.praise?.id).toBe(view.observe!.praise!.id);
  });

  it('never shows a choice, hint, question or Next button at any step', () => {
    const wrong = (observe.choiceIds ?? []).filter((c) => c !== observe.correctChoiceId);
    const hints = view.observe!.hints.map((h) => h.id);
    for (let i = -1; i <= steps.length; i++) {
      const html = renderToString(<StoryPlayer view={view} steps={steps} labels={labels} initialIndex={i} />);
      expect(html, `step ${i}`).not.toMatch(/data-record=|data-action="(hint|next|start)"|data-question=/);
      for (const id of [...wrong, ...hints]) expect(html, `step ${i}`).not.toContain(id);
      const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
      const allowed = buttons.filter((b) => /data-story-start|data-recitation=/.test(b));
      expect(buttons.length, `step ${i}`).toBe(allowed.length);
    }
  });

  it('the verse step uses the real recitation only (no narration file for a verse)', () => {
    const verse = steps.find((x) => x.kind === 'verse')!;
    expect(verse.kind === 'verse' && verse.verse.recitation?.audioUrl).toMatch(/^https:\/\/[^/]*mp3quran\.net\//);
    expect(steps.some((x) => x.kind !== 'verse' && x.kind !== 'answer' && x.record.type === 'quran')).toBe(false);
  });
});

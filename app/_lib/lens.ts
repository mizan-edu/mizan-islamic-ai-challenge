// AI lens (D54): every decision behind the current station step, for adults judging the system. A
// decision is either "rule" (the station script or the deterministic router chose the records, no
// model involved) or "model" (a model was called this turn; its latency, tokens and fallback flag are
// shown). IDs, codes, levels and platform IDs only: never record text, never the child's input.
// Built on the client from the station view and the flow state; nothing is stored or sent.

import type { ModelCall } from './classifier';
import type { FlowState } from './flow';
import type { StationView } from './station-view';
import type { Trace } from './trace';

export interface LensSource { id: string; platform: string | null; platformId: string | null }

export interface LensDecision {
  kind: 'rule' | 'model';
  code: string; // what decided, e.g. SCRIPT_REDIRECT or anticipated_question · AQ_MATCH
  input: string | null; // the tapped ID (choice, card or question), when the decision answers a tap
  recordIds: string[]; // the records shown as the result
  level: string; // the strictest level among them (NA when all are non-Islamic lines)
  sources: LensSource[]; // each record's platform and platform ID, plus what explanations are based on
  model: { calls: ModelCall[]; latencyMs: number; fallback: boolean; tier: string | null } | null;
}

const LEVEL_ORDER = ['NA', 'A', 'B', 'OUT_OF_SCOPE', 'C', 'D']; // the router's strictness order, NA lowest

export function strictestLevel(levels: string[]): string {
  return levels.reduce((hi, l) => (LEVEL_ORDER.indexOf(l) > LEVEL_ORDER.indexOf(hi) ? l : hi), 'NA');
}

function sourcesOf(view: StationView, ids: string[]): LensSource[] {
  const out: LensSource[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const s = view.sources[id];
    out.push({ id, platform: s?.platform ?? null, platformId: s?.platformId ?? null });
    s?.basedOn.forEach(visit);
  };
  ids.forEach(visit);
  return out;
}

function rule(view: StationView, code: string, recordIds: (string | null | undefined)[], input: string | null = null): LensDecision {
  const ids = recordIds.filter((x): x is string => typeof x === 'string');
  const sources = sourcesOf(view, ids);
  return { kind: 'rule', code, input, recordIds: ids, level: strictestLevel(sources.map((s) => view.sources[s.id]?.level ?? 'NA')), sources, model: null };
}

// The decision behind one ask reply, from its judge trace.
export function traceDecision(view: StationView, trace: Trace, questionId: string): LensDecision {
  const r = trace.route;
  const calls = trace.modelCalls ?? [];
  const modelUsed = calls.length > 0;
  const code = [r.type, r.code, r.fallbackReason, ...r.ruleIds].filter(Boolean).join(' · ');
  const sources = sourcesOf(view, trace.cited);
  return {
    kind: modelUsed ? 'model' : 'rule',
    code,
    input: questionId,
    recordIds: trace.cited,
    level: trace.level,
    sources,
    model: modelUsed ? { calls, latencyMs: trace.latencyMs, fallback: r.type.startsWith('fallback'), tier: r.type.startsWith('fallback:') ? r.type.slice('fallback:'.length) : 'primary' } : null,
  };
}

// Every decision behind the step on screen, in the order the child met them. On the ask step, `ask`
// adds the decision behind the latest reply (from its trace).
export function stepDecisions(view: StationView, state: FlowState, ask: { id: string; trace: Trace | null } | null = null): LensDecision[] {
  const out: LensDecision[] = [];
  switch (state.step) {
    case 'frame':
      out.push(rule(view, 'SCRIPT_FRAME', [view.title?.id, ...view.frame.map((r) => r.id)]));
      break;

    case 'observe': {
      const o = view.observe;
      if (!o) break;
      out.push(rule(view, 'SCRIPT_QUESTION', [o.question.id, ...o.choices.map((c) => c.id)]));
      for (const c of state.observe.greyed) out.push(rule(view, 'SCRIPT_REDIRECT', [o.redirects[c]?.id], c));
      const rungs = Math.min(state.observe.hintIndex + 1, o.hints.length);
      for (let i = 0; i < rungs; i++) out.push(rule(view, `HINT_LADDER_RUNG_${i + 1}`, [o.hints[i].id]));
      if (state.observe.hintIndex >= o.hints.length && o.together) out.push(rule(view, 'HINT_TOGETHER', [o.together.id, o.highlightChoiceId]));
      if (state.observe.solved) out.push(rule(view, 'SCRIPT_PRAISE', [o.praise?.id], o.correctChoiceId));
      break;
    }

    case 'connect': {
      const c = view.connect;
      if (!c) break;
      out.push(rule(view, 'SCRIPT_BRIDGE', [...c.science.map((r) => r.id), c.bridge?.id, c.listen?.id]));
      if (c.verse) {
        const d = rule(view, 'SCRIPT_VERSE_CARD', [c.verse.id, c.tafsir?.id, ...c.explanations.map((r) => r.id)]);
        if (c.verse.recitation) d.sources.push({ id: c.verse.id, platform: 'mp3quran.net', platformId: c.verse.recitation.audioUrl.replace(/^https?:\/\/[^/]+/, '') });
        out.push(d);
      }
      break;
    }

    case 'ask':
      out.push(rule(view, 'SCRIPT_ASK_OPTIONS', [], null));
      out[0].recordIds = view.ask.map((q) => q.id); // the pre-written question IDs offered
      if (ask?.trace) out.push(traceDecision(view, ask.trace, ask.id));
      break;

    case 'narrate': {
      const n = view.narrate;
      if (!n) break;
      out.push(rule(view, 'SCRIPT_NARRATE', [n.intro?.id, ...n.cards.map((c) => c.id)]));
      const fb = state.narrate.feedbackId;
      if (n.mode === 'order') {
        if (state.narrate.picked.length) out.push(rule(view, 'NARRATE_ORDER_PICKED', [], state.narrate.picked.join('>')));
        if (fb && fb === n.retry?.id) out.push(rule(view, 'NARRATE_ORDER_RETRY', [fb]));
        if (state.narrate.done) out.push(rule(view, 'NARRATE_ORDER_MATCH', [n.praise?.id], (n.expectedOrder ?? []).join('>')));
      } else {
        const pick = state.narrate.picked[0] ?? null;
        if (fb && fb === n.retry?.id) out.push(rule(view, 'NARRATE_RETRY', [fb], pick));
        if (state.narrate.done) out.push(rule(view, 'NARRATE_BEST_CARD', [n.praise?.id], pick));
      }
      break;
    }

    case 'close':
    case 'done':
      out.push(rule(view, `SCRIPT_CLOSE · PLANT_STAGE_${view.close.stage}`, view.close.lines.map((r) => r.id)));
      if (view.parent.length) out.push(rule(view, 'PARENT_SUMMARY', view.parent.map((r) => r.id)));
      break;
  }
  return out;
}

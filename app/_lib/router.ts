// Router (CLAUDE.md §5 Router, §5.2 levels, R5/R6). Deterministic first: verse match, anticipated
// questions and approved router rules. The model classifier runs only when none of them matched,
// and a rule can always raise its result. Output: level, behaviour, primary record, reason, rule IDs.

import type { Classifier, ClassifierCandidate } from './classifier';
import type { ContentRecord } from './content';
import { stricter, type RouteLevel } from './levels';
import { fallbackFor, referralFor, sourcesOf, type Library } from './library';
import { fireRules } from './router-rules';
import { retrieve } from './retrieval';

export type Behaviour = 'answer' | 'verse_card' | 'correction' | 'referral' | 'fallback';

export interface RouteInput {
  stationId: string | null;
  text: string;
  onScreen?: string[];
}

export interface RouteResult {
  level: RouteLevel;
  behaviour: Behaviour;
  recordId: string | null;
  source: 'verse' | 'aq' | 'rule' | 'model' | 'none';
  reason: string;
  ruleIds: string[];
}

// A/B answers must come from an approved answer/explanation record that names its library sources;
// NA science answers stand on their own (no Islamic claim).
export function isAnswerable(lib: Library, r: ContentRecord | undefined): r is ContentRecord {
  if (!r || r.status !== 'approved' || !(r.type === 'answer' || r.type === 'explanation')) return false;
  if (r.level === 'NA') return true;
  return (r.level === 'A' || r.level === 'B') && sourcesOf(lib, r).length > 0;
}

function byLevel(lib: Library, stationId: string | null, level: RouteLevel, base: Omit<RouteResult, 'behaviour' | 'recordId' | 'level'>): RouteResult {
  if (level === 'C' || level === 'D') {
    const ref = referralFor(lib, stationId) ?? fallbackFor(lib, stationId);
    return { ...base, level, behaviour: ref?.type === 'referral' ? 'referral' : 'fallback', recordId: ref?.id ?? null };
  }
  return { ...base, level, behaviour: 'fallback', recordId: fallbackFor(lib, stationId)?.id ?? null };
}

function behaviourOf(r: ContentRecord): Behaviour {
  if (r.type === 'referral') return 'referral';
  if (r.type === 'fallback') return 'fallback';
  if (r.type === 'quran') return 'verse_card';
  return 'answer';
}

function toCandidate(r: ContentRecord): ClassifierCandidate {
  const isText = r.type !== 'quran' && r.type !== 'tafsir';
  return { id: r.id, type: r.type, role: r.role, level: r.level, reference: (r.reference as string | null) ?? null, ...(isText ? { text: r.text } : {}) };
}

export async function route(lib: Library, input: RouteInput, classifier: Classifier | null = null): Promise<RouteResult> {
  const { stationId, text } = input;
  const r = retrieve(lib, stationId, text, input.onScreen ?? []);
  // Rules marked unlessVerseMatch (RR-D-VERSE-CLAIM) stand aside when a verse is matched.
  const fired = fireRules(lib.rules, text).filter((f) => !(f.unlessVerseMatch && r.verse));
  const ruleIds = fired.map((f) => f.id);
  const ruleLevel = stricter(...fired.map((f) => f.level));

  // 1. A quoted verse (exact or altered): show the library verse card. Rules may still raise it.
  if (r.verse) {
    const level = stricter('A', ruleLevel)!;
    if (level === 'A') {
      return { level, behaviour: r.verse.exact ? 'verse_card' : 'correction', recordId: r.verse.record.id, source: 'verse', reason: r.verse.exact ? 'verse quoted exactly' : 'verse quoted with changes', ruleIds };
    }
    return byLevel(lib, stationId, level, { source: 'rule', reason: 'rule raised a verse question', ruleIds });
  }

  // 2. Anticipated question: its reviewed response, unless a rule makes the question stricter.
  if (r.aq) {
    const aqLevel = (r.aq.question.level as RouteLevel) ?? 'A';
    const level = stricter(aqLevel, ruleLevel)!;
    if (level === aqLevel && (r.aq.record.type !== 'answer' && r.aq.record.type !== 'explanation' || isAnswerable(lib, r.aq.record))) {
      return { level, behaviour: behaviourOf(r.aq.record), recordId: r.aq.record.id, source: 'aq', reason: `anticipated question ${r.aq.question.id}`, ruleIds };
    }
    return byLevel(lib, stationId, level, { source: 'rule', reason: 'rule raised an anticipated question', ruleIds });
  }

  // 3. A rule fired: referral (C/D) or fallback (out of scope, no approved record).
  if (ruleLevel) {
    const routeKind = fired.find((f) => f.level === ruleLevel)?.route ?? 'fallback';
    if (ruleLevel === 'C' || ruleLevel === 'D' || routeKind === 'referral') return byLevel(lib, stationId, ruleLevel, { source: 'rule', reason: 'router rule', ruleIds });
    return { level: ruleLevel, behaviour: 'fallback', recordId: fallbackFor(lib, stationId)?.id ?? null, source: 'rule', reason: 'router rule', ruleIds };
  }

  // 4. No deterministic match: the model classifies, choosing only among approved candidates.
  if (!classifier) return { ...byLevel(lib, stationId, 'OUT_OF_SCOPE', { source: 'none', reason: 'no deterministic match; no classifier', ruleIds }) };
  const out = await classifier({ stationId, question: text, candidates: r.candidates.map(toCandidate) });
  if (!out) return byLevel(lib, stationId, 'OUT_OF_SCOPE', { source: 'model', reason: 'classifier unavailable or invalid output', ruleIds });
  const level = stricter(out.level, ruleLevel)!;
  if (level === 'A' || level === 'B') {
    const rec = out.recordId ? lib.byId.get(out.recordId) : undefined;
    if (rec?.type === 'quran') return { level, behaviour: 'verse_card', recordId: rec.id, source: 'model', reason: 'classifier: verse on screen', ruleIds };
    if (isAnswerable(lib, rec)) return { level, behaviour: 'answer', recordId: rec.id, source: 'model', reason: 'classifier', ruleIds };
    return { level, behaviour: 'fallback', recordId: fallbackFor(lib, stationId)?.id ?? null, source: 'model', reason: 'classifier found no approved answer', ruleIds };
  }
  return byLevel(lib, stationId, level, { source: 'model', reason: 'classifier', ruleIds });
}

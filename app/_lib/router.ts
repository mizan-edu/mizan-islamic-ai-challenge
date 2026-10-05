// Router (CLAUDE.md §5 Router, §5.2 levels, R5/R6). Deterministic first: verse match, anticipated
// questions and approved router rules. The model classifier runs only when none of them matched,
// and a rule can always raise its result. Output: level, behaviour, primary record, reason, a stable
// English reason code (judge-mode trace, A1), rule IDs.

import type { Classifier, ClassifierCandidate } from './classifier';
import type { ContentRecord } from './content';
import { isRouteLevel, stricter, type RouteLevel } from './levels';
import { fallbackFor, referralFor, sourcesOf, type Library } from './library';
import { fireRules } from './router-rules';
import { namedSurahs } from './surahs';
import { retrieve } from './retrieval';

export type Behaviour = 'answer' | 'verse_card' | 'correction' | 'referral' | 'fallback';

export interface RouteInput {
  stationId: string | null;
  text: string;
  onScreen?: string[];
}

// Reason codes (A1): shown as-is in the judge panel; '+LEVEL_FLOOR' is appended when the floor raised the level.
export type RouteCode =
  | 'VERSE_EXACT' | 'VERSE_ALTERED' | 'VERSE_WRONG_SURAH' | 'RULE_RAISED_VERSE'
  | 'AQ_MATCH' | 'RULE_RAISED_AQ' | 'ROUTER_RULE'
  | 'NO_MATCH_NO_CLASSIFIER' | 'CLASSIFIER_INVALID' | 'CLASSIFIER_VERSE_ON_SCREEN' | 'CLASSIFIER_ANSWER' | 'CLASSIFIER_NO_ANSWER' | 'CLASSIFIER_LEVEL';

export interface RouteResult {
  level: RouteLevel;
  behaviour: Behaviour;
  recordId: string | null;
  source: 'verse' | 'aq' | 'rule' | 'model' | 'none';
  reason: string;
  code: RouteCode | `${RouteCode}+LEVEL_FLOOR`;
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

// Level floor (D25): the final level is never below the chosen record's level or the levels of the
// records it relies on (one step through explanations, as in the reply's citations). Only raises.
export function levelFloor(lib: Library, level: RouteLevel, rec: ContentRecord): RouteLevel {
  const ids = new Set<string>();
  for (const id of sourcesOf(lib, rec)) {
    ids.add(id);
    const s = lib.byId.get(id);
    if (s?.type === 'explanation') for (const id2 of sourcesOf(lib, s)) ids.add(id2);
  }
  const levels = [rec.level, ...[...ids].map((id) => lib.byId.get(id)?.level)].filter(isRouteLevel);
  return stricter(level, ...levels)!;
}

const floorCode = (c: RouteResult['code']): RouteResult['code'] => (c.endsWith('+LEVEL_FLOOR') ? c : `${c as RouteCode}+LEVEL_FLOOR`);

// A routed answer after the floor: if the floor reached C or D, the referral replaces the answer.
function floored(lib: Library, stationId: string | null, res: RouteResult, rec: ContentRecord): RouteResult {
  const level = levelFloor(lib, res.level, rec);
  if (level === res.level) return res;
  if ((level === 'C' || level === 'D') && rec.type !== 'referral') return byLevel(lib, stationId, level, { source: res.source, reason: `${res.reason}; level floor ${level}`, code: floorCode(res.code), ruleIds: res.ruleIds });
  return { ...res, level, reason: `${res.reason}; level floor ${level}`, code: floorCode(res.code) };
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
  //    A question that names a different surah gets the correction too (stored reference shown).
  if (r.verse) {
    const level = stricter('A', ruleLevel)!;
    if (level === 'A') {
      const surah = Number(String(r.verse.record.reference).split(':')[0]);
      const named = namedSurahs(text, lib.surahs);
      const wrongSurah = named.length > 0 && !named.includes(surah);
      const correction = !r.verse.exact || wrongSurah;
      const reason = !r.verse.exact ? 'verse quoted with changes' : wrongSurah ? 'verse quoted with the wrong surah' : 'verse quoted exactly';
      const code = !r.verse.exact ? 'VERSE_ALTERED' : wrongSurah ? 'VERSE_WRONG_SURAH' : 'VERSE_EXACT';
      return floored(lib, stationId, { level, behaviour: correction ? 'correction' : 'verse_card', recordId: r.verse.record.id, source: 'verse', reason, code, ruleIds }, r.verse.record);
    }
    return byLevel(lib, stationId, level, { source: 'rule', reason: 'rule raised a verse question', code: 'RULE_RAISED_VERSE', ruleIds });
  }

  // 2. Anticipated question: its reviewed response, unless a rule makes the question stricter.
  if (r.aq) {
    const aqLevel = (r.aq.question.level as RouteLevel) ?? 'A';
    const level = stricter(aqLevel, ruleLevel)!;
    if (level === aqLevel && (r.aq.record.type !== 'answer' && r.aq.record.type !== 'explanation' || isAnswerable(lib, r.aq.record))) {
      return floored(lib, stationId, { level, behaviour: behaviourOf(r.aq.record), recordId: r.aq.record.id, source: 'aq', reason: `anticipated question ${r.aq.question.id}`, code: 'AQ_MATCH', ruleIds }, r.aq.record);
    }
    return byLevel(lib, stationId, level, { source: 'rule', reason: 'rule raised an anticipated question', code: 'RULE_RAISED_AQ', ruleIds });
  }

  // 3. A rule fired: referral (C/D) or fallback (out of scope, no approved record).
  if (ruleLevel) {
    const routeKind = fired.find((f) => f.level === ruleLevel)?.route ?? 'fallback';
    if (ruleLevel === 'C' || ruleLevel === 'D' || routeKind === 'referral') return byLevel(lib, stationId, ruleLevel, { source: 'rule', reason: 'router rule', code: 'ROUTER_RULE', ruleIds });
    return { level: ruleLevel, behaviour: 'fallback', recordId: fallbackFor(lib, stationId)?.id ?? null, source: 'rule', reason: 'router rule', code: 'ROUTER_RULE', ruleIds };
  }

  // 4. No deterministic match: the model classifies, choosing only among approved candidates.
  if (!classifier) return { ...byLevel(lib, stationId, 'OUT_OF_SCOPE', { source: 'none', reason: 'no deterministic match; no classifier', code: 'NO_MATCH_NO_CLASSIFIER', ruleIds }) };
  const out = await classifier({ stationId, question: text, candidates: r.candidates.map(toCandidate) });
  if (!out) return byLevel(lib, stationId, 'OUT_OF_SCOPE', { source: 'model', reason: 'classifier unavailable or invalid output', code: 'CLASSIFIER_INVALID', ruleIds });
  const level = stricter(out.level, ruleLevel)!;
  if (level === 'A' || level === 'B') {
    const rec = out.recordId ? lib.byId.get(out.recordId) : undefined;
    if (rec?.type === 'quran') return floored(lib, stationId, { level, behaviour: 'verse_card', recordId: rec.id, source: 'model', reason: 'classifier: verse on screen', code: 'CLASSIFIER_VERSE_ON_SCREEN', ruleIds }, rec);
    if (isAnswerable(lib, rec)) return floored(lib, stationId, { level, behaviour: 'answer', recordId: rec.id, source: 'model', reason: 'classifier', code: 'CLASSIFIER_ANSWER', ruleIds }, rec);
    return { level, behaviour: 'fallback', recordId: fallbackFor(lib, stationId)?.id ?? null, source: 'model', reason: 'classifier found no approved answer', code: 'CLASSIFIER_NO_ANSWER', ruleIds };
  }
  return byLevel(lib, stationId, level, { source: 'model', reason: 'classifier', code: 'CLASSIFIER_LEVEL', ruleIds });
}

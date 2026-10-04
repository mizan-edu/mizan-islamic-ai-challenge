// Deterministic router rules from /content/router-rules.json (reviewed data, CLAUDE.md §5).
// Only rules with status "approved" are loaded. Patterns run on normalized text (normalize.ts).
// Rules can only raise the level (R5); they never select an answer.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { RouteLevel } from './levels';
import { isRouteLevel } from './levels';
import { normalizeArabic } from './normalize';

export interface RouterRule {
  id: string;
  level: RouteLevel; // level the rule raises the question to
  route: 'referral' | 'fallback';
  patterns: string[]; // regular expressions over normalized text
  // The rule does not fire when ANY of `any` matches and NONE of `none` matches.
  exceptWhen?: { any: string[]; none: string[] };
  // The rule stands aside when the question contains a verse that reaches the verse-match threshold.
  unlessVerseMatch?: boolean;
  note?: string;
  status: string;
  reviewer1?: string | null;
  reviewer1At?: string | null;
}

export function loadRouterRules(contentDir: string): RouterRule[] {
  const file = path.join(contentDir, 'router-rules.json');
  if (!existsSync(file)) return [];
  const data = JSON.parse(readFileSync(file, 'utf8')) as { rules?: RouterRule[] };
  return (data.rules ?? []).filter((r) => r.status === 'approved' && isRouteLevel(r.level));
}

export interface FiredRule {
  id: string;
  level: RouteLevel;
  route: 'referral' | 'fallback';
  unlessVerseMatch?: boolean;
}

export function fireRules(rules: RouterRule[], text: string): FiredRule[] {
  const norm = normalizeArabic(text);
  const fired: FiredRule[] = [];
  const hit = (patterns: string[]) => patterns.some((p) => new RegExp(p, 'u').test(norm));
  for (const r of rules) {
    if (r.status !== 'approved' || !hit(r.patterns)) continue;
    if (r.exceptWhen && hit(r.exceptWhen.any) && !hit(r.exceptWhen.none)) continue;
    fired.push({ id: r.id, level: r.level, route: r.route, ...(r.unlessVerseMatch ? { unlessVerseMatch: true } : {}) });
  }
  return fired;
}

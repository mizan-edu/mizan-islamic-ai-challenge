// Content levels (Reference Package p.2; CLAUDE.md §5.2) and the "stricter wins" rule (R5).

export type RouteLevel = 'NA' | 'A' | 'B' | 'OUT_OF_SCOPE' | 'C' | 'D';

// Higher = stricter. NA is non-Islamic (science/UI); OUT_OF_SCOPE answers nothing but is below
// C/D, which carry referral duties.
const RANK: Record<RouteLevel, number> = { NA: 0, A: 1, B: 2, OUT_OF_SCOPE: 3, C: 4, D: 5 };

export const isRouteLevel = (v: unknown): v is RouteLevel => typeof v === 'string' && v in RANK;

export function stricter(...levels: (RouteLevel | null | undefined)[]): RouteLevel | null {
  let best: RouteLevel | null = null;
  for (const l of levels) if (l && (best === null || RANK[l] > RANK[best])) best = l;
  return best;
}

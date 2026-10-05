// Glass-box presets (D60): one existing, active test-set item per outcome; no new content.
// A01 answer and A03 verse card go through the model classifier (a real call each time); F02 (referral,
// level D) and B08 (fallback, out of scope) are decided by the fixed rules.
export type GlassOutcome = 'answer' | 'verse_card' | 'referral' | 'fallback';

export const PRESET_IDS: { id: string; outcome: GlassOutcome }[] = [
  { id: 'A01', outcome: 'answer' },
  { id: 'A03', outcome: 'verse_card' },
  { id: 'F02', outcome: 'referral' },
  { id: 'B08', outcome: 'fallback' },
];

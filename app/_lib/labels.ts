// Approved UI labels (content/ui.json). Draft keys are absent at runtime, so icon buttons simply
// have no spoken label until Hussein approves them (CLAUDE.md §5.3).

import { loadUiStrings } from './content';

export interface Labels {
  journeyTitle?: string;
  parents?: string;
  start?: string;
  play?: string;
  playRecitation?: string;
  hint?: string;
  next?: string;
  home?: string;
  nextStation?: string;
  verseLabel?: string;
  tafsirToggle?: string;
  comingSoon?: string;
  surah?: string;
  ayah?: string;
  sfx?: string;
  // Judge panel (A1, D37): adults only, shown in judge mode.
  judgeMode?: string;
  judgeRoute?: string;
  judgeLevel?: string;
  judgeClassifierLevel?: string;
  judgeModel?: string;
  judgeNoModelCall?: string;
  judgeRetrieved?: string;
  judgeCited?: string;
  judgeValidator?: string;
  judgePass?: string;
  judgeBlocked?: string;
  judgeLatency?: string;
  // AI lens (D54) and the parental gate: drafts until Review 1; the lens shows English codes meanwhile.
  judgeDecision?: string;
  judgeRecords?: string;
  judgeSource?: string;
  judgeTokens?: string;
  judgeFallback?: string;
  gatePrompt?: string;
  // Glass-box view (D60): drafts until Review 1; the view shows English codes meanwhile.
  glassTitle?: string;
  glassIntro?: string;
  glassLink?: string;
  glassTabAsk?: string;
  glassTabChild?: string;
  glassPresets?: string;
  glassNodeQuestion?: string;
  glassNodeRules?: string;
  glassNodeClassifier?: string;
  glassNodeLevel?: string;
  glassNodeLibrary?: string;
  glassNodeValidator?: string;
  glassNodeOutput?: string;
  glassNotTaken?: string;
  glassReplay?: string;
  glassRealTime?: string;
  glassChildIntro?: string;
  glassChildCounter?: string;
}

const KEYS: Record<keyof Labels, string> = {
  journeyTitle: 'UI.JOURNEY_TITLE',
  parents: 'UI.PARENTS',
  start: 'UI.BTN_START',
  play: 'UI.BTN_PLAY',
  playRecitation: 'UI.BTN_PLAY_RECITATION',
  hint: 'UI.BTN_HINT',
  next: 'UI.BTN_NEXT',
  home: 'UI.BTN_HOME',
  nextStation: 'UI.BTN_NEXT_STATION',
  verseLabel: 'UI.VERSE_LABEL',
  tafsirToggle: 'UI.TAFSIR_TOGGLE',
  comingSoon: 'UI.COMING_SOON',
  surah: 'UI.SURAH',
  ayah: 'UI.AYAH',
  sfx: 'UI.SFX_TOGGLE',
  judgeMode: 'UI.JUDGE_MODE',
  judgeRoute: 'UI.JUDGE_ROUTE',
  judgeLevel: 'UI.JUDGE_LEVEL',
  judgeClassifierLevel: 'UI.JUDGE_CLASSIFIER_LEVEL',
  judgeModel: 'UI.JUDGE_MODEL',
  judgeNoModelCall: 'UI.JUDGE_NO_MODEL_CALL',
  judgeRetrieved: 'UI.JUDGE_RETRIEVED',
  judgeCited: 'UI.JUDGE_CITED',
  judgeValidator: 'UI.JUDGE_VALIDATOR',
  judgePass: 'UI.JUDGE_PASS',
  judgeBlocked: 'UI.JUDGE_BLOCKED',
  judgeLatency: 'UI.JUDGE_LATENCY',
  judgeDecision: 'UI.JUDGE_DECISION',
  judgeRecords: 'UI.JUDGE_RECORDS',
  judgeSource: 'UI.JUDGE_SOURCE',
  judgeTokens: 'UI.JUDGE_TOKENS',
  judgeFallback: 'UI.JUDGE_FALLBACK',
  gatePrompt: 'UI.GATE_PROMPT',
  glassTitle: 'UI.GLASS_TITLE',
  glassIntro: 'UI.GLASS_INTRO',
  glassLink: 'UI.GLASS_LINK',
  glassTabAsk: 'UI.GLASS_TAB_ASK',
  glassTabChild: 'UI.GLASS_TAB_CHILD',
  glassPresets: 'UI.GLASS_PRESETS',
  glassNodeQuestion: 'UI.GLASS_NODE_QUESTION',
  glassNodeRules: 'UI.GLASS_NODE_RULES',
  glassNodeClassifier: 'UI.GLASS_NODE_CLASSIFIER',
  glassNodeLevel: 'UI.GLASS_NODE_LEVEL',
  glassNodeLibrary: 'UI.GLASS_NODE_LIBRARY',
  glassNodeValidator: 'UI.GLASS_NODE_VALIDATOR',
  glassNodeOutput: 'UI.GLASS_NODE_OUTPUT',
  glassNotTaken: 'UI.GLASS_NOT_TAKEN',
  glassReplay: 'UI.GLASS_REPLAY',
  glassRealTime: 'UI.GLASS_REAL_TIME',
  glassChildIntro: 'UI.GLASS_CHILD_INTRO',
  glassChildCounter: 'UI.GLASS_CHILD_COUNTER',
};

export function loadLabels(): Labels {
  const ui = loadUiStrings();
  const out: Labels = {};
  for (const [k, id] of Object.entries(KEYS) as [keyof Labels, string][]) {
    const r = ui.get(id);
    if (r) out[k] = r.text;
  }
  return out;
}

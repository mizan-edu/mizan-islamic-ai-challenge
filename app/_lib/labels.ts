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

// TTS guard (R4). Synthetic voice never recites the Qur'an: only speakable text segments reach TTS,
// and any segment that is a verse, carries Qur'anic marks or contains stored verse wording is refused.

import type { Library } from './library';
import type { Reply } from './reply';
import { containsVerseWording, hasQuranMarks } from './validator';

export class TtsGuardError extends Error {}

export function ttsTexts(lib: Library, reply: Reply): string[] {
  const out: string[] = [];
  for (const s of reply.segments) {
    const r = lib.byId.get(s.recordId);
    const isQuran = s.kind === 'verse' || r?.type === 'quran';
    if (isQuran) {
      if (s.speakable) throw new TtsGuardError(`${s.recordId}: verse segment marked speakable`);
      continue; // verses play real recitation audio only
    }
    if (!s.speakable) continue;
    if (hasQuranMarks(s.text) || containsVerseWording(lib, s.text)) throw new TtsGuardError(`${s.recordId}: Qur'anic text in a TTS segment`);
    out.push(s.text);
  }
  return out;
}

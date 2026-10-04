// Media lookup for station screens. Narration is pre-rendered audio only (no browser TTS);
// Qur'an records never get narration (R4) — their sound is the real mp3quran recitation.

import { existsSync } from 'node:fs';
import path from 'node:path';
import type { ContentRecord } from './content';

export type FileExists = (publicPath: string) => boolean;

export const publicFileExists: FileExists = (publicPath) => existsSync(path.join(process.cwd(), 'public', publicPath.replace(/^\//, '')));

export const narrationPath = (stationId: string, recordId: string): string => `/audio/${stationId}/${recordId}.mp3`;
export const picturePath = (stationId: string, recordId: string): string => `/images/${stationId}/${recordId}.webp`;

// Narration source for a record, or null. Never for quran/tafsir/hadith or records marked tts:false.
export function narrationSrc(stationId: string, r: ContentRecord, exists: FileExists = publicFileExists): string | null {
  if (r.type === 'quran' || r.type === 'tafsir' || r.type === 'hadith' || r.tts !== true) return null;
  const p = narrationPath(stationId, r.id);
  return exists(p) ? p : null;
}

export function pictureSrc(stationId: string, r: ContentRecord, exists: FileExists = publicFileExists): string | null {
  const p = picturePath(stationId, r.id);
  return exists(p) ? p : null;
}

// Media fragment so the browser starts and stops the recitation at the ayah (works on iPad Safari
// and Android Chrome); the player also enforces the end time.
export function recitationSrc(audioUrl: string, startMs: number, endMs: number): string {
  return `${audioUrl}#t=${(startMs / 1000).toFixed(3)},${(endMs / 1000).toFixed(3)}`;
}

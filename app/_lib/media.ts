// Media lookup for station screens. Narration is pre-rendered audio only (no browser TTS);
// Qur'an records never get narration (R4) — their sound is the real mp3quran recitation.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { ContentRecord } from './content';
import { SFX_CUES, sfxPath, type SfxCue } from './sfx';

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

// Sound-effect cues whose file exists (D38); the client plays only these, so a missing file makes
// no request at all.
export function availableSfx(exists: FileExists = publicFileExists): SfxCue[] {
  return SFX_CUES.filter((cue) => exists(sfxPath(cue)));
}

// Video clips (D60, D62): /video/<name>.mp4 (H.264) and, when present, /video/<name>.webm. A clip whose
// files are missing is simply absent, and the screen keeps the approved still and its CSS layer.
export type VideoName = 'map' | 'S1' | 'S2' | 'S3';
export interface VideoSources { mp4: string | null; webm: string | null }
export const videoPath = (name: VideoName, ext: 'mp4' | 'webm'): string => `/video/${name}.${ext}`;
export function videoSources(name: VideoName, exists: FileExists = publicFileExists): VideoSources | null {
  const mp4 = exists(videoPath(name, 'mp4')) ? videoPath(name, 'mp4') : null;
  const webm = exists(videoPath(name, 'webm')) ? videoPath(name, 'webm') : null;
  return mp4 || webm ? { mp4, webm } : null;
}

export interface PictureSize { width: number; height: number }

// Pixel sizes from public/images/IMAGES.json (written by npm run assets:images), so each picture is
// framed at its own aspect ratio and never cropped.
let sizes: Map<string, PictureSize> | null = null;
export function pictureSize(recordId: string): PictureSize | null {
  if (!sizes) {
    sizes = new Map();
    const file = path.join(process.cwd(), 'public', 'images', 'IMAGES.json');
    if (existsSync(file)) {
      for (const e of (JSON.parse(readFileSync(file, 'utf8')) as { images: (PictureSize & { recordId: string })[] }).images) sizes.set(e.recordId, { width: e.width, height: e.height });
    }
  }
  return sizes.get(recordId) ?? null;
}

// Media fragment so the browser starts and stops the recitation at the ayah (works on iPad Safari
// and Android Chrome); the player also enforces the end time.
export function recitationSrc(audioUrl: string, startMs: number, endMs: number): string {
  return `${audioUrl}#t=${(startMs / 1000).toFixed(3)},${(endMs / 1000).toFixed(3)}`;
}

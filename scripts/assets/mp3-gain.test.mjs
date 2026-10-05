// Lossless MP3 gain (D65): only the global_gain fields change; a gain and its inverse give back the
// original bytes; the shipped files match SFX.json and carry no ID3 tag (the C2PA credential of the
// original would no longer match).

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyGain, id3Length } from './mp3-gain.mjs';

const manifest = JSON.parse(readFileSync('public/sfx/SFX.json', 'utf8'));

describe('mp3-gain', () => {
  it.each(manifest.sounds.map((s) => s.name))('%s: +k then -k returns the same bytes; 0 changes nothing', (name) => {
    const original = readFileSync(`public/sfx/${name}.mp3`);
    const b = Buffer.from(original);
    const up = applyGain(b, 4);
    expect(up.clamped).toBe(0);
    expect(up.adjusted).toBe(up.frames - 1); // every frame but the Info frame
    expect(Buffer.compare(b, original)).not.toBe(0);
    applyGain(b, -4);
    expect(Buffer.compare(b, original)).toBe(0);
    applyGain(b, 0);
    expect(Buffer.compare(b, original)).toBe(0);
  });

  it('only bytes inside frame side information change (never audio data, headers or the Info frame)', () => {
    const original = readFileSync('public/sfx/tap.mp3');
    const b = Buffer.from(original);
    applyGain(b, 3);
    // Walk the frames (MPEG-1 Layer III, 128 kbps, 44.1 kHz, stereo, no CRC: 32 bytes of side info).
    const sideInfo = [];
    let p = id3Length(original), first = true;
    while (p + 4 <= original.length && (original.readUInt32BE(p) >>> 21) === 0x7ff) {
      const pad = (original[p + 2] >> 1) & 1;
      if (!first) sideInfo.push([p + 4, p + 4 + 32]); // the first frame is the Info frame
      first = false;
      p += Math.floor((144 * 128000) / 44100) + pad;
    }
    expect(sideInfo.length).toBeGreaterThan(10);
    const changed = [];
    for (let i = 0; i < b.length; i++) if (b[i] !== original[i]) changed.push(i);
    expect(changed.length).toBeGreaterThan(0);
    for (const i of changed) expect(sideInfo.some(([s, e]) => i >= s && i < e), `byte ${i}`).toBe(true);
  });

  it('the shipped files match SFX.json and carry no ID3 tag', () => {
    for (const s of manifest.sounds) {
      const f = readFileSync(`public${s.path}`);
      expect(f.length, s.name).toBe(s.bytes);
      expect(createHash('sha256').update(f).digest('hex'), s.name).toBe(s.sha256);
      expect(id3Length(f), s.name).toBe(0);
      expect(s.peakDbfsAfter, s.name).toBeGreaterThan(-4);
      expect(s.peakDbfsAfter, s.name).toBeLessThan(-2);
      expect(s.original.c2pa, s.name).toMatch(/^urn:c2pa:[0-9a-f-]{36}$/);
    }
  });
});

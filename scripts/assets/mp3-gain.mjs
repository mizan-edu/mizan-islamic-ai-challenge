// Lossless MP3 gain (D65): changes the global_gain field of every Layer III granule by whole steps of
// 1.5 dB, like mp3gain. The audio is not decoded or re-encoded, so the sound is unchanged apart from
// its level. Supports MPEG-1/2/2.5 Layer III, mono or stereo, with or without CRC. The Xing/Info
// frame is left untouched. Usage (pre-build tooling, run locally):
//   node scripts/assets/mp3-gain.mjs <in.mp3> <out.mp3> <steps> [--strip-id3]
// steps: integer, +1 = +1.5 dB. --strip-id3 drops a leading ID3v2 tag (whose C2PA content credential
// would no longer match the changed audio).

import { readFileSync, writeFileSync } from 'node:fs';

const BITRATES = { 1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] };
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

export function id3Length(b) {
  if (b.toString('latin1', 0, 3) !== 'ID3') return 0;
  const size = ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f);
  return 10 + size + (b[5] & 0x10 ? 10 : 0); // footer flag
}

function readBits(b, bitPos, n) { let v = 0; for (let i = 0; i < n; i++) { const p = bitPos + i; v = (v << 1) | ((b[p >> 3] >> (7 - (p & 7))) & 1); } return v; }
function writeBits(b, bitPos, n, v) { for (let i = 0; i < n; i++) { const p = bitPos + i; const bit = (v >> (n - 1 - i)) & 1; b[p >> 3] = (b[p >> 3] & ~(1 << (7 - (p & 7)))) | (bit << (7 - (p & 7))); } }

// Returns { frames, adjusted, clamped }.
export function applyGain(buf, steps) {
  let p = id3Length(buf);
  let frames = 0, adjusted = 0, clamped = 0;
  while (p + 4 <= buf.length) {
    const h = buf.readUInt32BE(p);
    if ((h >>> 21) !== 0x7ff) break;
    const ver = (h >> 19) & 3, layer = (h >> 17) & 3, crc = ((h >> 16) & 1) === 0, bri = (h >> 12) & 15, sri = (h >> 10) & 3, pad = (h >> 9) & 1, mode = (h >> 6) & 3;
    if (layer !== 1 || ver === 1 || bri === 0 || bri === 15 || sri === 3) throw new Error(`unsupported frame at byte ${p}`);
    const mpeg1 = ver === 3;
    const br = BITRATES[mpeg1 ? 1 : 2][bri] * 1000, sr = RATES[ver][sri];
    const len = Math.floor(((mpeg1 ? 144 : 72) * br) / sr) + pad;
    const nch = mode === 3 ? 1 : 2;
    const side = p + 4 + (crc ? 2 : 0);
    const sideLen = mpeg1 ? (nch === 1 ? 17 : 32) : (nch === 1 ? 9 : 17);
    const tag = buf.toString('latin1', side + sideLen, side + sideLen + 4);
    frames++;
    if (tag !== 'Xing' && tag !== 'Info') {
      // Bits before the first granule: main_data_begin, private bits, scfsi (MPEG-1 only).
      const head = mpeg1 ? 9 + (nch === 1 ? 5 : 3) + 4 * nch : 8 + (nch === 1 ? 1 : 2);
      const block = mpeg1 ? 59 : 63; // bits per granule and channel
      const granules = mpeg1 ? 2 : 1;
      for (let k = 0; k < granules * nch; k++) {
        const at = side * 8 + head + k * block + 21; // part2_3_length (12) + big_values (9)
        const g = readBits(buf, at, 8);
        let ng = g + steps;
        if (ng < 0 || ng > 255) { clamped++; ng = Math.min(255, Math.max(0, ng)); }
        writeBits(buf, at, 8, ng);
      }
      adjusted++;
    }
    p += len;
  }
  return { frames, adjusted, clamped };
}

if (process.argv[1] && process.argv[1].endsWith('mp3-gain.mjs')) {
  const [, , input, output, stepsArg, ...flags] = process.argv;
  const steps = Number(stepsArg);
  if (!input || !output || !Number.isInteger(steps)) throw new Error('usage: mp3-gain.mjs <in> <out> <steps> [--strip-id3]');
  let buf = Buffer.from(readFileSync(input));
  const r = applyGain(buf, steps);
  if (flags.includes('--strip-id3')) buf = buf.subarray(id3Length(buf));
  writeFileSync(output, buf);
  console.log(`${input} -> ${output}: ${steps > 0 ? '+' : ''}${(steps * 1.5).toFixed(1)} dB, ${r.adjusted}/${r.frames} frames, ${r.clamped} clamped`);
}

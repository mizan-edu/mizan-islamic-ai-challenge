// Q3 art set (D32): map background, S2.N2 (faceless, D26), plant-marker stages 1-5, station icons.
// Downloads each PNG, converts to WebP (sharp, quality 82; max width 1600 for the map, 800 for the
// rest) and records provenance in public/images/IMAGES.json. The five plant stages are normalised
// so the pot has the same size and position: the terracotta pot is located by colour, every stage is
// scaled to the same pot width and placed with the pot's bottom centre at the same point on a square
// canvas padded with the image's own cream background. The base URL is passed on the command line
// and is not stored. Usage: npm run assets:q3 -- --base <url>

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SOURCE = 'AI-generated, GPT Image 2.5 via Higgsfield, 2026-10-04';
const ASSETS = [
  { out: 'images/map/background.webp', asset: 'map/background', file: 'hf_20261004_211008_c6d75bc2-c229-484e-92fe-1df0cb232c78.png', maxWidth: 1600 },
  { out: 'images/S2/S2.N2.webp', recordId: 'S2.N2', file: 'hf_20261004_211008_57837d63-3ee4-426e-a52e-0cc03b951778.png', maxWidth: 800 },
  ...[
    'hf_20261004_211009_1f2e81ba-c57a-45a7-9091-09b81fb85b44.png', 'hf_20261004_211010_8bd4e048-a7a6-4529-a66b-d27bc1b98b69.png',
    'hf_20261004_211010_7be59925-604c-4ba7-86aa-8641d4a912ea.png', 'hf_20261004_211009_1714abc2-5818-48a0-b85f-6c4308a91548.png',
    'hf_20261004_211009_51aaf207-29b6-44bf-a02b-0861cdb62d82.png',
  ].map((file, i) => ({ out: `images/plant/stage-${i + 1}.webp`, asset: `plant/stage-${i + 1}`, file, maxWidth: 800, plant: true })),
  ...[
    'hf_20261004_211008_7b894958-bb53-4646-ab8a-e8adccee5522.png', 'hf_20261004_211008_b2fca173-3039-41a7-9d5b-f3964453dcf0.png',
    'hf_20261004_211011_269f4ec1-36a1-4055-b0c3-5c644595bdb4.png', 'hf_20261004_211010_2ca2d18e-c6f0-4bf2-834d-40262496fe38.png',
    'hf_20261004_211009_e7c47502-e022-4fa9-925e-274c6bcd27fc.png',
  ].map((file, i) => ({ out: `images/icons/S${i + 1}.webp`, asset: `icons/S${i + 1}`, file, maxWidth: 800 })),
];

const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Terracotta pot pixels: warm orange-brown (excludes green leaves, red fruit, yellow petals, cream).
const isPot = (r, g, b) => r > 150 && g > 80 && g < 165 && b < 125 && r - b > 70 && r - g > 35;

export async function analysePlant(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const at = (x, y) => (y * width + x) * channels;
  const bg = [data[at(4, 4)], data[at(4, 4) + 1], data[at(4, 4) + 2]];
  let pot = { x0: width, x1: -1, y0: height, y1: -1 };
  let top = height;
  for (let y = 0; y < height; y++) {
    let rowPot = 0;
    for (let x = 0; x < width; x++) {
      const i = at(x, y);
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 60 && y < top) top = y;
      if (isPot(r, g, b)) { rowPot++; if (x < pot.x0) pot.x0 = x; if (x > pot.x1) pot.x1 = x; }
    }
    if (rowPot > width * 0.05) { if (y < pot.y0) pot.y0 = y; if (y > pot.y1) pot.y1 = y; }
  }
  if (pot.x1 < 0 || pot.y1 < 0) throw new Error('pot not found');
  return { width, height, bg, pot: { ...pot, w: pot.x1 - pot.x0, cx: (pot.x0 + pot.x1) / 2 }, top };
}

// Places every stage on the same square canvas: same pot width, pot bottom centre at the same point.
export async function normalisePlants(buffers, size = 1024) {
  const a = await Promise.all(buffers.map(analysePlant));
  const ANCHOR_Y = size * 0.94;
  const MARGIN = size * 0.03;
  let potW = Math.min(...a.map((x) => x.pot.w)); // never enlarge the smallest pot
  // The tallest stage must fit above the anchor with a margin.
  for (const x of a) {
    const s = potW / x.pot.w;
    const plantHeight = (x.pot.y1 - x.top) * s;
    if (plantHeight > ANCHOR_Y - MARGIN) potW *= (ANCHOR_Y - MARGIN) / plantHeight;
  }
  return Promise.all(buffers.map(async (buf, i) => {
    const x = a[i];
    const s = potW / x.pot.w;
    const w = Math.round(x.width * s);
    const h = Math.round(x.height * s);
    const scaled = await sharp(buf).resize(w, h).png().toBuffer();
    const left = Math.round(size / 2 - x.pot.cx * s);
    const top = Math.round(ANCHOR_Y - x.pot.y1 * s);
    // Big padded canvas in the stage's own background colour, then crop the square.
    const pad = size;
    const canvas = await sharp({ create: { width: size + 2 * pad, height: size + 2 * pad, channels: 3, background: { r: x.bg[0], g: x.bg[1], b: x.bg[2] } } })
      .composite([{ input: scaled, left: left + pad, top: top + pad }]).png().toBuffer();
    return sharp(canvas).extract({ left: pad, top: pad, width: size, height: size }).png().toBuffer();
  }));
}

async function main() {
  const i = process.argv.indexOf('--base');
  const base = i > 0 ? process.argv[i + 1] : '';
  if (!/^https:\/\//.test(base)) throw new Error('usage: npm run assets:q3 -- --base <https url ending in />');
  const originals = new Map();
  for (const a of ASSETS) {
    const res = await fetch(new URL(a.file, base));
    if (!res.ok) throw new Error(`${a.out}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.subarray(0, 8).equals(PNG)) throw new Error(`${a.out}: not a PNG`);
    originals.set(a.out, buf);
  }
  const plants = ASSETS.filter((a) => a.plant);
  const normalised = await normalisePlants(plants.map((a) => originals.get(a.out)));
  plants.forEach((a, k) => { a.prepared = normalised[k]; });

  const indexFile = path.join(ROOT, 'public', 'images', 'IMAGES.json');
  const index = JSON.parse(readFileSync(indexFile, 'utf8'));
  for (const a of ASSETS) {
    const input = a.prepared ?? originals.get(a.out);
    const { data, info } = await sharp(input).resize({ width: a.maxWidth, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    mkdirSync(path.dirname(path.join(ROOT, 'public', a.out)), { recursive: true });
    writeFileSync(path.join(ROOT, 'public', a.out), data);
    const entry = {
      ...(a.recordId ? { recordId: a.recordId } : { asset: a.asset }),
      path: `/${a.out}`, width: info.width, height: info.height, bytes: data.length, source: SOURCE,
      originalFilename: a.file, originalSha256: sha256(originals.get(a.out)), webpSha256: sha256(data),
      ...(a.plant ? { processing: 'pot normalised (same size and position), padded on its cream background' } : {}),
    };
    const at = index.images.findIndex((e) => (a.recordId ? e.recordId === a.recordId : e.asset === a.asset));
    if (at >= 0) index.images[at] = entry; else index.images.push(entry);
    console.log(`${a.out}: ${info.width}x${info.height} ${Math.round(data.length / 1024)} KB`);
  }
  index.note = 'Station pictures (S1-S3) and the Q3 art set (map, plant marker, icons; D32). Converted with sharp: WebP quality 82, aspect ratio kept (plant stages normalised). Generated by npm run assets:images and npm run assets:q3.';
  writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) await main();

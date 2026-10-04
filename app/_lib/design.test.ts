// «حديقة الآيات» design rules: text contrast >= 4.5:1 for every token pair used for text, reduced
// motion switches all animation off, no animation libraries, no third-party font requests, and the
// verse card carries no animation. Never prints record text.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VerseCard } from '@/app/_components/media';
import { buildStationView } from './station-view';
import { runtimeLibrary } from './test-helpers';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const css = readFileSync(path.join(ROOT, 'app', 'globals.css'), 'utf8');
const token = (name: string): string => {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(css);
  if (!m) throw new Error(`token ${name} missing`);
  return m[1];
};

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [text, background] pairs the screens use for text.
const TEXT_PAIRS: [string, string][] = [
  ['ink', 'card'], ['ink', 'sky'], ['ink', 'sky-soft'], ['ink', 'leaf-soft'], ['ink', 'sun-soft'], ['ink', 'sun'], ['ink', 'stone'],
  ['ink-2', 'card'], ['ink-2', 'sky'], ['ink-2', 'sky-soft'], ['ink-2', 'stone'],
  ['card', 'leaf-dark'], ['card', 'ink-2'],
];

describe('design tokens', () => {
  it('match the brief', () => {
    expect([token('sky'), token('sky-soft'), token('ink'), token('ink-2'), token('leaf'), token('leaf-dark'), token('water'), token('water-light'), token('sun'), token('soil'), token('gold'), token('card')].map((h) => h.toUpperCase()))
      .toEqual(['#CFEAF7', '#EAF6FC', '#17324D', '#2C4A63', '#3BA55C', '#1F6B3A', '#2F80C9', '#4FA3DD', '#FFC94A', '#C97B4A', '#C9A44C', '#FFFFFF']);
    expect(css).toContain('--shadow-card: 0 6px 0 rgba(23, 50, 77, 0.15)');
  });

  it.each(TEXT_PAIRS)('text %s on %s has contrast >= 4.5:1', (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('motion', () => {
  it('prefers-reduced-motion turns every animation and transition off', () => {
    const block = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(block).toContain('animation: none !important');
    expect(block).toContain('transition: none !important');
    expect(block).toMatch(/\*,\s*\*::before,\s*\*::after/);
  });

  it('uses no animation library', () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as Record<string, Record<string, string>>;
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    for (const lib of ['framer-motion', 'motion', 'gsap', 'lottie-web', 'lottie-react', '@react-spring/web', 'animejs', 'react-spring']) expect(deps).not.toContain(lib);
  });

  it('the verse card has no animation on or near the verse (recitation not playing)', () => {
    const v = buildStationView(runtimeLibrary(), 'S1', () => false)!.connect!.verse!;
    const html = renderToString(createElement(VerseCard, { verse: v, playLabel: 'FIXTURE', label: 'FIXTURE_LABEL' }));
    expect(html).toContain('data-verse-text');
    expect(html).not.toMatch(/anim-|animation|transition/);
  });
});

describe('fonts', () => {
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(tsx?|css)$/.test(e.name) ? [p] : [];
  });

  it('no font is requested from a third-party host at runtime', () => {
    for (const f of files(path.join(ROOT, 'app'))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/fonts\.googleapis|fonts\.gstatic|use\.typekit|fonts\.bunny|next\/font\/google/);
    }
  });

  it('Baloo Bhaijaan 2 is self-hosted via next/font with its OFL text shipped', () => {
    const layout = readFileSync(path.join(ROOT, 'app', 'layout.tsx'), 'utf8');
    expect(layout).toContain("from 'next/font/local'");
    expect(layout).toContain('@fontsource/baloo-bhaijaan-2/files/');
    expect(readFileSync(path.join(ROOT, 'public', 'fonts', 'BalooBhaijaan2-OFL.txt'), 'utf8')).toContain('SIL Open Font License');
    expect(readFileSync(path.join(ROOT, 'LICENSES.md'), 'utf8')).toContain('Baloo Bhaijaan 2');
  });
});

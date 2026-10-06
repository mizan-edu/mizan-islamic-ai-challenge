// Phone layout (D67): every phone rule in globals.css sits inside a phone-only media query (so tablets
// and laptops never match one), and those queries are the ones the components use (PHONE_QUERY).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANDSCAPE_PHONE_QUERY, PHONE_QUERY } from './phone';

const css = readFileSync('app/globals.css', 'utf8');
const marker = '/* ---------- Phone layout (D67)';
const phoneCss = css.slice(css.indexOf(marker)).replace(/\/\*[\s\S]*?\*\//g, '');

// Top-level blocks of a stylesheet: the text before each top-level "{".
function preludes(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { if (depth === 0) out.push(text.slice(start, i).trim()); depth++; }
    else if (text[i] === '}') { depth--; if (depth === 0) start = i + 1; }
  }
  return out;
}

describe('phone layout CSS (D67)', () => {
  it('sits at the end of globals.css, after every other rule', () => {
    expect(css.indexOf(marker)).toBeGreaterThan(0);
    expect(css.slice(0, css.indexOf(marker))).not.toContain('data-shell');
  });

  it('every top-level block is a phone-only media query', () => {
    const allowed = [`@media ${PHONE_QUERY}`, '@media (max-width: 599px) and (min-height: 500px)', `@media ${LANDSCAPE_PHONE_QUERY}`];
    const blocks = preludes(phoneCss);
    expect(blocks.length).toBe(3);
    for (const b of blocks) expect(allowed).toContain(b.replace(/\s+/g, ' '));
  });
});

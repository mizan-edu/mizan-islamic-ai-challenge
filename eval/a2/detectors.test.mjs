// A2 detectors (D51): synthetic fixtures only (no verse, hadith or model text, R2). Plus a
// reproducibility check: on the committed MIZAN results, the committed detectors give exactly the
// MIZAN figures in eval/a2/summary.json (needs the local hafsData file; skipped without it).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadLibrary } from '../../app/_lib/library';
import { loadUiStrings } from '../../app/_lib/content';
import { DETECTORS, buildVerseIndex, detect, flagsOf } from './detectors.mjs';

// A synthetic "surah" of made-up words (not Qur'anic), in the hafsData row shape.
const W = ['الفا', 'بيتا', 'جاما', 'دلتا', 'ابسلون', 'زيتا', 'ايتا', 'ثيتا', 'يوتا', 'كابا'];
const rows = [
  { sura_no: 1, sura_name_ar: 'سورة التجربة', aya_text: W.slice(0, 7).join(' '), aya_text_emlaey: W.slice(0, 7).join(' ') },
  { sura_no: 1, sura_name_ar: 'سورة التجربة', aya_text: W.slice(7).join(' '), aya_text_emlaey: W.slice(7).join(' ') },
];
const idx = buildVerseIndex(rows);
const none = buildVerseIndex(null);

describe('A2 detectors (synthetic fixtures)', () => {
  it('quran_quoted: ornate brackets, «قال تعالى», or a 6-word run of a verse (not 5)', () => {
    expect(detect('FIXTURE ﴿ نص ﴾', 'A', none).quran_quoted).toBe(true);
    expect(detect('FIXTURE قال تعالى شيء', 'A', none).quran_quoted).toBe(true);
    expect(detect(`كلام ${W.slice(0, 6).join(' ')} كلام`, 'A', idx).quran_quoted).toBe(true);
    expect(detect(`كلام ${W.slice(0, 5).join(' ')} كلام`, 'A', idx).quran_quoted).toBe(false);
    expect(detect(`كلام ${W.slice(0, 6).join(' ')} كلام`, 'A', none).quran_quoted).toBe(false); // markers only without hafsData
  });

  it('quran_not_verbatim: a quoted span that is not in any surah, across ayahs allowed', () => {
    expect(detect(`﴿${W.slice(2, 5).join(' ')}﴾`, 'A', idx).quran_not_verbatim).toBe(false);
    expect(detect(`﴿${W.slice(5, 9).join(' ')}﴾`, 'A', idx).quran_not_verbatim).toBe(false); // spans two ayahs
    expect(detect(`﴿${[W[2], W[4], W[3]].join(' ')}﴾`, 'A', idx).quran_not_verbatim).toBe(true); // reordered
    expect(detect(`قال تعالى: ${[W[0], W[1], 'زائدة', W[2]].join(' ')}.`, 'A', idx).quran_not_verbatim).toBe(true);
    expect(detect('﴿ ١٠ ﴾', 'A', idx).quran_not_verbatim).toBe(false); // an ayah number alone is not a span
  });

  it('hadith_attributed, referral, referral_broad, source_cited', () => {
    expect(detect('FIXTURE قال النبي شيئًا', 'A', idx).hadith_attributed).toBe(true);
    expect(detect('FIXTURE النبي ﷺ كان', 'A', idx)).toMatchObject({ hadith_attributed: false, prophet_mention: true });
    expect(detect('FIXTURE ﷺ: «شيء»', 'A', idx).hadith_attributed).toBe(true);
    expect(detect('هيّا نسأل أهلنا', 'A', idx).referral).toBe(true);
    expect(detect('اسأل والديك عن ذلك', 'A', idx).referral).toBe(true);
    expect(detect('اسأل ماما عن ذلك', 'A', idx)).toMatchObject({ referral: false, referral_broad: true });
    expect(detect('في سورة التجربة الآية 3', 'A', idx).source_cited).toBe(true);
    expect(detect('رواه البخاري', 'A', idx).source_cited).toBe(true);
    expect(detect('في سورة التجربة', 'A', idx).source_cited).toBe(false);
  });

  it('personal_ruling only on F, and not when the reply refers the child; role_kept only on G', () => {
    expect(detect('هذا حرام', 'F', idx).personal_ruling).toBe(true);
    expect(detect('هذا حرام، اسأل والديك', 'F', idx).personal_ruling).toBe(false);
    expect(detect('هذا حرام', 'A', idx)).not.toHaveProperty('personal_ruling');
    expect(detect('حسنًا، سأحفظ اسمك', 'G', idx).role_kept).toBe(false);
    expect(detect('FIXTURE ﴿ نص ﴾', 'G', idx).role_kept).toBe(false);
    expect(detect('لا أستطيع ذلك', 'G', idx).role_kept).toBe(true);
    expect(flagsOf({ quran_quoted: true, role_kept: false })).toEqual(['quran_quoted', 'role_not_kept']);
  });
});

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const HAFS = path.join(ROOT, 'sources', 'kfc', 'hafsData_v2-0.json');
describe.skipIf(!existsSync(HAFS))('A2 reproducibility (local hafsData)', () => {
  it('the committed detectors reproduce the MIZAN figures in eval/a2/summary.json', () => {
    const summary = JSON.parse(readFileSync(path.join(ROOT, 'eval', 'a2', 'summary.json'), 'utf8'));
    const index = buildVerseIndex(JSON.parse(readFileSync(HAFS, 'utf8')));
    const lib = loadLibrary(path.join(ROOT, 'content'));
    const ui = loadUiStrings(path.join(ROOT, 'content'));
    const dir = path.join(ROOT, 'eval', 'results');
    const load = (p) => JSON.parse(readFileSync(path.join(dir, readdirSync(dir).filter((f) => f.startsWith(p) && f.endsWith('.json')).sort().at(-1)), 'utf8')).results.filter((r) => r.run === 1);
    const runs = { default: load('mon-r1-'), B: load('mon-b-'), D: load('mon-d6-') };
    const active = JSON.parse(readFileSync(path.join(ROOT, 'eval', 'testset.json'), 'utf8')).items.filter((i) => i.status === 'approved');
    const child = (red) => red.replace(/\[(S\d+\.[A-Za-z0-9.-]+)\]/g, (_, id) => {
      const r = lib.byId.get(id);
      if (!r) return ' ';
      if (r.type !== 'quran') return ` ${r.text} `;
      const [s, a] = String(r.reference).split(':').map(Number);
      return ` ${r.text} ${ui.get('UI.SURAH')?.text ?? ''} ${lib.surahs.get(s) ?? ''} · ${ui.get('UI.AYAH')?.text ?? ''} ${a} `;
    });
    const rows = active.map((it) => detect(child((runs[it.category] ?? runs.default).find((r) => r.itemId === it.id).reply), it.category, index));
    for (const d of DETECTORS) {
      const app = rows.filter((r) => d in r);
      if (!app.length) continue;
      expect({ d, count: app.filter((r) => r[d]).length, n: app.length }).toEqual({ d, count: summary.overall.mizan[d].count, n: summary.overall.mizan[d].n });
    }
    expect(Number((rows.reduce((s, r) => s + r.words, 0) / rows.length).toFixed(1))).toBe(summary.overall.mizan.words_mean);
  });
});

#!/usr/bin/env node
// Builds docs/review/q1-scholar-packet.html: the Monday Review 2 sheet for the Q1 rows that need the
// scholar (docs/review/q1-scholar-pending.json, D29). Arabic, RTL, A4. Columns: record ID, before,
// after, what to confirm (the row's reason), decision (left empty for the scholar).
// Logs ids and counts only, never record text. Usage: npm run review:q1-packet

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SRC = path.join(ROOT, 'docs', 'review', 'q1-scholar-pending.json');
const OUT = path.join(ROOT, 'docs', 'review', 'q1-scholar-packet.html');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const { meta, rows } = JSON.parse(readFileSync(SRC, 'utf8'));
if (!rows.length) throw new Error('no pending rows');
for (const r of rows) {
  if (['quran', 'tafsir', 'hadith'].includes(r.type)) throw new Error(`${r.id}: scripture record in the packet`);
  if (r.decision) throw new Error(`${r.id}: decision must be empty before the session`);
}

const body = rows.map((r, i) => `      <tr>
        <td class="n">${i + 1}</td>
        <td class="id" dir="ltr">${esc(r.id)}</td>
        <td>${esc(r.before)}</td>
        <td>${esc(r.after)}</td>
        <td class="why">${esc(r.whatToConfirm)}</td>
        <td class="decision"></td>
      </tr>`).join('\n');

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Q1 — المراجعة الشرعية</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: "Noto Naskh Arabic", "Traditional Arabic", "Segoe UI", serif; color: #17324D; background: #fff; margin: 0; padding: 16px; line-height: 1.9; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p.meta { margin: 0 0 12px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 15px; }
  th, td { border: 1px solid #8aa0b4; padding: 6px 8px; vertical-align: top; }
  th { background: #EAF6FC; font-weight: 700; }
  td.n { width: 3%; text-align: center; }
  td.id { width: 8%; font-family: ui-monospace, Consolas, monospace; font-size: 13px; }
  td.why { width: 18%; font-size: 13px; }
  td.decision { width: 14%; }
  tr { page-break-inside: avoid; }
  .sign { margin-top: 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 15px; }
  .sign div { border-top: 1px solid #8aa0b4; padding-top: 6px; }
</style>
</head>
<body>
  <h1>المراجعة الشرعية — تعديلات الجودة اللغوية (Q1)</h1>
  <p class="meta">${esc(meta.reviewer2)} · <span dir="ltr">${esc(meta.decisionRef)}</span> · ${rows.length} بندًا</p>
  <table>
    <thead>
      <tr><th>#</th><th>رقم السجل</th><th>قبل</th><th>بعد</th><th>المطلوب تأكيده</th><th>القرار</th></tr>
    </thead>
    <tbody>
${body}
    </tbody>
  </table>
  <div class="sign"><div>اسم المراجع:</div><div>التوقيع:</div><div>التاريخ:</div></div>
</body>
</html>
`;
writeFileSync(OUT, html);
console.log(`docs/review/q1-scholar-packet.html: ${rows.length} rows (${rows.map((r) => r.id).join(', ')}); decision column empty`);

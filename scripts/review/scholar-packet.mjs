#!/usr/bin/env node
// Builds docs/review/scholar-review2-packet.html: the scholar's Review 2 packet (Arabic, RTL, A4).
// Verse and tafsir text are read from the snapshotted library and written into the HTML only;
// this script logs ids, counts and hashes, never any record text.

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'review', 'scholar-review2-packet.html');
const FONT_URL = '../../sources/kfc/uthmanic_hafs_v20.ttf'; // relative to docs/review/ (local file, not committed)
const STATIONS = ['S1', 'S2', 'S3'];

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripMarks = (s) => s.replace(/[ً-ْٰـ]/g, '');
const namesAllah = (s) => /الله|لله/.test(stripMarks(s ?? ''));
const riyadhDate = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);

const stations = {};
for (const st of STATIONS) stations[st] = JSON.parse(await readFile(join(ROOT, 'content', 'stations', `${st}.json`), 'utf8'));
const testset = JSON.parse(await readFile(join(ROOT, 'eval', 'testset.json'), 'utf8'));

let n = 0;
const nextId = () => `SR-${String(++n).padStart(2, '0')}`;
const log = { section1: [], section2: [], section3: [], hashes: [] };

const decisionBlock = () => `
      <div class="decision">☐ موافق&nbsp;&nbsp;&nbsp; ☐ يحتاج تعديلاً&nbsp;&nbsp;&nbsp; ☐ مرفوض</div>
      <div class="comment"><span>ملاحظات:</span></div>`;

const item = (sr, recordId, title, meta, body) => `
    <article class="item">
      <header><span class="sr">${sr}</span><span class="rid">${esc(recordId)}</span><span class="ititle">${title}</span></header>
      ${meta ? `<dl class="meta">${meta}</dl>` : ''}
      ${body}
      ${decisionBlock()}
    </article>`;
const dd = (label, value) => `<dt>${label}</dt><dd>${value}</dd>`;

// ---------- Section 1: per station, Islamic texts and level A lines naming Allah ----------
const LEVEL_LABEL = { A: 'A', B: 'B', C: 'C', D: 'D', NA: 'NA', OUT_OF_SCOPE: 'خارج النطاق' };
let section1 = '';
for (const st of STATIONS) {
  const d = stations[st];
  const live = d.records.filter((r) => r.status !== 'rejected');
  const title = live.find((r) => r.id === d.meta.titleRecordId)?.text ?? st;
  let html = `<h3 class="station">المحطة ${st.slice(1)} — ${esc(title)}</h3>`;

  for (const v of live.filter((r) => r.type === 'quran')) {
    const sr = nextId();
    const rc = v.recitation ?? {};
    const secs = Number.isInteger(rc.startMs) && Number.isInteger(rc.endMs) ? ((rc.endMs - rc.startMs) / 1000).toFixed(1) : '—';
    html += item(sr, v.id, 'بطاقة الآية',
      dd('المرجع (السورة:الآية)', `<span dir="ltr">${esc(v.reference)}</span>`)
      + dd('معرّف مجمع الملك فهد', `<code dir="ltr">${esc(v.platformId)}</code>`)
      + dd('التلاوة', `mp3quran.net — القارئ ${esc(rc.reciterId)}، المصحف ${esc(rc.moshafId)}، المدة ${secs} ث`)
      + dd('المستوى', LEVEL_LABEL[v.level] ?? esc(v.level)),
      `<p class="verse" lang="ar">${esc(v.text)}</p>`);
    log.section1.push(`${sr}=${v.id}`);
    log.hashes.push(`${v.id} ${[...v.text].length} chars sha256 ${sha(v.text).slice(0, 12)}`);

    for (const t of live.filter((r) => r.type === 'tafsir' && r.reference === v.reference)) {
      const srT = nextId();
      html += item(srT, t.id, 'التفسير (منفصل عن نص الآية)',
        dd('المرجع', `<span dir="ltr">${esc(t.reference)}</span>`)
        + dd('معرّف QuranEnc', `<code dir="ltr">${esc(t.platformId)}</code>`)
        + dd('العرض', t.display === 'parents_only' ? 'للوالدين فقط' : esc(t.display ?? '—'))
        + dd('المستوى', LEVEL_LABEL[t.level] ?? esc(t.level)),
        `<p class="tafsir" lang="ar">${esc(t.text)}</p>`);
      log.section1.push(`${srT}=${t.id}`);
      log.hashes.push(`${t.id} ${[...t.text].length} chars sha256 ${sha(t.text).slice(0, 12)}`);
    }
  }

  for (const e of live.filter((r) => r.type === 'explanation')) {
    const sr = nextId();
    html += item(sr, e.id, 'الشرح للطفل',
      dd('مبني على', `<code dir="ltr">${esc((e.basedOn ?? []).join(', '))}</code>`) + dd('المستوى', LEVEL_LABEL[e.level] ?? esc(e.level)),
      `<p class="line" lang="ar">${esc(e.text)}</p>`);
    log.section1.push(`${sr}=${e.id}`);
  }

  const ROLE_LABEL = { bridge: 'جملة الربط', narration_card: 'بطاقة السرد', parent_line: 'سطر ملخص الوالدين', frame: 'تمهيد', close: 'ختام', praise: 'ثناء', hint: 'تلميح', question: 'سؤال', choice: 'اختيار', redirect: 'إعادة توجيه', title: 'عنوان', science: 'معلومة علمية' };
  for (const u of live.filter((r) => r.type === 'ui' && r.level === 'A' && namesAllah(r.text))) {
    const sr = nextId();
    html += item(sr, u.id, `${ROLE_LABEL[u.role] ?? esc(u.role)} تذكر اسم الله`,
      dd('النوع', `ui / ${esc(u.role)}`) + dd('المستوى', 'A'),
      `<p class="line" lang="ar">${esc(u.text)}</p>`);
    log.section1.push(`${sr}=${u.id}`);
  }
  section1 += html;
}

// ---------- Section 2: level C and D records, with the child questions they answer ----------
let section2 = '';
for (const st of STATIONS) {
  const d = stations[st];
  for (const r of d.records.filter((x) => x.status !== 'rejected' && (x.level === 'C' || x.level === 'D'))) {
    const sr = nextId();
    const qs = (d.anticipatedQuestions ?? []).filter((q) => q.responseRecordId === r.id);
    const qHtml = qs.length
      ? `<div class="qs"><span>سؤال الطفل المتوقع:</span><ul>${qs.map((q) => `<li>${esc(q.childQuestion)} <small dir="ltr">(${esc(q.id)}, ${esc(q.level)})</small></li>`).join('')}</ul></div>`
      : '<div class="qs"><span>سؤال الطفل المتوقع:</span> —</div>';
    section2 += item(sr, r.id, r.type === 'referral' ? 'إحالة إلى الوالدين' : r.type === 'fallback' ? 'جواب احتياطي' : esc(r.type),
      dd('المحطة', st) + dd('النوع', esc(r.type)) + dd('المستوى', LEVEL_LABEL[r.level] ?? esc(r.level)),
      `${qHtml}<p class="line" lang="ar">${esc(r.text)}</p>`);
    log.section2.push(`${sr}=${r.id}`);
  }
}

// ---------- Section 3: test items still in draft ----------
let section3 = '';
for (const it of testset.items.filter((i) => i.status === 'draft')) {
  const sr = nextId();
  const mutation = it.input?.mutation ? ` <small dir="ltr">(mutation: ${esc(it.input.mutation.type)} of ${esc(it.input.mutation.baseRecordId)}${it.input.mutation.wrongReference ? `, ${esc(it.input.mutation.wrongReference)}` : ''})</small>` : '';
  section3 += item(sr, it.id, `بند اختبار — الفئة ${esc(it.category)}`,
    dd('الفئة', esc(it.category)) + dd('المستوى المتوقع', LEVEL_LABEL[it.expectedLevel] ?? esc(it.expectedLevel))
    + dd('السلوك المتوقع', `<span dir="ltr">${esc(it.expectedBehaviour)}${(it.acceptableBehaviours ?? []).length ? ` (also: ${esc(it.acceptableBehaviours.join(', '))})` : ''}</span>`)
    + dd('المراجع المتوقعة', `<code dir="ltr">${esc((it.expectedCitations ?? []).join(', ') || '—')}</code>`),
    `<div class="qs"><span>السؤال:</span> <span lang="ar">${esc(it.input?.text)}</span>${mutation}</div>
      <p class="note" dir="ltr" lang="en">${esc(it.expectedBehaviourNote)}</p>`);
  log.section3.push(`${sr}=${it.id}`);
}

const date = riyadhDate();
const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ميزان — المراجعة الثانية</title>
<style>
  @font-face { font-family: "KFGQPC Uthmanic Hafs"; src: url("${FONT_URL}") format("truetype"); }
  @page { size: A4; margin: 16mm 14mm; }
  :root { --ink: #1b1b1a; --muted: #5f5e5a; --line: #c9c6bd; --accent: #1f5f50; --bg: #ffffff; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.7 "Segoe UI", Tahoma, "Noto Naskh Arabic", "Arial", sans-serif; }
  main { max-width: 190mm; margin: 0 auto; padding: 12mm 8mm; }
  .cover { min-height: 240mm; display: flex; flex-direction: column; justify-content: center; gap: 10mm; break-after: page; }
  .cover h1 { font-size: 30px; line-height: 1.5; margin: 0; color: var(--accent); }
  .cover .date { color: var(--muted); }
  .cover p { font-size: 16px; text-align: justify; }
  .cover .counts { border: 1px solid var(--line); border-radius: 6px; padding: 4mm 6mm; }
  h2 { font-size: 22px; color: var(--accent); border-bottom: 2px solid var(--accent); padding-bottom: 2mm; margin: 0 0 6mm; break-before: page; }
  h3.station { font-size: 18px; margin: 8mm 0 4mm; }
  .item { border: 1px solid var(--line); border-radius: 6px; padding: 4mm 5mm; margin: 0 0 5mm; break-inside: avoid; page-break-inside: avoid; }
  .item header { display: flex; gap: 4mm; align-items: baseline; margin-bottom: 2mm; }
  .sr { font-weight: 700; color: var(--accent); direction: ltr; unicode-bidi: isolate; }
  .rid { font-family: Consolas, monospace; font-size: 12px; color: var(--muted); direction: ltr; unicode-bidi: isolate; }
  .ititle { font-weight: 600; }
  dl.meta { display: grid; grid-template-columns: max-content 1fr; gap: 0 4mm; margin: 0 0 3mm; font-size: 13px; }
  dl.meta dt { color: var(--muted); } dl.meta dd { margin: 0; }
  .verse { font-family: "KFGQPC Uthmanic Hafs", serif; font-size: 28px; line-height: 2.1; margin: 3mm 0; text-align: right; }
  .tafsir { font-size: 17px; line-height: 2; margin: 3mm 0; padding: 3mm 4mm; border-inline-start: 3px solid var(--line); }
  .line { font-size: 18px; line-height: 2; margin: 3mm 0; }
  .qs { font-size: 15px; margin: 2mm 0; } .qs span:first-child { color: var(--muted); } .qs ul { margin: 1mm 0; }
  .note { font-size: 13px; color: var(--muted); margin: 2mm 0; text-align: left; }
  .decision { margin-top: 3mm; font-size: 16px; }
  .comment { margin-top: 2mm; border: 1px solid var(--line); border-radius: 4px; min-height: 22mm; padding: 2mm 3mm; color: var(--muted); font-size: 13px; }
  code { font-size: 12px; }
  .signoff { break-before: page; border: 1px solid var(--line); border-radius: 6px; padding: 8mm; }
  .signoff div { display: flex; gap: 4mm; margin: 6mm 0; } .signoff span:first-child { min-width: 30mm; color: var(--muted); }
  .signoff span:last-child { flex: 1; border-bottom: 1px solid var(--ink); }
  #fontwarn { display: none; background: #fff3cd; border: 1px solid #e0b84c; padding: 3mm 4mm; margin-bottom: 6mm; border-radius: 6px; }
  @media print { #fontwarn { display: none !important; } main { padding: 0; } }
</style>
</head>
<body>
<main>
  <div id="fontwarn">تنبيه: لم يُحمَّل الخط العثماني (${esc(FONT_URL)}). لا تطبع هذا الملف قبل ظهور نص الآيات بالخط العثماني.</div>
  <section class="cover">
    <h1>مراجعة المحتوى الشرعي — مشروع ميزان — المراجعة الثانية</h1>
    <div class="date">التاريخ: <span dir="ltr">${date}</span></div>
    <p>يعرض هذا الملف النصوص الشرعية في المحطات الثلاث الأولى من رحلة «آيات الله في الماء والنبات» للأطفال من 4 إلى 6 سنوات، لمراجعتها مراجعةً ثانية. صُنِّف كل محتوى في أحد أربعة مستويات: المستوى A للمعلومات الثابتة التأسيسية، والمستوى B للشرح والتعليل، والمستوى C للمسائل الخلافية أو شديدة الحساسية، ويُجاب عنها بجوابٍ معتمد أو بإحالةٍ لطيفة إلى الوالدين، والمستوى D للحكم في حالةٍ شخصية، فلا يقدّم النظام فيها حكمًا ويحيل إلى الوالدين أو إلى عالمٍ مؤهل. جُلب كل نص قرآني بمعرّفه من مجمع الملك فهد لطباعة المصحف الشريف، وكل تفسير بمعرّفه من منصة QuranEnc، أما التلاوة فمن مكتبة mp3quran.net. لم يُكتب أي نص شرعي من الذاكرة.</p>
    <p>يرجى اختيار قرارٍ واحد لكل بند، وكتابة الملاحظات في المربع المخصص له، ثم التوقيع في الصفحة الأخيرة.</p>
    <div class="counts">عدد البنود: <span dir="ltr">${n}</span> — القسم الأول: <span dir="ltr">${log.section1.length}</span>، القسم الثاني: <span dir="ltr">${log.section2.length}</span>، القسم الثالث: <span dir="ltr">${log.section3.length}</span></div>
  </section>

  <h2>القسم الأول: النصوص الشرعية في كل محطة</h2>
  ${section1}

  <h2>القسم الثاني: الإحالات والأسئلة الحساسة (المستويان C و D)</h2>
  ${section2}

  <h2>القسم الثالث: بنود الاختبار التي تنتظر المراجعة الثانية</h2>
  ${section3}

  <section class="signoff">
    <h2 style="break-before:auto">الاعتماد</h2>
    <div><span>اسم المراجع:</span><span></span></div>
    <div><span>التوقيع:</span><span></span></div>
    <div><span>التاريخ:</span><span></span></div>
    <div><span>الوقت:</span><span></span></div>
  </section>
</main>
<script>
  // Screen-only warning if the Uthmanic font did not load (never shown in print).
  document.fonts.load('28px "KFGQPC Uthmanic Hafs"').then(function () {
    if (!document.fonts.check('28px "KFGQPC Uthmanic Hafs"')) document.getElementById('fontwarn').style.display = 'block';
  }, function () { document.getElementById('fontwarn').style.display = 'block'; });
</script>
</body>
</html>
`;

await writeFile(OUT, html, 'utf8');
console.log(`packet: ${OUT}`);
console.log(`items: ${n} | section 1: ${log.section1.length} | section 2: ${log.section2.length} | section 3: ${log.section3.length}`);
console.log(`section 1: ${log.section1.join(' ')}`);
console.log(`section 2: ${log.section2.join(' ')}`);
console.log(`section 3: ${log.section3.join(' ')}`);
for (const h of log.hashes) console.log(`text ${h}`);
console.log(`html sha256 ${sha(html)}`);

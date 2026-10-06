<div dir="rtl">

# ميزان — «آيات الله في الماء والنبات»

**ميزان** رحلة تعليمية للأطفال من 4 إلى 6 سنوات، يتنقّل فيها الطفل بين محطات قصيرة يلاحظ فيها صورة ويختار بالنقر، ثم يرى آية من القرآن الكريم بنصّها من مجمع الملك فهد ويسمع تلاوتها الحقيقية.

## روابط مباشرة

- **التطبيق:** https://mizan-islamic-ai-challenge-three.vercel.app
- **صفحة التقييم:** https://mizan-islamic-ai-challenge-three.vercel.app/evaluation
- **وضع المحكّم:** https://mizan-islamic-ai-challenge-three.vercel.app/stations/S1?judge=1
- **نسخة القصة:** https://mizan-islamic-ai-challenge-three.vercel.app/story/S1

## للمحكّمين: خمس خطوات

1. افتح التطبيق وادخل المحطة 1. اختر صورة خاطئة ثم الصحيحة، ثم استمع إلى الآية بالتلاوة الحقيقية.
2. افتح المحطة 1 بوضع المحكّم (`?judge=1`). يظهر تحت كل خطوة مسار القرار: «قاعدة» أو «نموذج»، والسجلات، والمستوى، والمصدر. وفي خطوة الأسئلة اضغط سؤالًا لترى أيضًا المسار ونتيجة المدقّق وزمن الاستجابة. ثم افتح `/glass` لترى خطوات القرار نفسها تُعاد خطوةً خطوة من المسار الفعلي للسؤال، ومعها وضع الطفل بعدّاد استدعاءات النموذج.
3. في صفحة التقييم، جرّب سؤالًا من مجموعة الاختبار أو اكتب سؤالك، مثل طلب فتوى شخصية أو آية محرّفة. يظهر الرد كما يراه الطفل.
4. راجع في صفحة التقييم «نتائج الاختبار» و«مقارنة مع نموذج غير مضبوط»، ثم التفاصيل في [TESTING.md](TESTING.md).
5. افتح نسخة القصة `/story/S1`، ثم صفحة الأهل `/parent`: اضغط 7 ثم 3 ثم 9، واكتب سؤالًا في «اسألوا عن رحلة طفلكم».

يجيب ميزان عن أسئلة الطفل من مكتبة محتوى مغلقة راجعها مراجع شرعي فقط. ولا يكتب النموذج نصًّا للطفل، ولا يقرأ الصوتُ الاصطناعي القرآنَ أبدًا.

المسابقة: Islamic AI Challenge 2026، المسار 03 (التجارب التفاعلية ورحلة المعرفة).

## مُنجَز خلال 4–6 أكتوبر

- **الرحلة:** ثلاث محطات كاملة ضمن رحلة «آيات الله في الماء والنبات»: من أين ينزل المطر، الماء والحياة، من البذرة إلى النبتة.
- **المحتوى القرآني:**
  - بطاقة الآية: النص من مجمع الملك فهد بخط المصحف، مع اسم السورة ورقم الآية.
  - التلاوة الحقيقية بصوت الشيخ محمود خليل الحصري.
  - التفسير للوالدين منفصلًا عن النص.
- **استدعاءات النموذج:** جلسة الطفل بلا أي استدعاء للنموذج. لا يُرسَل نص مكتوب إلى النموذج إلا من سؤال الوالدين وصفحة التقييم، ولتصنيفه فقط: 0 أو 1 استدعاء للسؤال، بنحو $0.0045 للاستدعاء. لا يخزّن ميزان هذا النص ولا يسجّله ([OPERATIONS.md](OPERATIONS.md)).
- **الأمان:** مكتبة مغلقة معتمدة، وموجِّه أسئلة يصنّف كل سؤال إلى المستويات A–D أو خارج النطاق، ومدقّق استشهاد يطابق كل آية بالنص المحفوظ حرفًا بحرف، وطبقة احتياطية تعرض الرد المعتمد عند تعذّر النموذج (D44).
- **الصوت والصورة:** صوت سردي مسجَّل مسبقًا لكل سطر معتمد، وصور ومؤثّرات صوتية من الطبيعة، مع مفتاح للوالدين.
- **مقاطع الفيديو (D60، D63):** عند الإجابة الصحيحة يتحرّك مشهد المحطة في مقطع قصير مولَّد بالذكاء الاصطناعي من صورتها المعتمدة، لا يتجاوز 6 ثوانٍ، وللخريطة مقطع هادئ متكرّر. راجع حسين كل مقطع، ومع تقليل الحركة أو توفير البيانات تبقى الصورة الثابتة.
- **الهاتف (D67):** تظهر كل شاشات الطفل كاملةً في الشاشة المرئية دون تمرير، عموديًّا وأفقيًّا: أهداف اللمس 64 بكسل على الأقل، ونص الآية 20 بكسل على الأقل، ولا يتغيّر شيء على الجهاز اللوحي والحاسوب.
- **للمحكّمين والكبار:**
  - وضع المحكّم ومسار القرار لكل رد.
  - صفحة التقييم مع «جرّب سؤالًا».
  - المقارنة مع نموذج غير مضبوط.
  - ملخّص الأهل.
  - نسخة القصة الثابتة للتجربة.

### مُنجَز في 5 أكتوبر (D54–D57)

- **الحركة (المراحل 1 و1b و1c):**
  - استجابة فورية للمس، ودخول البطاقات واحدةً بعد أخرى من اليمين إلى اليسار.
  - عند الإجابة الصحيحة ترتفع البطاقة المختارة، ثم تنفتح على مشهد حيّ فوق الصورة المعتمدة: مطر يتساقط من الغيمة في المحطة 1، وماء يلمع في المحطة 2، وضوء حول النبتة في المحطة 3.
  - الحركة كلها بـCSS وSVG، دون مكتبات جديدة ولا صور جديدة. لا شيء يتحرّك على بطاقة الآية أو قربها، ومع تقليل الحركة يقتصر الانتقال على التلاشي.
- **مسار القرار في كل خطوة:** في وضع المحكّم يظهر تحت كل خطوة كل قرار، موسومًا «قاعدة» أو «نموذج»، مع السجلات والمستوى والمصدر. وعند استدعاء النموذج يظهر أيضًا الزمن والرموز والمسار الاحتياطي.
- **بوابة الوالدين:** الأرقام 7 ثم 3 ثم 9 في صفحة الأهل، وهي مدخل ثانٍ لوضع المحكّم بجانب `?judge=1`.
- **سؤال الوالدين:** خلف البوابة نفسها. يُصنَّف السؤال بقواعد ثابتة ثم بنموذج ذكاء اصطناعي عند الحاجة، ويظهر الرد المعتمد مع مستواه ومصدره.
- **بطاقة ملخّص الجلسة:** تُبنى على الجهاز من أحداث الجلسة، وتعرض المحطات المكتملة، والتلميحات المستخدمة، والأسئلة المحالة إلى الأهل، وسطور الأهل المعتمدة، دون أي درجات.

## خارطة الطريق

لم يُنفَّذ أيٌّ مما يلي بعد. التفاصيل في [ROADMAP.md](ROADMAP.md).

- ستُبنى المحطتان 4 و5 بعد مراجعة شرعية.
- ستكتمل الرحلة بمحطاتها الخمس، مع لوحة للوالدين.
- ستُضاف رحلات أخرى عن آيات الله في الخلق.
- ستُبنى منصة للمدارس والجمعيات.
- ستُجرى التجربة مع الأطفال بعد التسليم، ولم تُجرَ أيّ تجربة قبله (D71).
- ستُدرَس لاحقًا عناصر أُخرجت من نطاق D54: مُختار تلميحات بالنموذج في مسار الطفل، وشخصية مرافقة، ونبتة ثلاثية الأبعاد، ولحظات «جرّب بنفسك»، وسؤال تذكّر في بداية المحطة، وعدد بطاقات متكيّف، ودرجة سرد آلية، وضوء مرشد.

## أين الأدلة

| الدليل | المكان |
|---|---|
| الاختبار والنتائج والحدود | [TESTING.md](TESTING.md) |
| ملفات كل تشغيل | `eval/results/` |
| المقارنة مع النموذج غير المضبوط | `eval/a2/` |
| القرارات بتواريخها | [docs/decisions.md](docs/decisions.md) |
| سجلّ المراجعة: كل سجلّ وكل بند اختبار، ومن راجعه ومتى | `content/review-log.json` |
| حزم المراجعة الشرعية | `docs/review/` |
| المصادر والتراخيص والإفصاح | [SOURCES.md](SOURCES.md)، [LICENSES.md](LICENSES.md)، [DISCLOSURE.md](DISCLOSURE.md) |
| التشغيل والتكلفة | [OPERATIONS.md](OPERATIONS.md) |

**المراجعة الشرعية:** مراجع شرعي (توقيع مكتوب؛ الاسم محجوب بطلبه).

**الترخيص:** الشيفرة MIT ([LICENSE](LICENSE)). المحتوى الأصلي CC BY-NC-SA 4.0 ([CONTENT-LICENSE.md](CONTENT-LICENSE.md)). المواد الخارجية بشروطها في [LICENSES.md](LICENSES.md).

</div>

## Technical setup

Requires Node.js ≥ 22.12. Run all commands from the repository root.

```
npm ci
npm run dev                  # local app on http://localhost:3000
npm test                     # unit tests (Vitest)
npm run lint
npm run typecheck
npm run build                # production build (as Vercel builds)
npm run verify:clean-build   # before every push: fresh clone of HEAD, npm ci + npm run build, no .env.local
npm run test:screens         # after a build: Playwright tests and screenshots (uses the installed Chrome)
npm run eval:run -- --categories A,B,C,D,E,F,G --runs 3   # evaluation through the /api/ask pipeline; writes eval/results/<runId>.json + -summary.md
npm run eval:a2:baseline     # A2: ungoverned baseline, raw outputs only in the git-ignored eval/.a2-raw/
npm run eval:a2:summary -- --delete-raw   # A2: detectors -> eval/a2/summary.json + summary.md, then deletes the raw outputs
```

`npm run eval:run` needs `ANTHROPIC_API_KEY`, `LLM_PROVIDER=anthropic` and `LLM_MODEL` to reproduce the TESTING figures. Without a key it still runs, but by design every item that needs the model classifier falls to OUT_OF_SCOPE and is reported as FAIL (99 of 141 executions pass without a key). The two A2 commands need the key too and stop with a message without it.

### Environment variables

`.env.example` lists the names only. Put the values in `.env.local`, which is git-ignored and never committed. On Vercel, set them under Project Settings → Environment Variables.

**No key is needed to run the app.** With `ANTHROPIC_API_KEY` or `LLM_PROVIDER` unset, the model classifier is off: the child journey never calls the model anyway, and typed questions on `/evaluation` and in Parent Ask are answered by the rules, the anticipated questions and verse matching; a question that would need the classifier gets the out-of-scope reply. To turn the classifier on, create a key at console.anthropic.com → API Keys and set `ANTHROPIC_API_KEY`, `LLM_PROVIDER=anthropic` and `LLM_MODEL=claude-sonnet-5-5` in `.env.local`.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | API key for the model classifier, from console.anthropic.com → API Keys. Console user keys (`sk-ant-usr-…`) also need `ANTHROPIC_WORKSPACE_ID`. |
| `ANTHROPIC_WORKSPACE_ID` | Sent as the `anthropic-workspace-id` header when set. Leave it empty for workspace-scoped keys. |
| `LLM_PROVIDER` | `anthropic`. The classifier is off when this is unset. |
| `LLM_MODEL` | Model ID (`claude-sonnet-5-5`); never hard-coded. |
| `LLM_EFFORT` | Optional: `low`, `medium` or `high`. Default effort is used (D30). |
| `LLM_REPHRASE` | Optional: `on` lets the model rephrase NA science and UI lines. Off. |
| `EVAL_DAILY_CAP` | Optional daily cap on typed questions on /evaluation (default 300). |
| `OPENAI_API_KEY`, `LLM_FALLBACK_MODEL`, `LLM_FALLBACK_EFFORT` | Secondary classifier provider. Built but disabled in this submission (D44): leave `LLM_FALLBACK_MODEL` empty everywhere. |
| `FORCE_PRIMARY_FAIL` | Local evidence runs only. Ignored on Vercel; never set it there. |
| `ELEVENLABS_API_KEY` | Narration generator only (`npm run assets:narrate`); never used by the running app. |

### How it works

- **No answer without an approved record:** every answer the app shows comes from approved library records in `/content`. Only records with `status: "approved"` are compiled in.
- **Model role:** the model only classifies questions that no rule, anticipated question or verse match covers. It returns a level and a record ID, which the citation validator checks.
- **AI lens (D54):** with `?judge=1`, or after the parent gate (7, 3, 9) on `/parent`, every station step shows its decisions, each labelled `rule` or `model`, with record IDs, level and sources; model calls add latency, tokens and the fallback flag. The child session makes no model call.
- **Parent Ask and summary card (D54):** Parent Ask sends `{ stationId, text }` to the unchanged `/api/try`; the text stays in component state. The summary card is built on the device from the session events (sessionStorage).
- **Motion:** CSS/SVG only (`app/globals.css`, `app/_components/moments.tsx`); transform and opacity only; reduced motion gives opacity fades only.
- **Qur'an text:** shown byte-identical to the King Fahd Complex text, in its font, and never spoken by a synthetic voice.
- **Reference:** see CLAUDE.md §3–5, docs/decisions.md and TESTING.md.

### Asset tooling (pre-build, run locally)

```
npm run assets:briefs -- --copy <file>   # English picture briefs for approved S1–S3 records
npm run assets:narrate -- S1 S2 S3 --stale-only   # ElevenLabs narration for approved tts lines (never Qur'an, tafsir or hadith)
npm run assets:images -- --base <url>    # public/images/<station>/<recordId>.webp + IMAGES.json
npm run snapshot                         # ingestion from the official sources (pre-build tooling)
```

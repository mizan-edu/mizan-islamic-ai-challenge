// Evaluation page wording (Runbook 3.7). Adult-facing Arabic (MSA), Western numerals.
// Section headings, badges and placeholders are exactly as approved by Hussein (D45). The body
// sentences are drafted for this page and describe the system only: no verse, tafsir or hadith text.
// Numbers are never written here: they come from eval-data.ts at build time.

export const REPO_URL = 'https://github.com/mizan-edu/mizan-islamic-ai-challenge';
export const LIVE_URL = 'https://mizan-islamic-ai-challenge-three.vercel.app';
export const sourceUrl = (path: string) => `${REPO_URL}/blob/main/${path}`;

export const T = {
  title: 'صفحة التقييم',
  heading: {
    about: 'عن هذه الصفحة',
    try: 'جرّب سؤالًا',
    results: 'نتائج الاختبار',
    safety: 'سلامة المحتوى',
    log: 'سجلّ التحسينات',
    reliability: 'الاعتمادية',
    limits: 'حدود معروفة',
    compare: 'مقارنة مع نموذج غير مضبوط',
    vision: 'الرؤية وخارطة الطريق',
  },
  badgeBuilt: 'مُنجَز خلال 4–6 أكتوبر',
  badgeFuture: 'تصوّر مستقبلي — غير مُنفَّذ',
  pendingTuesday: 'يُستكمَل الثلاثاء',
  pilot: 'الدراسة التجريبية مع الأطفال',
  pilotPending: 'يُستكمَل لاحقًا', // D50: the child pilot is parked
  scholarLabel: 'مراجع شرعي (الاسم محجوب بطلبه)',
  judgeLink: 'للمحكّمين: صفحة التقييم',
  source: 'المصدر',

  // The verse-text source is passed in exactly as recorded in the ingestion snapshot (platform, file, version).
  verseSource: (platform: string, file: string, version: string) => `${platform} (${file}، الإصدار ${version})`,
  fontName: 'خط مجمع الملك فهد لطباعة المصحف الشريف',
  about: (verseSource: string) => `ميزان رحلة تعليمية للأطفال من 4 إلى 6 سنوات بعنوان «آيات الله في الماء والنبات»: يلاحظ الطفل صورة ويختار بالنقر، ثم يرى آية بنصّها من ${verseSource} بخط مجمع الملك فهد لطباعة المصحف الشريف، ويسمع تلاوتها الحقيقية، ويسأل أسئلة جاهزة يجيب عنها النظام من مكتبة محتوى معتمدة فقط. هذه الصفحة موجّهة للمحكّمين والكبار، وكل ما فيها بُني خلال 4–6 أكتوبر. كل رقم فيها يُقرأ عند البناء من ملفات النتائج المحفوظة في المستودع، وبجانبه رابط إلى الملف المصدر. نسبة النجاح هي نسبة الأسئلة التي اجتازت جميع الفحوص الآلية المحدّدة لها في كل تشغيل؛ أمّا التقييم البشري للفئات من B إلى G فمنفصل.`,

  try: {
    intro: 'اختر محطة، ثم اختر سؤالًا من مجموعة الاختبار المعتمدة أو اكتب سؤالك. يظهر الرد كما يراه الطفل تمامًا، وتحته مسار القرار كما في وضع المحكّم. لا يُخزَّن النص المكتوب ولا يُسجَّل، ولا يُنشأ أي حدث.',
    station: 'المحطة',
    item: 'سؤال من مجموعة الاختبار',
    general: 'أسئلة عامة (بلا محطة)',
    showItem: 'اعرض الرد',
    typed: 'أو اكتب سؤالًا',
    typedHint: (max: number) => `${max} حرفًا على الأكثر`,
    sendTyped: 'أرسل السؤال',
    excluded: (ids: string) => `لا تُعرض هنا البنود التي يُبنى سؤالها من نص آية معدَّل عمدًا (${ids})؛ نتائجها في جدول نتائج الاختبار.`,
    busy: 'جارٍ إعداد الرد…',
    capReached: 'تمّ بلوغ الحدّ اليومي للتجربة',
    rateLimited: 'بلغتَ حدّ 10 أسئلة في الدقيقة؛ حاول بعد قليل.',
    error: 'تعذّر الحصول على الرد؛ حاول مرة أخرى.',
    replyLabel: 'الرد كما يراه الطفل',
  },

  results: {
    intro: (items: number, executions: number, model: string) => `مجموعة الاختبار يوم الاثنين: ${items} بندًا نشطًا، شُغِّل كل منها 3 مرات (${executions} تنفيذًا)، بالنموذج ${model}.`,
    cols: ['الفئة', 'البنود', 'التشغيل 1', 'التشغيل 2', 'التشغيل 3', 'المتوسط', 'الحدّ المطلوب', 'متحقّق'],
    categories: {
      A: 'أسئلة المحطة',
      B: 'حالات الاختبار الاثنتا عشرة من الحزمة المرجعية (مكيَّفة)',
      C: 'أسئلة حسّاسة للطفل',
      D: 'لا مرجع في المكتبة',
      E: 'آية محرّفة أو طلب حديث',
      F: 'فتوى شخصية',
      G: 'محاولات إخراج النظام عن دوره',
    } as Record<string, string>,
    yes: 'نعم',
    no: 'لا',
    bBeforeAfter: (before: string, after: string) => `قبل D41: ${before} ← بعد D41: ${after}`,
    bExplain: 'كان الفاحص الآلي يصنّف الرد الاحتياطي بحسب مستواه لا بحسب نصّه، فلم يعدّه إحالةً إلى الأهل مع أن نصّه يدعو الطفل إلى سؤال أهله؛ بعد D41 صار الفاحص يقرأ نص الرد، وأُعيد تشغيل الفئة B ثلاث مرات.',
    rerun: (cat: string, added: string, decision: string, items: number, all3: number, same: number) => `الفئة ${cat}: بعد تفعيل البنود ${added} في المراجعة الشرعية الثالثة (${decision}) أُعيد تشغيل الفئة 3 مرات على ${items} بنود، وأرقام صفّها في الجدول من هذا التشغيل؛ نجح ${all3} من ${items} في التشغيلات الثلاثة، وبقي مستوى ${same} منها وسجلّه نفسه.`,
    consistencyTitle: 'الاتساق',
    all3: (n: number, of: number) => `البنود التي نجحت في التشغيلات الثلاثة: ${n} من ${of}`,
    same: (n: number, of: number) => `البنود التي بقي مستواها وسجلّها نفسه في التشغيلات الثلاثة: ${n} من ${of}`,
    costTitle: 'التكلفة وزمن الاستجابة',
    cost: (exec: string, call: string, calls: number, executions: number) => `التكلفة لكل تنفيذ: ${exec}؛ لكل استدعاء للنموذج: ${call} (${calls} استدعاءً من ${executions} تنفيذًا؛ الباقي أجابت عنه القواعد والأسئلة المتوقَّعة ومطابقة الآيات دون نموذج).`,
    latency: (p50: number, p95: number) => `زمن الاستجابة لكل تنفيذ: الوسيط ${p50} ms، والمئين 95: ${p95} ms.`,
    callLatency: (p50: number, p95: number) => `زمن الاستجابة لكل استدعاء للنموذج: الوسيط ${p50} ms، والمئين 95: ${p95} ms.`,
    notActiveTitle: 'بنود غير نشطة',
    reason: { scholar_removed: 'أزالها المراجع الشرعي: غير مناسبة لعمر 4–6 سنوات', draft: 'مسودة بانتظار المراجعة الشرعية؛ لا تدخل في النسب', other: 'غير نشطة' },
  },

  safety: {
    approved: (n: number) => `عدد السجلات المعتمدة في المكتبة المغلقة: ${n}`,
    types: { quran: 'آيات', tafsir: 'تفسير', explanation: 'شرح', answer: 'إجابات', referral: 'إحالات', fallback: 'ردود احتياطية', ui: 'نصوص الواجهة' } as Record<string, string>,
    sourcesTitle: 'المصادر',
    quran: (source: string, n: number) => `نص الآيات (${n}): ${source}، ويُعرض كما هو دون أي تعديل.`,
    font: (name: string, file: string) => `الخط: ${name} (${file}).`,
    tafsir: (platform: string, edition: string, n: number) => `التفسير (${n}): ${platform} (${edition})، ويُعرض للوالدين منفصلًا عن نص الآية.`,
    recitation: (platform: string, reciter: string, rewaya: string) => `التلاوة: ${platform} — الشيخ ${reciter}، رواية ${rewaya}.`,
    voice: 'الصوت الاصطناعي لا يقرأ القرآن أبدًا: التلاوة صوت حقيقي من مصدرها، وطبقة تحويل النص إلى صوت ترفض أي مقطع قرآني.',
    validator: 'مدقّق الاستشهاد: لا يُعرض أي رد إلا إذا كان كل سجلّ يستشهد به معتمدًا في المكتبة، وكان نص كل آية مطابقًا للنص المحفوظ حرفًا بحرف؛ وإلا يُعرض الرد الاحتياطي المعتمد.',
    scholar: (dates: { date: string; count: number }[], parts: string) => `المراجعة الشرعية: ${dates.map((d) => `${d.count} بندًا بتاريخ ${d.date}`).join('، و')} (${parts}).`,
    kinds: { 'station-record': 'سجلّ محتوى', 'test-item': 'بند اختبار', decision: 'قرار', image: 'صورة', 'eval-output-review': 'مراجعة مخرجات التقييم' } as Record<string, string>,
  },

  log: {
    run1dev2: (a: string, b: string) => `من run1 إلى dev2: الفئة A من ${a} إلى ${b} — إصلاحات المصنِّف وتصحيح بنود الاختبار A05 وA07 وA13 (D25).`,
    dev2dev4: (a: string, b: string, dev3: string) => `من dev2 إلى dev4: الفئة A من ${a} إلى ${b} — تحسين جودة المحتوى العربي Q1 (D29). (dev3 على البناء نفسه لـ dev2: ${dev3}؛ تباين بين التشغيلات.)`,
    a12: (failed: number, passed: number) => `البند A12 (D31): لم ينجح في ${failed} تشغيلات قبل القرار، ونجح في ${passed} تشغيلات بعده؛ صار يقبل الإجابة البديلة المعتمدة.`,
    d41: (before: string, after: string) => `D41 (كشف الإحالة من نص الرد): الفئة B من ${before} إلى ${after}.`,
    d38: 'D38 (اللحظات البصرية): توقيت ألطف وصور تظهر كاملة دون قص؛ تحسين في الواجهة لا تقيسه نسب النجاح.',
  },

  reliability: {
    chain: 'تصنيف الأسئلة غير المتوقَّعة يمرّ بنموذج أساسي (Anthropic) بمهلة 8 ثوانٍ؛ فإن تأخّر أو أخطأ أو امتنع، يُعرض ردّ المحطة الاحتياطي المعتمد مع أزرار الأسئلة الجاهزة، ويظهر ذلك في مسار المحكّم بالرمز fallback:static (D44).',
    tests: 'هذا السلوك متحقَّق منه باختبارات آلية.',
    secondary: 'مزوّد ثانٍ (OpenAI) مبنيّ في الشيفرة لكنه معطَّل، ولم يُرسَل إليه أي طلب، ولم يُستخدم في هذا التقديم.',
  },

  limits: {
    a04: (passed: number, runs: number) => `البند A04 ثابت في ${passed} من ${runs} تشغيلات.`,
    d09: (levels: string) => `يتغيّر المستوى الذي يختاره المصنِّف لبعض الأسئلة الخارجة عن النطاق: صُنّف البند D09 في تشغيلاته المتتالية هكذا: ${levels}؛ والرد في كل مرة هو الرد الاحتياطي المعتمد.`,
    stations: (built: number, planned: number) => `بُنيت ${built} محطات من ${planned}.`,
    typing: 'يختار الطفل من أسئلة جاهزة ولا يكتب بحرّية؛ الكتابة الحرة متاحة للمحكّمين في هذه الصفحة فقط.',
  },

  compare: {
    method: (model: string, items: number) => `شُغِّل النموذج نفسه الذي يستخدمه ميزان (${model}) دون الموجّه والمكتبة المعتمدة والمدقّق والقواعد، بتعليمة نظام واحدة تطلب منه الإجابة لطفل بين 4 و6 سنوات، على بنود الاختبار النشطة نفسها (${items}) مرةً واحدة لكل بند. ثم طُبّقت الكواشف الآلية نفسها على ردود الطرفين كما يراها الطفل.`,
    cols: ['الكاشف', 'ميزان', 'النموذج غير المضبوط'],
    detectors: {
      quran_quoted: 'اقتباس من القرآن',
      quran_not_verbatim: 'اقتباس قرآني غير مطابق للنص',
      hadith_attributed: 'نسبة حديث إلى النبي ﷺ',
      personal_ruling: 'حكم شخصي (الفئة F)',
      referral: 'إحالة إلى الأهل أو أهل العلم',
      referral_broad: 'إحالة بصيغة أوسع',
      source_cited: 'ذكر المصدر',
      role_kept: 'الثبات على الدور (الفئة G)',
    } as Record<string, string>,
    words: 'متوسط طول الإجابة (كلمة)',
    noText: 'لا تُعرض نصوص النموذج غير المضبوط عمدًا',
    limitsTitle: 'حدود المقارنة',
    limits: (otherReferral: number, prophet: number) => [
      'قد تفوت الكواشف الاقتباس المُعاد صياغته أو الجزئي.',
      `كاشف الإحالة يقتصر على عبارات محدّدة؛ و${otherReferral} من ردود النموذج غير المضبوط تحيل الطفل بصيغة أخرى، ويحسبها كاشف «إحالة بصيغة أوسع».`,
      `${prophet} من ردوده تذكر النبي ﷺ أو حديثًا دون صيغة نسبة، فلا تُحسب في «نسبة حديث».`,
      'لم تُراجَع نصوص النموذج غير المضبوط مراجعة بشرية، وشُغِّل مرة واحدة لكل بند.',
    ],
    cost: (usd: string) => `تكلفة تشغيل النموذج غير المضبوط: ${usd}.`,
  },

  vision: (badge: string) => `كل ما يُذكر هنا عن المستقبل يحمل الوسم «${badge}».`,

  footer: { repo: 'المستودع', testing: 'TESTING.md', live: 'التطبيق المباشر' },
};

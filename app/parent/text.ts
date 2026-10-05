// Parent-page wording for the pilot (D47). Adult-facing Arabic (MSA). «للتجربة: نسخة القصة» and
// «إعادة البدء» as briefed by Hussein; the confirm question, its two buttons and the result line
// approved by Hussein as drafted (D49).
export const PILOT = {
  storyHeading: 'للتجربة: نسخة القصة',
  reset: 'إعادة البدء',
  confirm: 'سيُمسح تقدّم الرحلة على هذا الجهاز فقط، ليبدأ الطفل التالي من البداية. هل تريد المتابعة؟',
  yes: 'نعم، أعِد البدء',
  cancel: 'إلغاء',
  done: 'تمّت إعادة البدء.',
};

// Parent Ask (D54, Phase 3). Adult-facing Arabic (MSA), Western numerals. Approved by Hussein,
// Review 1 (D56): intro and two behaviour badges (correction, fallback) edited, the rest as drafted.
// The station label, length hint, send button, status lines and reply label reuse the evaluation
// page's approved wording (app/evaluation/text.ts, D45); «المستوى», «المصدر» and «نوع القرار»
// are approved UI labels (D37, D55).
export const PARENT_ASK = {
  heading: 'اسألوا عن رحلة طفلكم',
  intro: 'يُصنَّف سؤالكم بقواعد ثابتة أولًا، ثم بنموذج ذكاء اصطناعي عند الحاجة، فيحدّد مستواه ويختار ردًّا من المكتبة المعتمدة، ولا يكتب الردّ بنفسه. يظهر الردّ مع مستواه ومصدره. أمّا الطفل فيختار من أسئلة معدّة مسبقًا ولا يكتب شيئًا. لا نخزّن النصّ الذي تكتبونه ولا نسجّله، ويُرسَل عند الحاجة إلى النموذج لتصنيفه فقط، ويُمحى عند مغادرة الصفحة.',
  question: 'سؤالكم',
  library: 'المكتبة المعتمدة في ميزان',
  kind: { rule: 'قاعدة ثابتة', model: 'نموذج ذكاء اصطناعي' },
  behaviour: { answer: 'إجابة', verse_card: 'بطاقة آية', correction: 'توجيه', referral: 'إحالة', fallback: 'ردّ احتياطي' },
};

// Parent summary card (D54, Phase 4). Adult-facing Arabic (MSA), Western numerals. Approved by
// Hussein, Review 1 (D57): together and learned edited, the rest as drafted; the privacy line stays
// because the summary reads sessionStorage (cleared when the tab or browser closes). Numbers are
// shown as "n من m" so no Arabic number agreement is needed.
export const SUMMARY = {
  heading: 'ملخّص هذه الجلسة',
  privacy: 'يُبنى هذا الملخّص على هذا الجهاز فقط من خطوات الرحلة، ولا يُرسَل إلى أي خادم. يُمحى عند «إعادة البدء» أو عند إغلاق المتصفح.',
  empty: 'لم يُكمل الطفل أي محطة في هذه الجلسة بعد.',
  completed: (n: number, total: number) => `المحطات المكتملة: ${n} من ${total}`,
  noHints: 'وجد الإجابة دون تلميح.',
  hints: (n: number, total: number) => `التلميحات المستخدمة في خطوة الملاحظة: ${n} من ${total}`,
  together: 'واحتاج إلى المساعدة في آخر خطوة حتى وجد الإجابة.',
  referred: (n: number) => `أسئلة أُحيلت إليكم في هذه المحطة: ${n}`,
  learned: 'ما تعرّف عليه الطفل في هذه المحطة',
  safety: 'مهمّ: ظهرت في هذه الجلسة رسالة تطلب من الطفل أن يتحدّث الآن إلى شخص بالغ يثق به. تحدّثوا معه بهدوء.',
};

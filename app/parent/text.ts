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

// Parent Ask (D54, Phase 3). Adult-facing Arabic (MSA), Western numerals. DRAFT — needs Hussein's
// Review 1: heading, intro, question label, library name, decision kinds and behaviour badges.
// The station label, length hint, send button, status lines and reply label reuse the evaluation
// page's approved wording (app/evaluation/text.ts, D45); «المستوى», «المصدر» and «نوع القرار»
// are approved UI labels (D37, D55).
export const PARENT_ASK = {
  heading: 'اسألوا عن رحلة طفلكم',
  intro: 'يمرّ سؤالكم بالمسار نفسه الذي يمرّ به سؤال الطفل: قواعد ثابتة أولًا، ثم نموذج ذكاء اصطناعي عند الحاجة يصنّف السؤال ويختار ردًّا من المكتبة المعتمدة، ولا يكتب الرد بنفسه. يظهر الرد مع مستواه ومصدره. لا يُخزَّن النص المكتوب ولا يُسجَّل، ويُمحى عند مغادرة الصفحة.',
  question: 'سؤالكم',
  library: 'المكتبة المعتمدة في ميزان',
  kind: { rule: 'قاعدة ثابتة', model: 'نموذج ذكاء اصطناعي' },
  behaviour: { answer: 'إجابة', verse_card: 'بطاقة آية', correction: 'تصحيح', referral: 'إحالة', fallback: 'رد احتياطي' },
};

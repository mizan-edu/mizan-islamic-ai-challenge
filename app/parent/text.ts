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

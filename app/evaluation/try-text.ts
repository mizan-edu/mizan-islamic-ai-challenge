// «جرّب سؤالًا» wording (Runbook 3.7), exactly as approved by Hussein (D45); moved out of text.ts
// unchanged so Parent Ask (app/parent/ParentAsk.tsx) can reuse these lines without bundling the
// whole evaluation page text.
export const TRY = {
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
};

/**
 * بنك الكلمات العلاجية لمحلل النطق (★ v3.24)
 * كلمات عربية مبسطة مناسبة للأطفال — مصنفة حسب الحرف/المخرج المدروس
 * كل مجموعة تُنطق مع تمكين الحرف في مواضع مختلفة من الكلمة (أول/وسط/آخر)
 * تُستعمل في واجهة محلل النطق لتوجيه تسجيل المريض، ويمكن للأخصائي إدخال كلمة مخصصة أيضاً.
 */
export type WordBankEntry = {
  letter: string;
  words: string[];
};

export const WORD_BANK: WordBankEntry[] = [
  { letter: "ب", words: ["باب", "بطة", "بطيخ", "بنان"] },
  { letter: "ت", words: ["تفاحة", "تمر", "تمساح", "ترس"] },
  { letter: "د", words: ["دجاجة", "دب", "دلفين", "درج"] },
  { letter: "ر", words: ["رمان", "ريشة", "روضة", "رمح"] },
  { letter: "س", words: ["سمكة", "ساعة", "سلة", "سلحفاة"] },
  { letter: "ش", words: ["شمس", "شجرة", "شباك", "شعلة"] },
  { letter: "ك", words: ["كتاب", "كرة", "كوب", "كنغر"] },
  { letter: "ل", words: ["ليمون", "لعبة", "لسان", "لبنة"] },
  { letter: "م", words: ["مفتاح", "موز", "مظلة", "ماسة"] },
  { letter: "ن", words: ["نار", "نجمة", "نحلة", "نمر"] },
  { letter: "ف", words: ["فيل", "فول", "فراولة", "فيلم"] },
  { letter: "ق", words: ["قمر", "قلم", "قطة", "قوقعة"] },
  { letter: "ج", words: ["جمل", "جبن", "جرة", "جزر"] },
  { letter: "خ", words: ["خيط", "خبز", "خنزير", "خيمة"] },
  { letter: "ع", words: ["عين", "عصير", "عصفور", "عربة"] },
  { letter: "غ", words: ["غيم", "غزال", "غرفة", "غول"] },
];

/** تطبيع عربي للمقارنة: بلا تشكيل، همزات موحدة، تاء مربوطة/ها متكافئة، بلا مسافات */
export function normalizeArabic(s: string): string {
  return String(s || "")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "") /* التشكيل وعلامات القرآن */
    .replace(/[\u0622\u0623\u0625\u0627]/g, "\u0627") /* آأإ → ا */
    .replace(/\u0649/g, "\u064A") /* ى → ي */
    .replace(/\u0629/g, "\u0647") /* ة → ه */
    .replace(/\u0624/g, "\u0648") /* ؤ → و */
    .replace(/\u0626/g, "\u064A") /* ئ → ي */
    .replace(/\s+/g, "")
    .trim();
}

/* تسميات عربية للنتائج — تُستعمل في الاستجابة الخادمية (تعليقات التوجيه) */
export function disorderLabelAr(code: string): string {
  switch (code) {
    case "stutter": return "تأتأة";
    case "lisp": return "لثغة";
    case "deletion": return "حذف أصوات";
    case "substitution": return "إبدال أصوات";
    case "distortion": return "تشويه مخارج";
    default: return "لا مؤشرات واضحة";
  }
}
export function severityLabelAr(code: string): string {
  switch (code) {
    case "high": return "مرتفعة";
    case "mid": return "متوسطة";
    default: return "خفيفة";
  }
}

/**
 * اختيار النص المترجم حسب لغة المستخدم — سقوط تلقائي إلى العربية
 * تُستعمل في العرض: pickByLang(lang, v.title, v.titleFr, v.titleEn, v.titleTr, v.titleEs)
 * سلسلة السقوط لكل لغة: النص بلغته ← الإنجليزية ← الفرنسية ← العربية
 * (v3.7: دعم خمس لغات — عربية / فرنسية / إنجليزية / تركية / إسبانية)
 */
export function pickByLang(
  lang: string,
  ar?: string,
  fr?: string,
  en?: string,
  tr?: string,
  es?: string
): string {
  if (lang === "fr") return fr?.trim() || ar || "";
  if (lang === "en") return en?.trim() || ar || "";
  if (lang === "tr") return tr?.trim() || en?.trim() || fr?.trim() || ar || "";
  if (lang === "es") return es?.trim() || en?.trim() || fr?.trim() || ar || "";
  return ar || "";
}

/** مفتاح اللاحقة الخاص بكل لغة في الحقول المسطحة: title / titleFr / titleEn / titleTr / titleEs */
export function langSuffix(lang: string): "" | "Fr" | "En" | "Tr" | "Es" {
  if (lang === "fr") return "Fr";
  if (lang === "en") return "En";
  if (lang === "tr") return "Tr";
  if (lang === "es") return "Es";
  return "";
}

/** إعدادات المنطقة (locale) لتنسيق التواريخ والأرقام حسب لغة الواجهة */
export function localeOf(lang: string): string {
  if (lang === "ar") return "ar-DZ";
  if (lang === "fr") return "fr-FR";
  if (lang === "tr") return "tr-TR";
  if (lang === "es") return "es-ES";
  return "en-GB";
}

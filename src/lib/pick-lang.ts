/**
 * اختيار النص المترجم حسب لغة المستخدم — سقوط تلقائي إلى العربية
 * تُستعمل في العرض: pickByLang(lang, v.title, v.titleFr, v.titleEn)
 */
export function pickByLang(lang: string, ar?: string, fr?: string, en?: string): string {
  if (lang === "fr") return fr?.trim() || ar || "";
  if (lang === "en") return en?.trim() || ar || "";
  return ar || "";
}

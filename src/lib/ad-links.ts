/**
 * ★ v3.26 — روابط قنوات التواصل للإعلانات: تطبيع موحّد بين الواجهات
 * (البطاقة العمومية، الإعلان العائم، الشريط الدوّار)
 */

/** تطبيع رابط عام: يقبل الرابط الكامل أو النطاق المجرد — يعيد "" إن كان فارغاً */
export function normAdLink(v: unknown): string {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(raw)) return `https://${raw}`;
  return raw; /* نُرجع الخام — الخادم هو صاحب الفحص الصارم */
}

/** رابط واتساب دولي: أرقام فقط + بادئة الجزائر 213 عند الغياب */
export function waLink(v: unknown): string {
  const d = String(v ?? "").replace(/\D/g, "");
  if (!d) return "";
  const intl = d.startsWith("213") ? d : `213${d.replace(/^0+/, "")}`;
  return `https://wa.me/${intl}`;
}

/** رابط هاتف tel: */
export function telLink(v: unknown): string {
  const d = String(v ?? "").replace(/[^\d+]/g, "");
  return d ? `tel:${d}` : "";
}

/** عنوان → بحث خرائط Google */
export function mapsLink(v: unknown): string {
  const a = String(v ?? "").trim();
  return a ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}` : "";
}

export type AdContact = {
  phone?: string; whatsapp?: string; website?: string; instagram?: string;
  facebook?: string; tiktok?: string; youtube?: string; address?: string;
};

/** هل يوجد أي حقل تواصل معبأ؟ */
export function hasContact(c?: AdContact | null): boolean {
  if (!c) return false;
  return Boolean(String(c.phone || c.whatsapp || c.website || c.instagram || c.facebook || c.tiktok || c.youtube || c.address || "").trim());
}

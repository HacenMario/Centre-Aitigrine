/**
 * حساب السن من تاريخ الميلاد (★ v3.24.2) — وحدة مشتركة عميل/خادم
 * السن تُحسب لحظياً عند كل عرض فيتحدّث الرقم تلقائياً كلما كبر العميل سنة،
 * بلا أي تحديث يدوي (كان إدخال السن رقمياً يتطلب تعديلاً سنوياً).
 */
export function ageFromBirth(birth?: string | null): number | null {
  const s = String(birth || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const b = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  if (b.getTime() > now.getTime()) return null;
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age >= 0 && age <= 120 ? age : null;
}

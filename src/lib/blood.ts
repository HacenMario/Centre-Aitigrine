/**
 * ★ v3.19: زمرة الدم — مصدر الحقيقة الموحّد للقيم المسموحة
 * القيم بصيغة الرمز الطبي العالمي (A+/A-/B+/B-/AB+/AB-/O+/O-) وتُخزَّن كما هي في القاعدة،
 * وتُعرض dir=ltr في كل الواجهات (الرمز عالمي بلا ترجمة).
 * الإلزام: عند إنشاء حساب عميل جديد (تسجيل ذاتي أو إكمال Google) —
 * وللمسجَّلين سابقاً تُضاف/تُعدَّل من: الإدارة أو المساعد أو الأخصائي المعالج.
 */
export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export type BloodType = (typeof BLOOD_TYPES)[number];

export const isBloodType = (v: unknown): v is BloodType =>
  typeof v === "string" && (BLOOD_TYPES as readonly string[]).includes(v);

/** تطبيع قيمة الواجهة: الفراغ/«none» → null (غير محددة)، غير ذلك تحقق صارم */
export function normalizeBloodType(v: unknown): BloodType | null {
  if (v === null || v === undefined || v === "" || v === "none") return null;
  if (!isBloodType(v)) throw new Error("BLOOD_INVALID");
  return v;
}

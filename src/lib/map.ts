/**
 * تحويل mongoose Map (أو كائن عادي) إلى كائن JS عادي
 * ملاحظة حرجة: lean() قد يعيد Map ككائن عادي — النمط entries?.() يفشل في هذه الحالة
 * (كان سبباً في ظهور ساعات الأخصائي وإجابات العملاء فارغة رغم وجود البيانات)
 */
export function mapToObj(raw: unknown): Record<string, unknown> {
  if (raw instanceof Map) return Object.fromEntries(raw as Map<string, unknown>);
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

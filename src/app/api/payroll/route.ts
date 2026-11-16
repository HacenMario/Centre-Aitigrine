/**
 * الأجور والمستحقات الشهرية (★ v3.23) — حساب الإدارة فقط
 * GET ?month=YYYY-MM → مستحقات كل أخصائي (الجلسات المنتهية × نسبته)
 *   + تسوية المساعدة (راتب ثابت − غياب) + الإجماليات
 * PATCH → حفظ تسوية الشهر للإدارة: { month, assistantBase, absenceDays, deductionPerDay, note? }
 * الحساب تلقائي بالكامل من المواعيد — لا إدخال يدوي إلا لتسويات المساعدة والغياب.
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth";
import { PayrollAdjustment } from "@/lib/models";
import { monthPayroll, isYm } from "@/lib/payroll";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin"]);
    const { searchParams } = new URL(req.url);
    const month = String(searchParams.get("month") || "");
    if (!isYm(month)) return fail(400, "صيغة الشهر غير صحيحة — استخدم YYYY-MM");
    return ok(await monthPayroll(month));
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser(["admin"]);
    const b = await req.json().catch(() => ({}));
    const month = String(b.month || "");
    if (!isYm(month)) return fail(400, "صيغة الشهر غير صحيحة — استخدم YYYY-MM");

    const assistantBase = Math.max(0, Math.round(Number(b.assistantBase) || 0));
    const absenceDays = Math.max(0, Math.min(31, Math.round(Number(b.absenceDays) || 0)));
    const deductionPerDay = Math.max(0, Math.round(Number(b.deductionPerDay) || 0));
    const note = String(b.note || "").slice(0, 300);

    const saved = await PayrollAdjustment.findOneAndUpdate(
      { month },
      { month, assistantBase, absenceDays, deductionPerDay, note },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    if (!saved) return fail(500, "تعذر حفظ تسوية الشهر");

    await logAudit(
      { _id: me._id, name: me.name, role: me.role },
      "payroll.assistant",
      `أجور شهر: ${month}`,
      `أساسي=${assistantBase} غياب=${absenceDays} يوم خصم=${deductionPerDay}`,
      month
    );
    return ok(await monthPayroll(month));
  });
}

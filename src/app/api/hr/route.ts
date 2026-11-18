/**
 * نظام الموارد البشرية (★ v3.24) — الإدارة فقط
 * GET  ?month=YYYY-MM → الموظفون + إحصائيات الشهر لكل موظف + القابلون للاستيراد من الحسابات
 * POST { action, ...payload } → إدارة الموظفين والحضور والإجازات والدفعات
 *
 * قواعد الاحتساب (شفافة وموحدة):
 *  — ما لا يُسجَّل في الحضور يُعد حاضراً (نمط العيادات الصغيرة)
 *  — أيام الغياب المسجلة تُخصم بقسط يومي = الراتب الأساسي ÷ 26
 *  — أيام الإجازة بدون أجر تُحسب غياباً في الخصم؛ المدفوعة لا تُخصم
 *  — صافي المستحق = الأساس − خصم الغياب + المكافآت − الخصومات الإدارية
 *  — المتبقي للصرف = الصافي − الدفعات المقدمة (acompte) − المبالغ المصروفة كراتب
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { HrAttendance, HrEmployee, HrLeave, HrPayment, Settings, User } from "@/lib/models";
import { requireUser } from "@/lib/auth";
import { isYm, ymOf } from "@/lib/payroll";
import { employeeStats } from "@/lib/hr";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin"]);
    const month = req.nextUrl.searchParams.get("month") || ymOf(new Date());
    if (!isYm(month)) return fail(400, "صيغة الشهر غير صحيحة");

    const emps = await HrEmployee.find({}).sort({ createdAt: 1 }).lean<
      { _id: unknown; name?: string; role?: string; baseSalary?: number; phone?: string; notes?: string; active?: boolean; userId?: unknown }[]
    >();

    /* ★ v3.26: صور صاحبي الحسابات المرتبطة — لعرضها في بطاقة الموظف */
    const linkedUserIds = emps.map((e) => (e.userId ? String(e.userId) : "")).filter(Boolean);
    const photoMap = new Map<string, string>();
    if (linkedUserIds.length) {
      const users = await User.find({ _id: { $in: linkedUserIds } }).select("photoBase64").lean<{ _id: unknown; photoBase64?: string }[]>();
      for (const u of users) photoMap.set(String(u._id), u.photoBase64 || "");
    }

    const employees = [];
    for (const e of emps) {
      const stats = await employeeStats(e, month);
      employees.push({
        _id: String(e._id),
        name: e.name || "—",
        role: e.role || "other",
        baseSalary: Math.max(0, Math.round(Number(e.baseSalary) || 0)),
        phone: e.phone || "",
        notes: e.notes || "",
        active: e.active !== false,
        userId: e.userId ? String(e.userId) : null,
        photoBase64: (e as { photoBase64?: string }).photoBase64 || "",
        accountPhoto: e.userId ? photoMap.get(String(e.userId)) || "" : "",
        stats,
      });
    }

    /* القابلون للاستيراد: أخصائيون بنظام الراتب الثابت + المساعدون — بلا موظف مرتبط
       ★ المساعدة يورث راتبها الافتراضي من إعدادات المركز (assistantSalary) إن لم يُضبط يدوياً */
    const linkedIds = new Set(emps.map((e) => (e.userId ? String(e.userId) : "")).filter(Boolean));
    const [candidates, st] = await Promise.all([
      User.find({ role: { $in: ["specialist", "assistant"] }, active: true })
        .select("name role payModel salaryAmount")
        .lean<{ _id: unknown; name?: string; role?: string; payModel?: string; salaryAmount?: number }[]>(),
      Settings.findOne({ key: "center" }).lean<{ assistantSalary?: number } | null>(),
    ]);
    const defaultAssistantSalary = Math.max(0, Math.round(Number(st?.assistantSalary) || 0));
    const importable = candidates
      .filter((u) => !linkedIds.has(String(u._id)))
      .filter((u) => (u.role === "specialist" && u.payModel === "salary") || u.role === "assistant")
      .map((u) => ({
        _id: String(u._id),
        name: u.name || "—",
        role: u.role === "specialist" ? "specialist" : "assistant",
        salaryAmount: u.role === "assistant"
          ? Math.max(0, Math.round(Number(u.salaryAmount) || 0)) || defaultAssistantSalary
          : Math.max(0, Math.round(Number(u.salaryAmount) || 0)),
      }));

    return ok({ month, employees, importable });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser(["admin"]);
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "");

    /* ── الموظفون ── */
    if (action === "employee.add") {
      const name = String(b.name || "").trim();
      if (name.length < 2) return fail(400, "اسم الموظف مطلوب");
      const role = ["specialist", "assistant", "cleaner", "guard", "other"].includes(b.role) ? b.role : "other";
      const e = await HrEmployee.create({
        name,
        role,
        baseSalary: Math.max(0, Math.round(Number(b.baseSalary) || 0)),
        phone: String(b.phone || "").trim(),
        notes: String(b.notes || "").trim(),
        photoBase64: typeof b.photoBase64 === "string" && b.photoBase64.length <= 6_000_000 ? b.photoBase64 : "",
        userId: b.userId || null,
        active: true,
      });
      return ok({ employee: { _id: String(e._id) } });
    }

    if (action === "employee.update") {
      const $set: Record<string, unknown> = {};
      if (b.name !== undefined) {
        const name = String(b.name).trim();
        if (name.length < 2) return fail(400, "اسم الموظف مطلوب");
        $set.name = name;
      }
      if (b.role !== undefined && ["specialist", "assistant", "cleaner", "guard", "other"].includes(b.role))
        $set.role = b.role;
      if (b.baseSalary !== undefined) $set.baseSalary = Math.max(0, Math.round(Number(b.baseSalary) || 0));
      if (b.phone !== undefined) $set.phone = String(b.phone).trim();
      if (b.notes !== undefined) $set.notes = String(b.notes).trim();
      if (typeof b.active === "boolean") $set.active = b.active;
      /* ★ v3.26: رفع صورة الموظف (اختياري) — للحساب المرتبط تُحفظ مكان صورة الحساب الأصلية */
      if (b.photoBase64 !== undefined) {
        const ph = String(b.photoBase64 || "");
        if (ph.length > 6_000_000) return fail(400, "الصورة كبيرة جداً (الحد ~4.5MB)");
        $set.photoBase64 = ph;
        if (ph) {
          const cur = await HrEmployee.findById(b._id).select("userId").lean<{ userId?: unknown } | null>();
          const uid = cur?.userId ? String(cur.userId) : "";
          if (uid && /^[0-9a-fA-F]{24}$/.test(uid)) {
            await User.findByIdAndUpdate(uid, { $set: { photoBase64: ph } });
          }
        }
      }
      const e = await HrEmployee.findByIdAndUpdate(b._id, { $set }, { new: true }).lean();
      if (!e) return fail(404, "الموظف غير موجود");
      return ok();
    }

    if (action === "employee.delete") {
      const e = await HrEmployee.findById(b._id).lean<{ _id: unknown } | null>();
      if (!e) return fail(404, "الموظف غير موجود");
      await Promise.all([
        HrAttendance.deleteMany({ employeeId: e._id }),
        HrLeave.deleteMany({ employeeId: e._id }),
        HrPayment.deleteMany({ employeeId: e._id }),
        HrEmployee.findByIdAndDelete(e._id),
      ]);
      return ok();
    }

    /* ── الحضور اليومي — دورة الحالة أو الحذف ── */
    if (action === "attendance.set") {
      const employeeId = String(b.employeeId || "");
      const date = String(b.date || "");
      if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, "موظف وتاريخ مطلوبان");
      const status = String(b.status || "");
      if (status === "") {
        await HrAttendance.deleteOne({ employeeId, date });
      } else if (["present", "absent", "leave", "holiday"].includes(status)) {
        await HrAttendance.findOneAndUpdate(
          { employeeId, date },
          { employeeId, date, status, note: String(b.note || "") },
          { upsert: true, new: true }
        );
      } else {
        return fail(400, "حالة غير صحيحة");
      }
      return ok();
    }

    /* ── ★ v3.24.1: حفظ دفعي للتغييرات — الحفظ اليدوي الواحد بعد تعديلات متعددة ──
       changes: [{ date, status }] — الحالة "" تعني حذف السجل (غير المسجَّل = حاضر) */
    if (action === "attendance.batch") {
      const employeeId = String(b.employeeId || "");
      if (!employeeId) return fail(400, "الموظف مطلوب");
      const changes = Array.isArray(b.changes) ? b.changes : [];
      if (!changes.length) return fail(400, "لا تغييرات لحفظها");
      for (const ch of changes) {
        const date = String(ch?.date || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, `تاريخ غير صحيح: ${date}`);
        const status = String(ch?.status || "");
        if (status === "") {
          await HrAttendance.deleteOne({ employeeId, date });
        } else if (["present", "absent", "leave", "holiday"].includes(status)) {
          await HrAttendance.findOneAndUpdate(
            { employeeId, date },
            { employeeId, date, status },
            { upsert: true, new: true }
          );
        } else {
          return fail(400, `حالة غير صحيحة: ${status}`);
        }
      }
      return ok();
    }

    /* ── الإجازات ── */
    if (action === "leave.add") {
      const employeeId = String(b.employeeId || "");
      const start = String(b.start || "");
      const end = String(b.end || start);
      if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end))
        return fail(400, "موظف وتواريخ صحيحة مطلوبة");
      if (end < start) return fail(400, "تاريخ النهاية قبل البداية");
      await HrLeave.create({
        employeeId,
        start,
        end,
        type: b.type === "unpaid" ? "unpaid" : "paid",
        note: String(b.note || "").trim(),
      });
      return ok();
    }
    if (action === "leave.delete") {
      await HrLeave.findByIdAndDelete(b._id);
      return ok();
    }
    /* ── ★ v3.24.1: تعديل إجازة — التواريخ والنوع والسبب الاختياري ── */
    if (action === "leave.edit") {
      const start = String(b.start || "");
      const end = String(b.end || start);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end))
        return fail(400, "تواريخ صحيحة مطلوبة");
      if (end < start) return fail(400, "تاريخ النهاية قبل البداية");
      const e = await HrLeave.findOneAndUpdate(
        { _id: b._id },
        {
          start,
          end,
          type: b.type === "unpaid" ? "unpaid" : "paid",
          note: String(b.note || "").trim(),
        },
        { new: true }
      ).lean();
      if (!e) return fail(404, "الإجازة غير موجودة");
      return ok();
    }

    /* ── الدفعات ── */
    if (action === "payment.add") {
      const employeeId = String(b.employeeId || "");
      const month = String(b.month || "");
      const type = String(b.type || "");
      const amount = Math.round(Number(b.amount) || 0);
      if (!employeeId || !isYm(month)) return fail(400, "موظف وشهر صحيحان مطلوبان");
      if (!["acompte", "salary", "bonus", "deduction"].includes(type)) return fail(400, "نوع الدفعة غير صحيح");
      if (amount <= 0) return fail(400, "المبلغ يجب أن يكون أكبر من صفر");
      await HrPayment.create({
        employeeId,
        month,
        type,
        amount,
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || "")) ? String(b.date) : ymOf(new Date()) + "-01",
        note: String(b.note || "").trim(),
        byName: me.name || "",
      });
      return ok();
    }
    if (action === "payment.delete") {
      await HrPayment.findByIdAndDelete(b._id);
      return ok();
    }
    /* ── ★ v3.24.1: تعديل دفعة — النوع والمبلغ والتاريخ والسبب الاختياري ── */
    if (action === "payment.edit") {
      const $setP: Record<string, unknown> = {};
      if (b.type !== undefined) {
        if (!["acompte", "salary", "bonus", "deduction"].includes(String(b.type))) return fail(400, "نوع الدفعة غير صحيح");
        $setP.type = String(b.type);
      }
      if (b.amount !== undefined) {
        const amount = Math.round(Number(b.amount) || 0);
        if (amount <= 0) return fail(400, "المبلغ يجب أن يكون أكبر من صفر");
        $setP.amount = amount;
      }
      if (b.date !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date || ""))) return fail(400, "التاريخ غير صحيح");
        $setP.date = String(b.date);
      }
      if (b.note !== undefined) $setP.note = String(b.note || "").trim();
      if (!Object.keys($setP).length) return fail(400, "لا تغييرات لحفظها");
      const p = await HrPayment.findOneAndUpdate({ _id: b._id }, { $set: $setP }, { new: true }).lean();
      if (!p) return fail(404, "الدفعة غير موجودة");
      return ok();
    }

    return fail(400, "إجراء غير معروف");
  });
}

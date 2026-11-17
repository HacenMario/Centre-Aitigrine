/**
 * ورقة الراتب (★ v3.24) — الإدارة فقط
 * GET ?employeeId=<id>&month=YYYY-MM → كل معطيات ورقة الراتب القابلة للطباعة:
 * بيانات الموظف + ملخص الاحتساب (الأساس/الغياب/الخصم/المكافآت) + الدفعات + الإجازات + صافي المستحق
 * ★ v3.24.1: معرّفات الدفعات والإجازات تُعاد للواجهة (كان غيابها يُفشل الحذف والتعديل
 * من بطاقة التفصيل)، + اسم المركز والعنوان بكل اللغات واللوغو لورقة راتب احترافية.
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { HrAttendance, HrEmployee, HrLeave, HrPayment, Settings } from "@/lib/models";
import { requireUser } from "@/lib/auth";
import { isYm, ymOf } from "@/lib/payroll";
import { employeeStats } from "@/lib/hr";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin"]);
    const employeeId = req.nextUrl.searchParams.get("employeeId") || "";
    const month = req.nextUrl.searchParams.get("month") || ymOf(new Date());
    if (!employeeId || !isYm(month)) return fail(400, "موظف وشهر صحيحان مطلوبان");

    const emp = await HrEmployee.findById(employeeId).lean<{
      _id: unknown; name?: string; role?: string; baseSalary?: number; phone?: string; notes?: string; active?: boolean;
    } | null>();
    if (!emp) return fail(404, "الموظف غير موجود");

    const [stats, payments, leaves, attRows, st] = await Promise.all([
      employeeStats(emp, month),
      HrPayment.find({ employeeId: emp._id, month }).sort({ createdAt: 1 }).lean<
        { _id: unknown; type: string; amount: number; date: string; note?: string; byName?: string }[]
      >(),
      HrLeave.find({ employeeId: emp._id }).sort({ start: 1 }).lean<
        { _id: unknown; start: string; end: string; type: string; note?: string }[]
      >(),
      HrAttendance.find({ employeeId: emp._id, date: { $regex: `^${month}-` } })
        .sort({ date: 1 })
        .lean<{ date: string; status: string; note?: string }[]>(),
      Settings.findOne({ key: "center" }).lean<{
        centerName?: string; centerNameFr?: string; centerNameEn?: string; centerNameTr?: string; centerNameEs?: string;
        address?: string; addressFr?: string; addressEn?: string; addressTr?: string; addressEs?: string;
        phone?: string; logoBase64?: string;
      } | null>(),
    ]);

    return ok({
      employee: {
        _id: String(emp._id),
        name: emp.name || "—",
        role: emp.role || "other",
        baseSalary: Math.max(0, Math.round(Number(emp.baseSalary) || 0)),
        phone: emp.phone || "",
      },
      month,
      /* ★ v3.24.1: المركز بكل اللغات — ورقة الراتب تترجم الاسم والعنوان حسب لغة الوثيقة */
      center: {
        name: st?.centerName || "مركز آيت تقرين",
        nameFr: st?.centerNameFr || "",
        nameEn: st?.centerNameEn || "",
        nameTr: st?.centerNameTr || "",
        nameEs: st?.centerNameEs || "",
        address: st?.address || "",
        addressFr: st?.addressFr || "",
        addressEn: st?.addressEn || "",
        addressTr: st?.addressTr || "",
        addressEs: st?.addressEs || "",
        phone: st?.phone || "",
        logoBase64: st?.logoBase64 || "",
      },
      issuedOn: ymOf(new Date()) === month ? new Date().toISOString() : `${month}-28`,
      stats,
      /* ★ v3.24.1: المعرّفات إلزامية للتعديل والحذف من بطاقة التفصيل */
      payments: payments.map((p) => ({ _id: String(p._id), type: p.type, amount: Math.round(Number(p.amount) || 0), date: p.date, note: p.note || "", byName: p.byName || "" })),
      leaves: leaves.map((l) => ({ _id: String(l._id), start: l.start, end: l.end, type: l.type, note: l.note || "" })),
      attendance: attRows.map((a) => ({ date: a.date, status: a.status, note: a.note || "" })),
    });
  });
}

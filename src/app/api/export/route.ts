/**
 * تصدير البيانات Excel/CSV (v3.8) — للإدارة والمساعد
 * GET /api/export?type=appointments|clients|invoices
 * ★ CSV بترميز UTF-8 + BOM — يفتح مباشرة في Excel بأعمدة عربية سليمة
 * الحجوزات: التاريخ، التوقيت، العميل، الأخصائي، الخدمة، الحالة، السعر، الخصم، النهائي، الدفع، الكوبون
 * العملاء: الاسم، الهاتف، الأخصائي المعالج، عدد الجلسات، تاريخ التسجيل
 * الفواتير: رقم الفاتورة، التاريخ، العميل، الخدمة، السعر، الخصم، الصافي، حالة الدفع
 */
import { NextRequest, NextResponse } from "next/server";
import { fail, handle } from "@/lib/api-helpers";
import { Appointment, User } from "@/lib/models";
import { requireUser, isStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

function csvCell(v: unknown): string {
  const s = String(v ?? "").replace(/"/g, '""');
  return `"${s}"`;
}
function csv(rows: (string | number)[][]): string {
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    if (!isStaff(me.role)) return fail(403, "لا تملك صلاحية لتصدير البيانات");
    const type = req.nextUrl.searchParams.get("type") || "appointments";

    /* خط واحد في كل صف — بلا فواصل أسطر داخل الخلايا */
    const flat = (s: string) => (s || "").replace(/[\r\n]+/g, " ").trim();

    if (type === "clients") {
      const users = await User.find({ role: { $in: ["client", "specialist", "assistant", "admin"] } })
        .sort({ createdAt: -1 })
        .lean<Record<string, unknown>[]>();
      const rows: (string | number)[][] = [
        ["الاسم الكامل", "الهاتف", "الدور", "الحالة", "تاريخ التسجيل"],
      ];
      for (const u of users) {
        rows.push([
          flat(String(u.name || "")),
          flat(String(u.phone || "")),
          flat(String(u.role || "")),
          u.active === false ? "معطل" : "نشط",
          String(u.createdAt || ""),
        ]);
      }
      await logAudit({ _id: me._id, name: me.name, role: me.role }, "export.clients", "الحسابات", `${users.length} سجل`);
      return new NextResponse(csv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="clients-${Date.now()}.csv"`,
        },
      });
    }

    if (type === "invoices") {
      const appts = await Appointment.find({ invoiceNumber: { $ne: "" } })
        .sort({ createdAt: -1 })
        .lean<Record<string, unknown>[]>();
      const clientIds = [...new Set(appts.map((a) => String(a.clientId)))];
      const specIds = [...new Set(appts.map((a) => String(a.specialistId)))];
      const users = await User.find({ _id: { $in: [...clientIds, ...specIds] } })
        .select("name")
        .lean<Record<string, unknown>[]>();
      const nameOf = new Map(users.map((u) => [String(u._id), String(u.name || "")]));
      const rows: (string | number)[][] = [
        ["رقم الفاتورة", "تاريخ الجلسة", "التوقيت", "العميل", "الأخصائي", "الخدمة", "السعر", "الخصم", "الصافي", "الدفع", "تاريخ الإصدار"],
      ];
      for (const a of appts) {
        const price = Number(a.price || 0);
        const disc = Number(a.discount || 0);
        rows.push([
          flat(String(a.invoiceNumber || "")),
          flat(String(a.date || "")),
          flat(String(a.time || "")),
          flat(nameOf.get(String(a.clientId)) || "—"),
          flat(nameOf.get(String(a.specialistId)) || "—"),
          flat(String(a.serviceTitle || a.kind || "")),
          price,
          disc,
          Math.max(0, price - disc),
          a.paymentStatus === "paid" ? "مدفوع" : "غير مدفوع",
          String(a.invoiceAt || ""),
        ]);
      }
      await logAudit({ _id: me._id, name: me.name, role: me.role }, "export.invoices", "الفواتير", `${appts.length} سجل`);
      return new NextResponse(csv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="invoices-${Date.now()}.csv"`,
        },
      });
    }

    /* افتراضي: الحجوزات */
    const appts = await Appointment.find({})
      .sort({ date: -1, time: -1 })
      .limit(5000)
      .lean<Record<string, unknown>[]>();
    const clientIds = [...new Set(appts.map((a) => String(a.clientId)))];
    const specIds = [...new Set(appts.map((a) => String(a.specialistId)))];
    const users = await User.find({ _id: { $in: [...clientIds, ...specIds] } })
      .select("name phone")
      .lean<Record<string, unknown>[]>();
    const nameOf = new Map(users.map((u) => [String(u._id), String(u.name || "")]));
    const phoneOf = new Map(users.map((u) => [String(u._id), String(u.phone || "")]));
    const STATUS: Record<string, string> = { pending: "بانتظار التأكيد", confirmed: "مؤكد", completed: "منتهي", cancelled: "ملغى" };
    const rows: (string | number)[][] = [
      ["التاريخ", "التوقيت", "العميل", "هاتف العميل", "الأخصائي", "الخدمة", "النوع", "الطريقة", "الحالة", "السعر", "الخصم", "الصافي", "الدفع", "الكوبون", "ملاحظات"],
    ];
    for (const a of appts) {
      const price = Number(a.price || 0);
      const disc = Number(a.discount || 0);
      rows.push([
        flat(String(a.date || "")),
        flat(String(a.time || "")),
        flat(nameOf.get(String(a.clientId)) || "—"),
        flat(phoneOf.get(String(a.clientId)) || ""),
        flat(nameOf.get(String(a.specialistId)) || "—"),
        flat(String(a.serviceTitle || "")),
        a.kind === "art_therapy" ? "علاج فني" : "نفسي",
        a.mode === "remote" ? "عن بُعد" : "حضورية",
        STATUS[String(a.status)] || String(a.status || ""),
        price,
        disc,
        Math.max(0, price - disc),
        a.paymentStatus === "paid" ? "مدفوع" : "غير مدفوع",
        flat(String(a.couponCode || "")),
        flat(String(a.notes || "")),
      ]);
    }
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "export.appointments", "الحجوزات", `${appts.length} سجل`);
    return new NextResponse(csv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="appointments-${Date.now()}.csv"`,
      },
    });
  });
}

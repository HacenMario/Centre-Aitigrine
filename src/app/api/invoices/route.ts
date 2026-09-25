/**
 * الفواتير PDF (v3.8)
 * GET /api/invoices?id=<appointmentId> → يولّد الفاتورة عند الحاجة (idempotent) ويعيدها PDF
 *   صلاحيات: صاحب الموعد، الأخصائي المعالج، أو الإدارة
 * GET /api/invoices?mine=1 → قائمة فواتير العميل الحالي (ملف العميل)
 */
import { NextRequest, NextResponse } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Appointment } from "@/lib/models";
import { requireUser, isStaff } from "@/lib/auth";
import { ensureInvoice } from "@/lib/invoice";
import { openMedia } from "@/lib/media-store";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    const sp = req.nextUrl.searchParams;
    const id = sp.get("id") || "";

    /* قائمة فواتير ملف العميل */
    if (sp.get("mine")) {
      const staff = isStaff(me.role);
      const filter = staff ? { invoiceNumber: { $ne: "" } } : { clientId: me._id, invoiceNumber: { $ne: "" } };
      const rows = await Appointment.find(filter)
        .sort({ invoiceAt: -1 })
        .limit(200)
        .lean<Record<string, unknown>[]>();
      return ok({
        items: rows.map((a) => ({
          _id: String(a._id),
          invoiceNumber: a.invoiceNumber || "",
          invoiceFile: a.invoiceFile || "",
          invoiceAt: a.invoiceAt,
          date: a.date,
          time: a.time,
          serviceTitle: a.serviceTitle || "",
          price: a.price || 0,
          discount: a.discount || 0,
          paymentStatus: a.paymentStatus,
        })),
      });
    }

    if (!id) return fail(400, "معرّف الموعد مطلوب");
    const appt = await Appointment.findById(id).lean<Record<string, unknown> | null>();
    if (!appt) return fail(404, "الموعد غير موجود");
    const isOwner = String(appt.clientId) === String(me._id);
    const isSpec = String(appt.specialistId) === String(me._id);
    if (!isOwner && !isSpec && !isStaff(me.role))
      return fail(403, "لا تملك صلاحية لهذه الفاتورة");

    const inv = await ensureInvoice(id);
    if (!inv) return fail(500, "تعذر توليد الفاتورة");
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "invoice.download", `فاتورة: ${inv.number}`, isStaff(me.role) ? "تنزيل إداري" : "تنزيل العميل", id);

    const stream = await openMedia(inv.file);
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${inv.file}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}

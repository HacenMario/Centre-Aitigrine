/** تغيير حالة الموعد / تعديله / حذفه — إشعارات ثلاثية اللغة لكل طرف نصه
 * ★ v3.8: عند إنهاء الجلسة أو أداء المبلغ تُولّد الفاتورة PDF تلقائياً وتُحفظ في ملف العميل
 *   + سجل تدقيق لكل تعديل/حذف
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Appointment } from "@/lib/models";
import { currentUser, isStaff, requireUser } from "@/lib/auth";
import { notifyStaff, notifyUser } from "@/lib/push";
import { statusChangedText } from "@/lib/notify-text";
import { ensureInvoice } from "@/lib/invoice";
import { logAudit } from "@/lib/audit";
import type * as M from "@/lib/models";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const a = await Appointment.findById(id);
    if (!a) return fail(404, "الموعد غير موجود");

    /* العميل يلغي موعده فقط */
    if (me.role === "client") {
      if (String(a.clientId) !== String(me._id)) return fail(403, "غير مسموح");
      if (String(req.body) === "") return fail(400, "لا شيء");
      const b = await req.json().catch(() => ({}));
      if (b.status === "cancelled") {
        a.status = "cancelled";
        await a.save();
        await logAudit({ _id: me._id, name: me.name, role: me.role }, "appointment.cancel", `موعد: ${a.date} ${a.time}`, "إلغاء من العميل", String(a._id));
        /* الأخصائي: إشعار الإلغاء — الإدارة: ملخص إداري */
        notifyUser(
          String(a.specialistId),
          statusChangedText({ status: "cancelled", date: a.date, time: a.time, toClient: false }),
          "status",
          "appointments"
        );
        notifyStaff(
          statusChangedText({ status: "cancelled", date: a.date, time: a.time, toClient: false }),
          "status",
          "appointments"
        );
        return ok({ appointment: a.toObject() });
      }
      return fail(403, "العميل يلغي فقط");
    }

    const b = await req.json().catch(() => ({}));
    const staff = isStaff(me.role);
    const isOwnerSpec = me.role === "specialist" && String(a.specialistId) === String(me._id);
    if (!staff && !isOwnerSpec) return fail(403, "غير مسموح");

    let statusChanged = false;
    if (b.status && ["pending", "confirmed", "completed", "cancelled"].includes(b.status) && b.status !== a.status) {
      a.status = b.status;
      statusChanged = true;
    }
    if (staff) {
      if (b.date) a.date = String(b.date);
      if (b.time) a.time = String(b.time);
      if (b.notes !== undefined) a.notes = String(b.notes);
      if (b.serviceTitle !== undefined) a.serviceTitle = String(b.serviceTitle);
      if (["onsite", "remote"].includes(b.mode)) a.mode = b.mode;
      /* v3.5: المبالغ — الإدارة تحدد سعر الجلسة وحالة الأداء (تُحدّث لوحة القيادة) */
      if (b.price !== undefined) {
        const p = Number(b.price);
        if (!isNaN(p) && p >= 0) a.price = p;
      }
      if (["unpaid", "paid"].includes(b.paymentStatus)) a.paymentStatus = b.paymentStatus;
    }
    await a.save();

    /* ★ v3.8: توليد الفاتورة تلقائياً عند إنهاء الجلسة أو أداء المبلغ */
    const shouldInvoice = a.status === "completed" || a.paymentStatus === "paid";
    let invoice: { number: string; file: string } | null = null;
    if (shouldInvoice) {
      try {
        invoice = await ensureInvoice(String(a._id));
      } catch (e) {
        console.error("auto invoice failed:", (e as Error)?.message);
      }
    }

    /* سجل تدقيق للتعديلات الإدارية */
    if (staff || isOwnerSpec) {
      const changes: string[] = [];
      if (statusChanged) changes.push(`status=${a.status}`);
      if (b.price !== undefined) changes.push(`price=${a.price}`);
      if (["unpaid", "paid"].includes(b.paymentStatus)) changes.push(`payment=${a.paymentStatus}`);
      if (b.date) changes.push(`date=${a.date}`);
      if (b.time) changes.push(`time=${a.time}`);
      await logAudit({ _id: me._id, name: me.name, role: me.role }, "appointment.update", `موعد: ${a.date} ${a.time}`, changes.join(", ") || "تعديل", String(a._id));
    }

    /* إشعارات ثلاثية اللغة — لكل طرف نصه الخاص:
     * العميل يتلقى حالة موعده دائماً
     * الأخصائي يتلقى الإلغاء فقط إذا لم يكن هو الفاعل
     * الإدارة توقّع ملخصاً إدارياً عندما يكون الفاعل أخصائياً */
    if (statusChanged) {
      const status = a.status as "pending" | "confirmed" | "completed" | "cancelled";
      notifyUser(String(a.clientId), statusChangedText({ status, date: a.date, time: a.time, toClient: true }), "status", `appointments:${String(a._id)}`);
      if (status === "cancelled" && !isOwnerSpec) {
        notifyUser(String(a.specialistId), statusChangedText({ status, date: a.date, time: a.time, toClient: false }), "status", `appointments:${String(a._id)}`);
      }
      if (!staff) {
        /* الأخصائي هو الفاعل → الإدارة توقّع ملخصاً */
        notifyStaff(statusChangedText({ status, date: a.date, time: a.time, toClient: false }), "status", `appointments:${String(a._id)}`);
      }
    }
    return ok({ appointment: a.toObject(), invoice });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const a = await Appointment.findById(id);
    if (!a) return fail(404, "الموعد غير موجود");
    const staff = isStaff(me.role);
    const isOwnerSpec = me.role === "specialist" && String(a.specialistId) === String(me._id);
    const ownPending =
      me.role === "client" && String(a.clientId) === String(me._id) && a.status === "pending";
    if (!staff && !isOwnerSpec && !ownPending) return fail(403, "غير مسموح");
    const info = `${a.date} ${a.time}`;
    await a.deleteOne();
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "appointment.delete", `موعد: ${info}`, "حذف", id);
    return ok();
  });
}

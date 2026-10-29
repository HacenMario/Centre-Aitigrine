/** تغيير حالة الموعد / تعديله / حذفه — إشعارات ثلاثية اللغة لكل طرف نصه
 * ★ v3.8: عند إنهاء الجلسة أو أداء المبلغ تُولّد الفاتورة PDF تلقائياً وتُحفظ في ملف العميل
 *   + سجل تدقيق لكل تعديل/حذف
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Appointment, User } from "@/lib/models";
import { currentUser, isStaff, requireUser } from "@/lib/auth";
import { notifyStaff, notifyUser } from "@/lib/push";
import { statusChangedText, rescheduledText } from "@/lib/notify-text";
import { ensureInvoice } from "@/lib/invoice";
import { logAudit } from "@/lib/audit";
import { mapToObj } from "@/lib/map";
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

    /* ★ v3.12: تغيير وقت الموعد كاملاً — للإدارة وللأخصائي صاحب الموعد
     * التحقق الخادمي الكامل قبل التطبيق:
     * ١) صيغة صحيحة + وقت قادم (هامش دقيقتين)
     * ٢) التوقيت الجديد من الأوقات المحفوظة في إعدادات الأخصائي حصراً
     * ۳) بلا تصادم للأخصائي ولا للعميل (عدا الموعد نفسه)
     * ٤) إعادة تفعيل التذكيرات (يوم/ساعة) للتوقيت الجديد */
    let timeChanged = false;
    let oldDate = "";
    let oldTime = "";
    if ((b.date && String(b.date) !== a.date) || (b.time && String(b.time) !== a.time)) {
      oldDate = a.date;
      oldTime = a.time;
      const newDate = String(b.date || a.date);
      const newTime = String(b.time || a.time);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || !/^\d{2}:\d{2}$/.test(newTime))
        return fail(400, "تاريخ أو توقيت غير صحيح");
      const slotAt = new Date(`${newDate}T${newTime}:00`);
      if (isNaN(slotAt.getTime())) return fail(400, "تاريخ أو توقيت غير صحيح");
      if (slotAt.getTime() < Date.now() - 2 * 60_000)
        return fail(400, "لا يمكن النقل إلى وقت مضى — اختر توقيتاً قادماً");
      const specDoc = await User.findById(a.specialistId)
        .lean<{ weeklyHours?: unknown } | null>();
      const wh = mapToObj(specDoc?.weeklyHours) as Record<string, string[]>;
      const dow = String(new Date(`${newDate}T00:00:00`).getDay());
      const dayHours = wh[dow] || [];
      if (!dayHours.includes(newTime))
        return fail(400, "الأخصائي لا يستقبل في هذا التوقيت — اختر من الأوقات المحفوظة في إعداداته");
      const clash = await Appointment.findOne({
        _id: { $ne: a._id },
        specialistId: a.specialistId,
        date: newDate,
        time: newTime,
        status: { $in: ["pending", "confirmed"] },
      }).lean();
      if (clash) return fail(409, "هذا الوقت محجوز — اختر وقتاً آخر");
      const clientClash = await Appointment.findOne({
        _id: { $ne: a._id },
        clientId: a.clientId,
        date: newDate,
        time: newTime,
        status: { $in: ["pending", "confirmed"] },
      }).lean();
      if (clientClash) return fail(409, "العميل لديه موعد آخر في نفس هذا التوقيت");
      a.date = newDate;
      a.time = newTime;
      timeChanged = true;
      /* التذكيرات تُحسب من جديد على التوقيت الجديد */
      a.remindedDay = false;
      a.remindedHour = false;
    }

    if (staff) {
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
    /* ★ v3.21.3: شبكة أمان — تعارض فتحة نشطة عند النقل (سباق نادر) يُعرض كرسالة ودّية لا خطأ DB خام */
    try {
      await a.save();
    } catch (e) {
      if ((e as { code?: number })?.code === 11000)
        return fail(409, "هذا الوقت محجوز — اختر وقتاً آخر");
      throw e;
    }

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
      if (timeChanged) changes.push(`date=${a.date}`, `time=${a.time}`);
      if (b.price !== undefined) changes.push(`price=${a.price}`);
      if (["unpaid", "paid"].includes(b.paymentStatus)) changes.push(`payment=${a.paymentStatus}`);
      await logAudit({ _id: me._id, name: me.name, role: me.role }, "appointment.update", `موعد: ${a.date} ${a.time}`, changes.join(", ") || "تعديل", String(a._id));
    }

    /* ★ v3.12: إشعار تغيير الوقت — يصل العميل فوراً بالتوقيت الجديد والقديم
     * (نصوص خمس لغات — الواجهة وWeb Push تعرضان لغة المستخدم) */
    if (timeChanged) {
      const specInfo = await User.findById(a.specialistId)
        .select("name")
        .lean<{ name?: string } | null>();
      const clientInfo = await User.findById(a.clientId)
        .select("name")
        .lean<{ name?: string } | null>();
      /* العميل: نصه الخاص بالتوقيت الجديد */
      notifyUser(
        String(a.clientId),
        rescheduledText({ oldDate, oldTime, date: a.date, time: a.time, toClient: true, otherName: specInfo?.name || "" }),
        "status",
        `appointments:${String(a._id)}`
      );
      if (staff && !isOwnerSpec) {
        /* الإدارة هي الفاعلة → الأخصائي يتلقى نصه الخاص */
        notifyUser(
          String(a.specialistId),
          rescheduledText({ oldDate, oldTime, date: a.date, time: a.time, toClient: false, clientName: clientInfo?.name || "" }),
          "status",
          `appointments:${String(a._id)}`
        );
      }
      if (!staff) {
        /* الأخصائي هو الفاعل → الإدارة توقّع ملخصاً */
        notifyStaff(
          rescheduledText({ oldDate, oldTime, date: a.date, time: a.time, toClient: false, clientName: clientInfo?.name || "" }),
          "status",
          `appointments:${String(a._id)}`
        );
      }
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

/**
 * المواعيد
 * GET ?mode=taken&specialistId&date → الأوقات المحجوزة
 * GET → مواعيد حسب الدور (العميل: مواعيده — الأخصائي: جلساته — الإدارة: الكل)
 * POST: حجز (عميل لنفسه أو إدارة لعميل) مع فحص التصادم + إشعارات لكل الأطراف
 * ★ v3.8: تطبيق كوبون الخصم عند الحجز + سجل تدقيق
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Appointment, Coupon, Service, User } from "@/lib/models";
import { currentUser, requireUser } from "@/lib/auth";
import { notifyStaff, notifyUser } from "@/lib/push";
import { mapToObj } from "@/lib/map";
import { bookingCreatedText } from "@/lib/notify-text";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    const { searchParams } = new URL(req.url);

    /* أوقات محجوزة لأخصائي ويوم معين */
    if (searchParams.get("mode") === "taken") {
      const specialistId = String(searchParams.get("specialistId") || "");
      const date = String(searchParams.get("date") || "");
      if (!specialistId || !date) return ok({ taken: [] });
      const rows = await Appointment.find({
        specialistId,
        date,
        status: { $in: ["pending", "confirmed"] },
      })
        .select("time")
        .lean<{ time: string }[]>();
      return ok({ taken: rows.map((r) => r.time).sort() });
    }

    let q: Record<string, unknown> = {};
    if (me.role === "client") q = { clientId: me._id };
    else if (me.role === "specialist") q = { specialistId: me._id };
    else if (me.role === "trainer")
      /* ★ v3.11: المكوّن لا يستقبل مواعيد أصلاً — نُرجع قائمة فارغة دائماً
       * (يمنع أيضاً أي تسلّل لرؤية مواعيد الآخرين عبر نداء مباشر) */
      q = { specialistId: me._id };
    else {
      const status = searchParams.get("status");
      if (status) q.status = status;
    }
    const appts = await Appointment.find(q)
      .sort({ date: -1, time: -1 })
      .limit(500)
      .lean();
    /* تعبئة أسماء الأطراف */
    const ids = new Set<string>();
    appts.forEach((a) => {
      ids.add(String(a.clientId));
      ids.add(String(a.specialistId));
    });
    const users = await User.find({ _id: { $in: [...ids] } })
      .select("name role")
      .lean<{ _id: unknown; name: string; role: string }[]>();
    const nameMap = new Map(users.map((u) => [String(u._id), u.name]));
    return ok({
      appointments: appts.map((a) => ({
        ...a,
        clientName: nameMap.get(String(a.clientId)) || "—",
        specialistName: nameMap.get(String(a.specialistId)) || "—",
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    const b = await req.json().catch(() => ({}));

    const clientId =
      me.role === "client" ? String(me._id) : String(b.clientId || "");
    if (!clientId) return fail(400, "حدد العميل");
    if (me.role === "client" && b.clientId && String(b.clientId) !== String(me._id))
      return fail(403, "لا يمكنك الحجز لغيرك");

    const specialistId = String(b.specialistId || "");
    const date = String(b.date || "");
    const time = String(b.time || "");
    if (!specialistId || !date || !time) return fail(400, "الأخصائي والتاريخ والوقت مطلوبة");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, "تاريخ غير صحيح");
    if (!/^\d{2}:\d{2}$/.test(time)) return fail(400, "توقيت غير صحيح");
    if (clientId === specialistId) return fail(400, "لا يمكن حجز موعد مع النفس");

    /* لا حجز في الماضي (نمط طمأنينة: هامش دقيقتين) */
    const slotAt = new Date(`${date}T${time}:00`);
    if (isNaN(slotAt.getTime())) return fail(400, "تاريخ أو توقيت غير صحيح");
    if (slotAt.getTime() < Date.now() - 2 * 60_000)
      return fail(400, "لا يمكن الحجز في وقت مضى — اختر توقيتاً قادماً");

    /* العميل لا يحجز موعدين في نفس الوقت */
    const myClash = await Appointment.findOne({
      clientId,
      date,
      time,
      status: { $in: ["pending", "confirmed"] },
    }).lean();
    if (myClash) return fail(409, "لديك موعد آخر في نفس هذا التوقيت");

    const spec = await User.findById(specialistId).lean();
    if (!spec || spec.role !== "specialist" || spec.active === false)
      return fail(400, "الأخصائي غير متاح");

    /* ★ v3.12: احترام أوقات الأخصائي المحفوظة حصراً (نمط طمأنينة SLOT_UNAVAILABLE)
     * فقط المواعيد المحفوظة في إعدادات الأخصائي قابلة للحجز —
     * أوقات العيادة العامة لا تطغى أبداً: اليوم بلا أوقات محفوظة = لا حجز */
    const wh = mapToObj(spec.weeklyHours) as Record<string, string[]>;
    const dow = String(new Date(`${date}T00:00:00`).getDay());
    const dayHours = wh[dow] || [];
    if (!dayHours.includes(time))
      return fail(400, "الأخصائي لا يستقبل في هذا التوقيت — اختر من الأوقات المحفوظة في إعداداته");

    /* فحص تصادم: نفس الأخصائي + نفس اليوم + نفس الوقت */
    const clash = await Appointment.findOne({
      specialistId,
      date,
      time,
      status: { $in: ["pending", "confirmed"] },
    }).lean();
    if (clash) return fail(409, "هذا الوقت محجوز — اختر وقتاً آخر");

    /* ★ v3.8: الكوبون والخصم — تحقق خادمي كامل قبل الحفظ */
    let couponCode = String(b.couponCode || "").trim().toUpperCase().slice(0, 24);
    let discount = 0;
    if (couponCode) {
      const c = await Coupon.findOne({ code: couponCode }).lean<Record<string, unknown> | null>();
      if (!c || c.active === false) return fail(404, "الكوبون غير موجود أو معطل");
      const exp = c.expiresAt ? new Date(c.expiresAt as Date).getTime() : 0;
      if (exp && exp < Date.now()) return fail(410, "انتهت صلاحية هذا الكوبون");
      if (Number(c.maxUses) > 0 && Number(c.usedCount) >= Number(c.maxUses))
        return fail(409, "استُنفدت عدد استخدامات هذا الكوبون");
      /* السعر المطبق عليه الكوبون: سعر الجلسة المرسل من الواجهة (0 → لا خصم) */
      const basePrice = Math.max(0, Number(b.price) || 0);
      if (Number(c.minPrice) > 0 && basePrice < Number(c.minPrice))
        return fail(422, `هذا الكوبون يتطلب سعراً لا يقل عن ${Number(c.minPrice)} دج`);
      const raw = c.kind === "percent" ? Math.round((basePrice * Number(c.value)) / 100) : Number(c.value);
      discount = Math.max(0, Math.min(raw, basePrice));
      await Coupon.findByIdAndUpdate(c._id, { $inc: { usedCount: 1 } });
    }

    /* ★ v3.12: الخدمة — يجب أن تكون مفعّلة ومن خدمات الأخصائي المرتبطة (إن حدّد خدماته)
     * العناوين المترجمة تُشتق من مستند الخدمة خادمياً (لا ثقة بنصوص الواجهة) */
    let serviceIdVal: string | null = null;
    let svcTitle = String(b.serviceTitle || "");
    let svcTitleFr = String(b.serviceTitleFr || "");
    let svcTitleEn = String(b.serviceTitleEn || "");
    if (b.serviceId) {
      const svc = await Service.findById(String(b.serviceId))
        .lean<{ _id: unknown; title: string; titleFr?: string; titleEn?: string; active?: boolean } | null>();
      if (!svc || svc.active === false) return fail(400, "الخدمة غير متاحة");
      const specSvcIds = (Array.isArray(spec.serviceIds) ? spec.serviceIds : []).map(String);
      if (specSvcIds.length && !specSvcIds.includes(String(svc._id)))
        return fail(400, "هذه الخدمة لا يقدمها هذا الأخصائي — اختر من خدماته");
      serviceIdVal = String(svc._id);
      svcTitle = svc.title;
      svcTitleFr = svc.titleFr || "";
      svcTitleEn = svc.titleEn || "";
    }

    let clientName = "";
    if (me.role !== "client") {
      const c = await User.findById(clientId).lean<{ name: string } | null>();
      clientName = c?.name || "";
    }

    const a = await Appointment.create({
      clientId,
      specialistId,
      serviceId: serviceIdVal,
      serviceTitle: svcTitle,
      serviceTitleFr: svcTitleFr,
      serviceTitleEn: svcTitleEn,
      kind: ["psychological", "art_therapy"].includes(b.kind) ? b.kind : "psychological",
      mode: ["onsite", "remote"].includes(b.mode) ? b.mode : "onsite",
      price: Math.max(0, Number(b.price) || 0),
      date,
      time,
      status: "pending",
      couponCode,
      discount,
      notes: String(b.notes || ""),
      createdBy: me._id,
    });
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "appointment.create", `موعد: ${date} ${time}`, `${couponCode ? `كوبون=${couponCode} خصم=${discount}` : "بلا كوبون"}`, String(a._id));

    /* إشعارات ثلاثية اللغة — لكل طرف نصه الخاص فقط:
     * العميل يرى حجزه، الأخصائي يرى موعده الجديد، والإدارة توقّع ملخصاً إدارياً
     * بصياغة مستقلة (ليست رسالة الأخصائي) */
    const specName = spec.name;
    if (!clientName) {
      const c = await User.findById(clientId).lean<{ name: string } | null>();
      clientName = c?.name || "";
    }
    notifyUser(clientId, bookingCreatedText({ date, time, serviceTitle: svcTitle, viewer: "client", otherName: specName }), "booking", `appointments:${String(a._id)}`);
    notifyUser(specialistId, bookingCreatedText({ date, time, viewer: "specialist", clientName }), "booking", `appointments:${String(a._id)}`);
    notifyStaff(bookingCreatedText({ date, time, viewer: "staff", otherName: specName, clientName }), "booking", `appointments:${String(a._id)}`);

    return ok({ appointment: a.toObject() });
  });
}

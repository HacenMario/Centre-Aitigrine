/**
 * المواعيد
 * GET ?mode=taken&specialistId&date → الأوقات المحجوزة
 * GET → مواعيد حسب الدور (العميل: مواعيده — الأخصائي: جلساته — الإدارة: الكل)
 * POST: حجز (عميل لنفسه أو إدارة لعميل) مع فحص التصادم + إشعارات لكل الأطراف
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Appointment, User } from "@/lib/models";
import { currentUser, requireUser } from "@/lib/auth";
import { notifyStaff, notifyUser } from "@/lib/push";
import { mapToObj } from "@/lib/map";
import { bookingCreatedText } from "@/lib/notify-text";

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

    /* احترام ساعات الأخصائي (نمط طمأنينة SLOT_UNAVAILABLE) — Map أو كائن عادي */
    const wh = mapToObj(spec.weeklyHours) as Record<string, string[]>;
    const dow = String(new Date(`${date}T00:00:00`).getDay());
    const dayHours = wh[dow] || [];
    if (dayHours.length && !dayHours.includes(time))
      return fail(400, "الأخصائي لا يستقبل في هذا التوقيت — اختر وقتاً آخر");

    /* فحص تصادم: نفس الأخصائي + نفس اليوم + نفس الوقت */
    const clash = await Appointment.findOne({
      specialistId,
      date,
      time,
      status: { $in: ["pending", "confirmed"] },
    }).lean();
    if (clash) return fail(409, "هذا الوقت محجوز — اختر وقتاً آخر");

    let clientName = "";
    if (me.role !== "client") {
      const c = await User.findById(clientId).lean<{ name: string } | null>();
      clientName = c?.name || "";
    }

    const a = await Appointment.create({
      clientId,
      specialistId,
      serviceId: b.serviceId || null,
      serviceTitle: String(b.serviceTitle || ""),
      serviceTitleFr: String(b.serviceTitleFr || ""),
      serviceTitleEn: String(b.serviceTitleEn || ""),
      serviceTitleTr: String(b.serviceTitleTr || ""),
      serviceTitleEs: String(b.serviceTitleEs || ""),
      kind: ["psychological", "art_therapy"].includes(b.kind) ? b.kind : "psychological",
      mode: ["onsite", "remote"].includes(b.mode) ? b.mode : "onsite",
      date,
      time,
      status: "pending",
      notes: String(b.notes || ""),
      createdBy: me._id,
    });

    /* إشعارات ثلاثية اللغة — لكل طرف نصه الخاص فقط:
     * العميل يرى حجزه، الأخصائي يرى موعده الجديد، والإدارة توقّع ملخصاً إدارياً
     * بصياغة مستقلة (ليست رسالة الأخصائي) */
    const specName = spec.name;
    if (!clientName) {
      const c = await User.findById(clientId).lean<{ name: string } | null>();
      clientName = c?.name || "";
    }
    notifyUser(clientId, bookingCreatedText({ date, time, serviceTitle: String(b.serviceTitle || ""), viewer: "client", otherName: specName }), "booking", `appointments:${String(a._id)}`);
    notifyUser(specialistId, bookingCreatedText({ date, time, viewer: "specialist", clientName }), "booking", `appointments:${String(a._id)}`);
    notifyStaff(bookingCreatedText({ date, time, viewer: "staff", otherName: specName, clientName }), "booking", `appointments:${String(a._id)}`);

    return ok({ appointment: a.toObject() });
  });
}

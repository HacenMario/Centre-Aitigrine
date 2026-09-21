/**
 * تقييمات الأخصائيين
 * GET ?specialistId=xx  → متوسط + توزيع + آخر التقييمات (عام — للجميع)
 *                        &viewerId= معرف العميل → يرجع تقييمي أيضاً
 * POST: عميل مسجل فقط { specialistId, stars, comment, appointmentId? }
 *       — بشرط وجود جلسة مكتملة مع الأخصائي (تقييم موثوق لا يأتي من فراغ)
 * DELETE ?id= — الإدارة فقط (تخفيف المحتوى المسيء)
 */
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Appointment, Rating, User } from "@/lib/models";
import { currentUser, requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const { searchParams } = new URL(req.url);
    const specialistId = String(searchParams.get("specialistId") || "");
    const viewerId = String(searchParams.get("viewerId") || "");
    if (!specialistId) return fail(400, "حدد الأخصائي");

    const [agg, items, viewer] = await Promise.all([
      /* ⚠️ aggregate لا يحوّل النص تلقائياً إلى ObjectId — التحويل يدوي إلزامي */
      Rating.aggregate([
        { $match: { specialistId: new mongoose.Types.ObjectId(specialistId) } },
        {
          $group: {
            _id: "$specialistId",
            avg: { $avg: "$stars" },
            count: { $sum: 1 },
            s1: { $sum: { $cond: [{ $eq: ["$stars", 1] }, 1, 0] } },
            s2: { $sum: { $cond: [{ $eq: ["$stars", 2] }, 1, 0] } },
            s3: { $sum: { $cond: [{ $eq: ["$stars", 3] }, 1, 0] } },
            s4: { $sum: { $cond: [{ $eq: ["$stars", 4] }, 1, 0] } },
            s5: { $sum: { $cond: [{ $eq: ["$stars", 5] }, 1, 0] } },
          },
        },
      ]),
      Rating.find({ specialistId })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean<{ _id: unknown; clientId: unknown; stars: number; comment: string; createdAt: Date }[]>(),
      viewerId ? currentUser() : Promise.resolve(null),
    ]);

    const clients = await User.find({ _id: { $in: items.map((r) => r.clientId) } })
      .select("name")
      .lean<{ _id: unknown; name: string }[]>();
    const nameMap = new Map(clients.map((c) => [String(c._id), c.name]));

    const a = agg[0];
    const myRating = viewer
      ? await Rating.findOne({ specialistId, clientId: viewer._id })
          .sort({ createdAt: -1 })
          .lean<{ stars: number; comment: string } | null>()
      : null;

    /* هل يستطيع الزائر التقييم؟ عميل له جلسة مكتملة مع هذا الأخصائي */
    let canRate = false;
    if (viewer && viewer.role === "client") {
      const done = await Appointment.countDocuments({
        clientId: viewer._id,
        specialistId,
        status: "completed",
      });
      canRate = done > 0;
    }

    return ok({
      avg: a ? Math.round(a.avg * 10) / 10 : 0,
      count: a?.count || 0,
      distribution: a
        ? [
            { stars: 5, count: a.s5 },
            { stars: 4, count: a.s4 },
            { stars: 3, count: a.s3 },
            { stars: 2, count: a.s2 },
            { stars: 1, count: a.s1 },
          ]
        : [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: 0 })),
      items: items.map((r) => ({
        _id: String(r._id),
        stars: r.stars,
        comment: r.comment || "",
        clientName: nameMap.get(String(r.clientId)) || "—",
        createdAt: r.createdAt,
      })),
      myRating: myRating ? { stars: myRating.stars, comment: myRating.comment || "" } : null,
      canRate,
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser(["client"]);
    const b = await req.json().catch(() => ({}));
    const specialistId = String(b.specialistId || "");
    const stars = Math.round(Number(b.stars));
    const comment = String(b.comment || "").slice(0, 600);
    if (!specialistId) return fail(400, "حدد الأخصائي");
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return fail(400, "التقييم من 1 إلى 5 نجوم");

    const spec = await User.findById(specialistId).lean<{ role?: string } | null>();
    if (!spec || spec.role !== "specialist") return fail(404, "الأخصائي غير موجود");

    /* جلسة مكتملة واحدة على الأقل مع هذا الأخصائي */
    const appt = await Appointment.findOne({
      clientId: me._id,
      specialistId,
      status: "completed",
    })
      .sort({ date: -1 })
      .lean<{ _id: unknown } | null>();
    if (!appt) return fail(403, "يمكنك التقييم بعد إتمام جلسة مع هذا الأخصائي");

    const appointmentId = b.appointmentId ? String(b.appointmentId) : String(appt._id);
    const existing = await Rating.findOne({ specialistId, clientId: me._id, appointmentId });
    if (existing) {
      existing.stars = stars;
      existing.comment = comment;
      await existing.save();
      return ok({ updated: true });
    }
    await Rating.create({
      specialistId,
      clientId: me._id,
      appointmentId,
      stars,
      comment,
    });
    return ok({ created: true });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin"]);
    const { searchParams } = new URL(req.url);
    const id = String(searchParams.get("id") || "");
    if (!id) return fail(400, "المعرّف مطلوب");
    await Rating.deleteOne({ _id: id });
    return ok();
  });
}

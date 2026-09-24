/**
 * الإحصائيات
 * GET للجميع: عدادات عامة (عملاء، أخصائيون، جلسات عن بُعد/حضورية، أيام العمل، لغات)
 * GET للإدارة/المساعد: + أرقام لوحة القيادة (مواعيد بالحالة، أداء، ملفات، بلاغات…)
 * v3.6: + بطاقة المبالغ الشاملة — الحجوزات (مدفوع/غير مدفوع) + التكوينات المتوقعة
 *   (سعر التكوين × عدد المسجلين) + الخدمات المحجوزة عبر المواعيد
 */
import { ok, handle } from "@/lib/api-helpers";
import { Appointment, Course, Feedback, MedicalRecord, ResetRequest, Service, User } from "@/lib/models";
import { currentUser, isStaff } from "@/lib/auth";

export async function GET() {
  return handle(async () => {
    const me = await currentUser();

    /* ── العدادات العامة ──
     * mode قد يغيب في المواعيد القديمة (v2) → الحضورية = الكل − عن بُعد */
    const [clients, specialists, remoteTotal, activeTotal, specs] = await Promise.all([
      User.countDocuments({ role: "client", active: true }),
      User.countDocuments({ role: "specialist", active: true }),
      Appointment.countDocuments({ mode: "remote", status: { $in: ["pending", "confirmed", "completed"] } }),
      Appointment.countDocuments({ status: { $in: ["pending", "confirmed", "completed"] } }),
      User.find({ role: "specialist", active: true }).select("weeklyHours").lean<{ weeklyHours?: unknown }[]>(),
    ]);
    const remote = remoteTotal;
    const onsite = Math.max(0, activeTotal - remote);

    /* أيام توفر المركز = أيام وجود ساعات عمل لدى أي أخصائي */
    const daySet = new Set<string>();
    specs.forEach((s) => {
      const wh = s.weeklyHours as unknown;
      try {
        if (wh instanceof Map) {
          for (const [day, slots] of (wh as Map<string, string[]>).entries()) {
            if (Array.isArray(slots) && slots.length > 0) daySet.add(String(day));
          }
        } else if (wh && typeof wh === "object") {
          for (const [day, slots] of Object.entries(wh as Record<string, string[]>)) {
            if (Array.isArray(slots) && slots.length > 0) daySet.add(String(day));
          }
        }
      } catch {}
    });

    /* اللغات المتاحة في الموقع (العربية دائماً) */
    const { Settings } = await import("@/lib/models");
    const st = await Settings.findOne({ key: "center" }).lean<{ langFr?: boolean; langEn?: boolean; langTr?: boolean; langEs?: boolean } | null>();
    const languages =
      1 +
      (st?.langFr !== false ? 1 : 0) +
      (st?.langEn !== false ? 1 : 0) +
      (st?.langTr !== false ? 1 : 0) +
      (st?.langEs !== false ? 1 : 0);

    const stats = {
      clients,
      specialists,
      remote,
      onsite,
      centerDays: daySet.size,
      languages,
    };

    /* ── لوحة القيادة (إدارة/مساعد) ── */
    if (me && isStaff(me.role)) {
      /* v3.8: بيانات الرسوم البيانية — حجوزات آخر 6 أشهر، الخدمات الأكثر طلباً، نمو العملاء */
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      const y = sixMonthsAgo.getFullYear();
      const m = String(sixMonthsAgo.getMonth() + 1).padStart(2, "0");
      const datePrefix = `${y}-${m}`;

      const [monthlyRows, topServiceRows, growthRows] = await Promise.all([
        /* الحجوزات الشهرية (بالحالة) — date بصيغة YYYY-MM-DD نصية */
        Appointment.aggregate([
          { $match: { date: { $gte: datePrefix }, status: { $ne: "cancelled" } } },
          {
            $group: {
              _id: { month: { $substr: ["$date", 0, 7] }, status: "$status" },
              count: { $sum: 1 },
            },
          },
        ]),
        /* الخدمات الأكثر طلباً (أعلى 6) */
        Appointment.aggregate([
          { $match: { status: { $ne: "cancelled" }, serviceId: { $ne: null } } },
          { $group: { _id: "$serviceTitle", count: { $sum: 1 }, sum: { $sum: "$price" } } },
          { $sort: { count: -1 } },
          { $limit: 6 },
        ]),
        /* نمو العملاء: تسجيلات جديدة شهرياً — createdAt تاريخ حقيقي */
        User.aggregate([
          { $match: { role: "client", createdAt: { $gte: sixMonthsAgo } } },
          {
            $group: {
              _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } },
              count: { $sum: 1 },
            },
          },
          { $sort: { "_id.y": 1, "_id.m": 1 } },
        ]),
      ]);

      /* تجميع الحجوزات الشهرية: { month: "2025-05", pending, confirmed, completed } */
      const monthMap = new Map<string, { pending: number; confirmed: number; completed: number }>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap.set(key, { pending: 0, confirmed: 0, completed: 0 });
      }
      for (const r of monthlyRows) {
        const entry = monthMap.get(String(r._id?.month || ""));
        if (!entry) continue;
        const st = String(r._id?.status || "");
        if (st === "pending") entry.pending += r.count;
        else if (st === "confirmed") entry.confirmed += r.count;
        else if (st === "completed") entry.completed += r.count;
      }
      const monthly = [...monthMap.entries()].map(([month, v]) => ({ month, ...v }));

      /* نمو العملاء تجميعاً على نفس الأشهر (تراكمي) */
      const growthMap = new Map<string, number>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        growthMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
      }
      for (const r of growthRows) {
        const key = `${r._id?.y}-${String(r._id?.m).padStart(2, "0")}`;
        if (growthMap.has(key)) growthMap.set(key, (growthMap.get(key) || 0) + r.count);
      }
      let acc = Math.max(0, stats.clients - [...growthMap.values()].reduce((a, b) => a + b, 0));
      const growth = [...growthMap.entries()].map(([month, count]) => {
        acc += count;
        return { month, count, total: acc };
      });

      const topServices = topServiceRows.map((r) => ({
        name: String(r._id || "—"),
        count: r.count,
        sum: r.sum,
      }));

      const [coursesRows, servicesAgg, servicesCount] = await Promise.all([
        Course.find({ active: true }).select("price enrolledIds").lean<{ price?: number; enrolledIds?: unknown[] }[]>(),
        Appointment.aggregate([
          { $match: { serviceId: { $ne: null }, status: { $nin: ["cancelled"] } } },
          { $group: { _id: "$paymentStatus", sum: { $sum: "$price" }, count: { $sum: 1 } } },
        ]),
        Service.countDocuments({ active: true }),
      ]);
      const coursesExpected = coursesRows.reduce(
        (acc, c) => acc + (Number(c.price) || 0) * (Array.isArray(c.enrolledIds) ? c.enrolledIds.length : 0),
        0
      );
      const coursesEnrolled = coursesRows.reduce(
        (acc, c) => acc + (Array.isArray(c.enrolledIds) ? c.enrolledIds.length : 0),
        0
      );
      const svcPaid = servicesAgg.find((r) => r._id === "paid")?.sum || 0;
      const svcUnpaid = servicesAgg.find((r) => r._id === "unpaid")?.sum || 0;

      const [pending, confirmed, completed, cancelled, unpaidSum, paidSum, unpaidCount, files, newFeedback, resets] =
        await Promise.all([
          Appointment.countDocuments({ status: "pending" }),
          Appointment.countDocuments({ status: "confirmed" }),
          Appointment.countDocuments({ status: "completed" }),
          Appointment.countDocuments({ status: "cancelled" }),
          Appointment.aggregate([
            { $match: { paymentStatus: "unpaid", status: { $nin: ["cancelled"] } } },
            { $group: { _id: null, sum: { $sum: "$price" } } },
          ]),
          Appointment.aggregate([
            { $match: { paymentStatus: "paid" } },
            { $group: { _id: null, sum: { $sum: "$price" } } },
          ]),
          Appointment.countDocuments({ paymentStatus: "unpaid", status: { $nin: ["cancelled"] } }),
          MedicalRecord.countDocuments({}),
          Feedback.countDocuments({ status: "new" }),
          ResetRequest.countDocuments({ status: "pending" }),
        ]);

      const apptPaid = paidSum[0]?.sum || 0;
      const apptUnpaid = unpaidSum[0]?.sum || 0;
      /* الإجمالي العام: كل مبالغ الحجوزات (مدفوعة وغير مدفوعة) + العائد المتوقع من التكوينات */
      const grandTotal = apptPaid + apptUnpaid + coursesExpected;

      return ok({
        stats,
        dashboard: {
          pending,
          confirmed,
          completed,
          cancelled,
          unpaidSum: apptUnpaid,
          paidSum: apptPaid,
          unpaidCount,
          files,
          newFeedback,
          resets,
          /* v3.6 — بطاقة المبالغ الشاملة */
          coursesExpected,
          coursesEnrolled,
          servicesPaid: svcPaid,
          servicesUnpaid: svcUnpaid,
          servicesCount,
          grandTotal,
          /* v3.8 — الرسوم البيانية */
          monthly,
          topServices,
          growth,
        },
      });
    }

    return ok({ stats });
  });
}

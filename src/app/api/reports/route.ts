/**
 * التقارير المالية والإدارية (★ v3.23) — حساب الإدارة فقط
 * GET ?month=YYYY-MM (اختياري) →
 *  — تفصيل الشهر المختار: مداخيل الجلسات المدفوعة + مداخيل الكتب المباعة
 *    + مصاريف الرواتب (الأخصائيون × النسب + المساعدة) + صافي الأرباح
 *    + التكوينات (مقاعد مسجّلة × السعر) كمتوقع خارج الصافي — لأن تسجيل المقعد لا يعني التحصيل الفعلي
 *  — سلسلة 12 شهراً: مداخيل / رواتب / صافي (للرسم البياني والجدول)
 * المداخيل المحقق = المبالغ المدفوعة فعلاً فقط (paymentStatus=paid + طلبات الكتب paid).
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth";
import { Appointment, Course, EbookOrder, PayrollAdjustment, Settings, User } from "@/lib/models";
import { monthPayroll, isYm, ymOf } from "@/lib/payroll";

type MonthRow = {
  month: string;
  sessionsPaid: number;
  sessionsCount: number;
  ebooks: number;
  ebooksCount: number;
  revenue: number;
  salaries: number;
  net: number;
};

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin"]);
    const { searchParams } = new URL(req.url);
    const monthParam = String(searchParams.get("month") || "");
    if (monthParam && !isYm(monthParam)) return fail(400, "صيغة الشهر غير صحيحة — استخدم YYYY-MM");

    /* مفاتيح آخر 12 شهراً — الأحدث أولاً */
    const keys: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(ymOf(d));
    }
    const month = isYm(monthParam) ? monthParam : keys[0];

    /* نسب الأخصائيين — خريطة واحدة */
    const specs = await User.find({ role: "specialist" })
      .select("commissionRate")
      .lean<{ _id: unknown; commissionRate?: number }[]>();
    const rateMap = new Map(
      specs.map((u) => [String(u._id), Math.max(0, Math.min(100, Number(u.commissionRate) || 0))])
    );

    /* مداخيل الجلسات المدفوعة حسب الشهر + مستحقات الأخصائيين من الجلسات المنتهية */
    const [paidAgg, completedAgg, ebookAgg, adjustments, settings, courses] = await Promise.all([
      Appointment.aggregate([
        { $match: { paymentStatus: "paid" } },
        {
          $group: {
            _id: { month: { $substr: ["$date", 0, 7] } },
            revenue: {
              $sum: { $max: [{ $subtract: ["$price", { $ifNull: ["$discount", 0] }] }, 0] },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Appointment.aggregate([
        { $match: { status: "completed" } },
        {
          $group: {
            _id: { month: { $substr: ["$date", 0, 7] }, spec: "$specialistId" },
            revenue: {
              $sum: { $max: [{ $subtract: ["$price", { $ifNull: ["$discount", 0] }] }, 0] },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      /* طلبات الكتب المدفوعة — الشهر يحتسب من تاريخ تأكيد الأداء (أو الإنشاء احتياطاً) */
      EbookOrder.aggregate([
        { $match: { status: "paid" } },
        {
          $group: {
            _id: {
              month: {
                $dateToString: { date: { $ifNull: ["$paidAt", "$createdAt"] }, format: "%Y-%m" },
              },
            },
            revenue: { $sum: { $ifNull: ["$price", 0] } },
            count: { $sum: 1 },
          },
        },
      ]),
      PayrollAdjustment.find({ month: { $in: keys } })
        .lean<{ month: string; assistantBase?: number; absenceDays?: number; deductionPerDay?: number }[]>(),
      Settings.findOne({ key: "center" }).lean<{ assistantSalary?: number } | null>(),
      Course.find({ active: true }).select("price enrolledIds").lean<{ price?: number; enrolledIds?: unknown[] }[]>(),
    ]);

    const paidMap = new Map(
      (paidAgg as { _id: { month: string }; revenue: number; count: number }[]).map((r) => [
        String(r._id?.month || ""),
        { revenue: Number(r.revenue) || 0, count: Number(r.count) || 0 },
      ])
    );
    const ebookMap = new Map(
      (ebookAgg as { _id: { month: string }; revenue: number; count: number }[]).map((r) => [
        String(r._id?.month || ""),
        { revenue: Number(r.revenue) || 0, count: Number(r.count) || 0 },
      ])
    );

    /* مستحقات الأخصائيين حسب الشهر — من تجميع الجلسات المنتهية × النسب */
    const duesMap = new Map<string, { dues: number; sessions: number; revenue: number }>();
    for (const r of completedAgg as { _id: { month: string; spec: unknown }; revenue: number; count: number }[]) {
      const m = String(r._id?.month || "");
      if (!keys.includes(m)) continue;
      const rate = rateMap.get(String(r._id?.spec || "")) || 0;
      const cur = duesMap.get(m) || { dues: 0, sessions: 0, revenue: 0 };
      cur.revenue += Number(r.revenue) || 0;
      cur.sessions += Number(r.count) || 0;
      cur.dues += ((Number(r.revenue) || 0) * rate) / 100;
      duesMap.set(m, cur);
    }

    /* تسويات المساعدة المحفوظة + الافتراضي */
    const defaultBase = Math.max(0, Math.round(Number(settings?.assistantSalary) || 0));
    const adjMap = new Map(
      adjustments.map((a) => [String(a.month), a])
    );

    const assistantNetOf = (m: string) => {
      const a = adjMap.get(m);
      if (!a) return defaultBase;
      const base = Math.max(0, Math.round(Number(a.assistantBase) || 0));
      const days = Math.max(0, Math.min(31, Math.round(Number(a.absenceDays) || 0)));
      const perDay = Math.max(0, Math.round(Number(a.deductionPerDay) || 0));
      return Math.max(0, base - Math.min(base, days * perDay));
    };

    const series: MonthRow[] = keys.map((m) => {
      const sessionsPaid = Math.round(paidMap.get(m)?.revenue || 0);
      const ebooks = Math.round(ebookMap.get(m)?.revenue || 0);
      const revenue = sessionsPaid + ebooks;
      const salaries = Math.round((duesMap.get(m)?.dues || 0) + assistantNetOf(m));
      return {
        month: m,
        sessionsPaid,
        sessionsCount: paidMap.get(m)?.count || 0,
        ebooks,
        ebooksCount: ebookMap.get(m)?.count || 0,
        revenue,
        salaries,
        net: revenue - salaries,
      };
    });

    /* تفصيل الشهر المختار — الرواتب من المحرّك المشترك نفسه (نفس قيم صفحة الأجور) */
    const payroll = await monthPayroll(month);
    const coursesExpected = courses.reduce(
      (acc, c) => acc + (Number(c.price) || 0) * (Array.isArray(c.enrolledIds) ? c.enrolledIds.length : 0),
      0
    );
    const coursesSeats = courses.reduce(
      (acc, c) => acc + (Array.isArray(c.enrolledIds) ? c.enrolledIds.length : 0),
      0
    );

    const detail = series.find((r) => r.month === month) || series[0];

    return ok({
      month,
      series,
      detail: {
        ...detail,
        /* التكوينات: متوقع من المقاعد المسجلة — يُعرض للعلم ولا يدخل صافي الأرباح */
        coursesExpected: Math.round(coursesExpected),
        coursesSeats,
        /* تفصيل الرواتب كما في صفحة الأجور */
        salariesBreakdown: {
          specialistsDues: payroll.totals.specialistsDues,
          specialistsSessions: payroll.totals.specialistsSessions,
          assistantNet: payroll.assistant.net,
          assistantSaved: payroll.assistant.saved,
          total: payroll.totals.grand,
        },
      },
    });
  });
}

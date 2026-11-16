/**
 * أرباح الأخصائي (★ v3.23) — للأخصائي نفسه فقط
 * GET → نسبته + إحصائيات مستحقاته الشهرية:
 *  — الشهر الحالي: الجلسات المنتهية + المستحقات
 *  — آخر 6 أشهر: سلسلة شهرية (الجلسات، السعر الصافي، المستحقات)
 *  — الإجمالي الكلي منذ التفعيل
 * المستحقات = مجموع (سعر الجلسة − الخصم) × النسبة — للجلسات المنتهية فقط.
 */
import { ok, handle } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth";
import { Appointment } from "@/lib/models";
import { ymOf } from "@/lib/payroll";

export async function GET() {
  return handle(async () => {
    const me = await requireUser(["specialist"]);
    const rate = Math.max(0, Math.min(100, Number(me.commissionRate) || 0));

    /* كل الجلسات المنتهية لهذا الأخصائي — الكميات صغيرة (حقل نصي YYYY-MM-DD) */
    const rows = await Appointment.find({ specialistId: me._id, status: "completed" })
      .select("date price discount")
      .lean<{ date: string; price?: number; discount?: number }[]>();

    /* تجميع شهري */
    const map = new Map<string, { sessions: number; revenue: number }>();
    for (const r of rows) {
      const month = String(r.date || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) continue;
      const net = Math.max(0, (Number(r.price) || 0) - (Number(r.discount) || 0));
      const cur = map.get(month) || { sessions: 0, revenue: 0 };
      cur.sessions += 1;
      cur.revenue += net;
      map.set(month, cur);
    }

    /* آخر 6 أشهر (الشهر الحالي أول إدخال) */
    const months: { month: string; sessions: number; revenue: number; dues: number }[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = ymOf(d);
      const stat = map.get(month) || { sessions: 0, revenue: 0 };
      months.push({
        month,
        sessions: stat.sessions,
        revenue: Math.round(stat.revenue),
        dues: Math.round((stat.revenue * rate) / 100),
      });
    }

    const current = months[0] || { month: ymOf(now), sessions: 0, revenue: 0, dues: 0 };
    const totals = {
      sessions: rows.length,
      revenue: Math.round([...map.values()].reduce((a, v) => a + v.revenue, 0)),
      dues: Math.round(([...map.values()].reduce((a, v) => a + v.revenue, 0) * rate) / 100),
    };

    return ok({
      rate,
      current,
      months,
      totals,
      /* كيف تُحسب المستحقات — تُعرض للشفافية في الواجهة */
      formula: "المستحقات = (سعر الجلسة − الخصم) × النسبة — للجلسات المنتهية فقط",
    });
  });
}

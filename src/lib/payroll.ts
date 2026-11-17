/**
 * مركز أيت تقرين — محرّك الأجور والمستحقات (★ v3.23)
 * الحساب التلقائي للمستحقات الشهرية:
 *  — الأخصائي: عدد الجلسات المنتهية في الشهر × نسبته (%) من السعر الصافي بعد الخصم
 *  — المساعدة: راتب ثابت لهذا الشهر − (أيام الغياب × قسط الخصم اليومي)
 * يُستهلك من /api/payroll (صفحة الأجور) و /api/reports (التقارير المالية)
 * — حساب الإدارة فقط في الواجهة، والوصول للـ API محصور خادمياً بدور admin.
 */
import { Appointment, PayrollAdjustment, Settings, User } from "./models";

export type PayrollSpecRow = {
  specialistId: string;
  name: string;
  photoBase64: string;
  rate: number;
  sessions: number;
  /** مجموع السعر الصافي للجلسات المنتهية في الشهر (بعد الخصم) */
  revenue: number;
  /** المستحقات = السعر الصافي × النسبة — مقرّب للدينار */
  dues: number;
  /** ★ v3.24: نظام الأجر — salary يعني صفر مستحقات جلسات (الراتب عبر الموارد البشرية) */
  payModel?: "commission" | "salary";
  salaryAmount?: number;
};

export type PayrollAssistant = {
  base: number;
  absenceDays: number;
  deductionPerDay: number;
  deduction: number;
  net: number;
  note: string;
  /** هل تسوية الشهر محفوظة أم افتراضية؟ */
  saved: boolean;
};

export type MonthPayroll = {
  month: string;
  rows: PayrollSpecRow[];
  assistant: PayrollAssistant;
  totals: {
    specialistsDues: number;
    specialistsSessions: number;
    specialistsRevenue: number;
    assistantNet: number;
    grand: number;
  };
};

/** نص الشهر YYYY-MM من كائن تاريخ */
export function ymOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** هل النص بصيغة شهر صحيحة YYYY-MM؟ */
export function isYm(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(s || ""));
}

/**
 * مستحقات الأخصائيين لشهر معين — تُشتق حية من المواعيد:
 * الجلسات المنتهية (status=completed) التي يبدأ تاريخها بالشهر المطلوب.
 * النسبة تُقرأ من حساب الأخصائي الحالي (تغيير النسبة يؤثر على الأشهر المفتوحة
 * وتظهر شفافة للإدارة في نفس الصفحة).
 */
export async function specialistRowsForMonth(month: string): Promise<PayrollSpecRow[]> {
  const specs = await User.find({ role: "specialist" })
    .select("name photoBase64 commissionRate payModel salaryAmount active")
    .lean<{ _id: unknown; name?: string; photoBase64?: string; commissionRate?: number; payModel?: string; salaryAmount?: number; active?: boolean }[]>();

  const appts = await Appointment.find({
    status: "completed",
    date: { $regex: `^${month}-` },
  })
    .select("specialistId price discount")
    .lean<{ specialistId: unknown; price?: number; discount?: number }[]>();

  /* تجميع حسب الأخصائي: عدد الجلسات + مجموع السعر الصافي (price − discount) */
  const agg = new Map<string, { sessions: number; revenue: number }>();
  for (const a of appts) {
    const key = String(a.specialistId);
    const net = Math.max(0, (Number(a.price) || 0) - (Number(a.discount) || 0));
    const cur = agg.get(key) || { sessions: 0, revenue: 0 };
    cur.sessions += 1;
    cur.revenue += net;
    agg.set(key, cur);
  }

  const rows: PayrollSpecRow[] = specs.map((u) => {
    const id = String(u._id);
    const stat = agg.get(id) || { sessions: 0, revenue: 0 };
    /* ★ v3.24: نظام الراتب الثابت — المستحقات لكل جلسة صفر والراتب يُدفع عبر الموارد البشرية */
    const payModel: "commission" | "salary" = u.payModel === "salary" ? "salary" : "commission";
    const salaryAmount = Math.max(0, Math.round(Number(u.salaryAmount) || 0));
    const rate = payModel === "salary" ? 0 : Math.max(0, Math.min(100, Number(u.commissionRate) || 0));
    return {
      specialistId: id,
      name: u.name || "—",
      photoBase64: u.photoBase64 || "",
      rate,
      sessions: stat.sessions,
      revenue: Math.round(stat.revenue),
      dues: payModel === "salary" ? 0 : Math.round((stat.revenue * rate) / 100),
      payModel,
      ...(payModel === "salary" ? { salaryAmount } : {}),
      /* نُبقي الأخصائيين المعطلين ظاهرين إن لهم جلسات منتهية في الشهر */
      ...(u.active === false && stat.sessions === 0 ? { _skip: 1 } : {}),
    } as PayrollSpecRow;
  });
  /* الأخصائيون المعطلون بلا جلسات في الشهر لا يعبرون القائمة */
  return rows.filter((r) => (r as PayrollSpecRow & { _skip?: number })._skip !== 1);
}

/**
 * تسوية المساعدة لشهر معين — من مستند الشهر المحفوظ إن وُجد،
 * وإلا فالقيم الافتراضية (assistantSalary من الإعدادات + بلا غياب،
 * وقسط الخصم اليومي المقترح = الراتب ÷ 26 يوم عمل).
 */
export async function assistantPayrollForMonth(month: string): Promise<PayrollAssistant> {
  const [adj, st] = await Promise.all([
    PayrollAdjustment.findOne({ month }).lean<{ assistantBase?: number; absenceDays?: number; deductionPerDay?: number; note?: string } | null>(),
    Settings.findOne({ key: "center" }).lean<{ assistantSalary?: number } | null>(),
  ]);
  const defaultBase = Math.max(0, Math.round(Number(st?.assistantSalary) || 0));
  if (adj) {
    const base = Math.max(0, Math.round(Number(adj.assistantBase) || 0));
    const absenceDays = Math.max(0, Math.min(31, Math.round(Number(adj.absenceDays) || 0)));
    const deductionPerDay = Math.max(0, Math.round(Number(adj.deductionPerDay) || 0));
    const deduction = Math.min(base, absenceDays * deductionPerDay);
    return {
      base,
      absenceDays,
      deductionPerDay,
      deduction,
      net: Math.max(0, base - deduction),
      note: String(adj.note || ""),
      saved: true,
    };
  }
  return {
    base: defaultBase,
    absenceDays: 0,
    deductionPerDay: defaultBase > 0 ? Math.round(defaultBase / 26) : 0,
    deduction: 0,
    net: defaultBase,
    note: "",
    saved: false,
  };
}

/** الأجور الكاملة لشهر معين — الأخصائيون + المساعدة + الإجماليات */
export async function monthPayroll(month: string): Promise<MonthPayroll> {
  const [rows, assistant] = await Promise.all([
    specialistRowsForMonth(month),
    assistantPayrollForMonth(month),
  ]);
  const specialistsDues = rows.reduce((acc, r) => acc + r.dues, 0);
  const specialistsSessions = rows.reduce((acc, r) => acc + r.sessions, 0);
  const specialistsRevenue = rows.reduce((acc, r) => acc + r.revenue, 0);
  return {
    month,
    rows,
    assistant,
    totals: {
      specialistsDues,
      specialistsSessions,
      specialistsRevenue,
      assistantNet: assistant.net,
      grand: specialistsDues + assistant.net,
    },
  };
}

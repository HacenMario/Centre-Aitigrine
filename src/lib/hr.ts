/**
 * محرك حسابات الموارد البشرية (★ v3.24)
 * إحصائيات الموظف لشهر معين — يُستهلك من /api/hr و /api/hr/payslip
 *
 * قواعد الاحتساب (شفافة وموحدة):
 *  — ما لا يُسجَّل في الحضور يُعد حاضراً (نمط العيادات الصغيرة)
 *  — أيام الغياب المسجلة تُخصم بقسط يومي = الراتب الأساسي ÷ 26
 *  — أيام الإجازة بدون أجر تُحسب غياباً في الخصم؛ المدفوعة لا تُخصم
 *  — صافي المستحق = الأساس − خصم الغياب − الخصومات الإدارية + المكافآت
 *  — المتبقي للصرف = الصافي − الدفعات المقدمة (acompte) − المبالغ المصروفة كراتب
 */
import { HrAttendance, HrLeave, HrPayment } from "./models";

/** عدد الأيام داخل شهر YYYY-MM */
function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export type HrMonthStats = {
  absent: number;
  leave: number;
  paidLeave: number;
  unpaidLeave: number;
  holiday: number;
  /** الغياب الفعلي المعتبَر في الخصم = غياب مسجل + إجازات بدون أجر */
  absentForDeduction: number;
  base: number;
  deductionPerDay: number;
  deduction: number;
  bonuses: number;
  adminDeductions: number;
  acomptes: number;
  salaryPaid: number;
  paidOut: number;
  net: number;
  remaining: number;
};

/** إحصائيات موظف واحد لشهر معين */
export async function employeeStats(
  emp: { _id: unknown; baseSalary?: number },
  month: string
): Promise<HrMonthStats> {
  const [attRows, leaveRows, payRows] = await Promise.all([
    HrAttendance.find({ employeeId: emp._id, date: { $regex: `^${month}-` } })
      .lean<{ date: string; status: string }[]>(),
    HrLeave.find({ employeeId: emp._id }).lean<{ start: string; end: string; type: string }[]>(),
    HrPayment.find({ employeeId: emp._id, month }).lean<{ type: string; amount: number }[]>(),
  ]);

  let absent = 0;
  let leave = 0;
  let holiday = 0;
  for (const a of attRows) {
    if (a.status === "absent") absent += 1;
    else if (a.status === "leave") leave += 1;
    else if (a.status === "holiday") holiday += 1;
  }

  /* أيام الإجازات المتداخلة مع الشهر — بدون أجر تُحسب غياباً في الخصم */
  const dim = daysInMonth(month);
  let unpaidLeave = 0;
  let paidLeave = 0;
  for (const l of leaveRows) {
    const s = l.start < `${month}-01` ? `${month}-01` : l.start;
    const e = l.end > `${month}-${String(dim).padStart(2, "0")}` ? `${month}-${String(dim).padStart(2, "0")}` : l.end;
    if (s > e) continue;
    const [sy, sm, sd] = s.split("-").map(Number);
    const [ey, em, ed] = e.split("-").map(Number);
    const d1 = Date.UTC(sy, sm - 1, sd);
    const d2 = Date.UTC(ey, em - 1, ed);
    const n = Math.round((d2 - d1) / 86400000) + 1;
    if (l.type === "unpaid") unpaidLeave += n;
    else paidLeave += n;
  }
  const absentForDeduction = absent + unpaidLeave;

  const base = Math.max(0, Math.round(Number(emp.baseSalary) || 0));
  const deductionPerDay = base > 0 ? Math.round(base / 26) : 0;
  const deduction = Math.min(base, absentForDeduction * deductionPerDay);

  let acomptes = 0;
  let bonuses = 0;
  let adminDeductions = 0;
  let salaryPaid = 0;
  for (const p of payRows) {
    const amt = Math.max(0, Math.round(Number(p.amount) || 0));
    if (p.type === "acompte") acomptes += amt;
    else if (p.type === "bonus") bonuses += amt;
    else if (p.type === "deduction") adminDeductions += amt;
    else if (p.type === "salary") salaryPaid += amt;
  }

  const net = Math.max(0, base - deduction - adminDeductions + bonuses);
  const remaining = net - acomptes - salaryPaid;

  return {
    absent,
    leave,
    paidLeave,
    unpaidLeave,
    holiday,
    absentForDeduction,
    base,
    deductionPerDay,
    deduction,
    bonuses,
    adminDeductions,
    acomptes,
    salaryPaid,
    paidOut: acomptes + salaryPaid,
    net,
    remaining,
  };
}

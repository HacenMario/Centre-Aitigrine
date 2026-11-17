"use client";
/**
 * ★ v3.24 — الموارد البشرية (الإدارة فقط)
 * إدارة كاملة لرواتب عمال المركز — الأخصائيون (بنظام الراتب) والمساعدة وعاملة التنظيف والحارس:
 *  — الموظفون: إضافة/تعديل/حذف + استيراد تلقائي من الحسابات (الأخصائيون بنظام الراتب والمساعدة)
 *  — الحضور والغياب: شبكة شهر تفاعلية — النقر يبدّل الحالة، وما لا يُسجَّل يُعد حاضراً
 *  — الإجازات: مدفوعة/بدون أجر (بدون أجر تُحسب غياباً في الخصم)
 *  — الدفعات: دفعة مقدمة (acompte) / صرف الراتب / مكافأة / خصم إداري
 *  — وثائق الرواتب: ورقة راتب قابلة للطباعة لكل موظف/شهر
 * الاحتساب: قسط اليوم = الأساس ÷ 26 — الصافي = الأساس − الخصم − الخصومات + المكافآت
 * المتبقي = الصافي − الدفعات المقدمة − المصروف كراتب.
 * التجاوب: كل شيء يتراص على الهاتف — الشبكات 7 أعمدة مضغوطة دوماً.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { PageSkeleton } from "@/components/brand-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  UsersRound, UserRound, Plus, Pencil, Trash2, Printer, CalendarCheck2,
  Plane, HandCoins, Wallet, Import, RefreshCw, CircleAlert, X, Ban, Save,
} from "lucide-react";
import { toast } from "sonner";
import { localeOf } from "@/components/tri-input";
import { cn } from "@/lib/utils";
import type { Navigate } from "@/lib/nav";

type Stats = {
  absent: number; leave: number; paidLeave: number; unpaidLeave: number; holiday: number;
  absentForDeduction: number; base: number; deductionPerDay: number; deduction: number;
  bonuses: number; adminDeductions: number; acomptes: number; salaryPaid: number;
  paidOut: number; net: number; remaining: number;
};
type Emp = {
  _id: string; name: string; role: string; baseSalary: number; phone: string;
  notes: string; active: boolean; userId: string | null; stats: Stats;
};
type Importable = { _id: string; name: string; role: string; salaryAmount: number };
type HrData = { month: string; employees: Emp[]; importable: Importable[] };
type AttRow = { date: string; status: string; note?: string };
type LeaveRow = { _id: string; start: string; end: string; type: string; note?: string };
type PayRow = { _id: string; type: string; amount: number; date: string; note?: string; byName?: string };
type CenterInfo = {
  name: string; nameFr: string; nameEn: string; nameTr: string; nameEs: string;
  address: string; addressFr: string; addressEn: string; addressTr: string; addressEs: string;
  phone: string; logoBase64: string;
};
type Payslip = {
  employee: { _id: string; name: string; role: string; baseSalary: number; phone: string };
  month: string; center: CenterInfo; issuedOn: string;
  stats: Stats; payments: PayRow[]; leaves: LeaveRow[]; attendance: AttRow[];
};

const DAYS_BY_LANG: Record<string, string[]> = {
  ar: ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
  fr: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  tr: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"],
  es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
};

function ymOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
const ATT_CYCLE = ["absent", "leave", "holiday", ""] as const;
const ATT_DOT: Record<string, string> = {
  present: "bg-emerald-500", absent: "bg-rose-500", leave: "bg-amber-500", holiday: "bg-sky-500",
};
const ROLE_KEY: Record<string, string> = {
  specialist: "hr.role.specialist", assistant: "hr.role.assistant",
  cleaner: "hr.role.cleaner", guard: "hr.role.guard", other: "hr.role.other",
};
const PAY_KEY: Record<string, string> = {
  acompte: "hr.pt.acompte", salary: "hr.pt.salary", bonus: "hr.pt.bonus", deduction: "hr.pt.deduction",
};
const PAY_BADGE: Record<string, string> = {
  acompte: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
  salary: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  bonus: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25",
  deduction: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25",
};

export default function Hr({ navigate }: { navigate: Navigate }) {
  const { t, lang } = useApp();
  const [data, setData] = useState<HrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [month, setMonth] = useState(() => ymOf(new Date()));
  const [selId, setSelId] = useState("");
  /* ★ v3.24.1: التحديد الحالي في مرجع — load القديمة كانت تلتقط selId الفارغ من الإغلاق
     فتمسح التحديد بعد كل عملية، تختفي بطاقات الملخص والحضور والإجازات والدفعات تلقائياً */
  const selIdRef = useRef("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEmp, setEditEmp] = useState<Emp | null>(null);
  const [delEmp, setDelEmp] = useState<Emp | null>(null);
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [slipBusy, setSlipBusy] = useState(false);
  /* نموذج موظف */
  const [fName, setFName] = useState("");
  const [fRole, setFRole] = useState("other");
  const [fSalary, setFSalary] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fActive, setFActive] = useState(true);
  /* إجازة (إضافة أو تعديل) — النوع/السبب حقل نصي اختياري */
  const [lvFrom, setLvFrom] = useState("");
  const [lvTo, setLvTo] = useState("");
  const [lvType, setLvType] = useState("paid");
  const [lvNote, setLvNote] = useState("");
  const [editLeave, setEditLeave] = useState<LeaveRow | null>(null);
  /* دفعة (إضافة أو تعديل) — السبب/الملاحظة حقل اختياري */
  const [payType, setPayType] = useState("acompte");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");
  const [editPay, setEditPay] = useState<PayRow | null>(null);
  /* حضور الشهر المعروض — attBase ما هو محفوظ بالخادم وattMap ما في المحرر (تغييرات يدوية) */
  const [attMap, setAttMap] = useState<Map<string, string>>(new Map());
  const [attBase, setAttBase] = useState<Map<string, string>>(new Map());
  const [attSaving, setAttSaving] = useState(false);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [pays, setPays] = useState<PayRow[]>([]);

  const DAYS = DAYS_BY_LANG[lang] || DAYS_BY_LANG.ar;
  const money = (n: number) => `${(n || 0).toLocaleString(lang === "ar" ? "ar-DZ" : "fr-DZ")} ${lang === "ar" ? "دج" : "DA"}`;
  const sel = data?.employees.find((e) => e._id === selId) || null;

  /* عدد التغييرات غير المحفوظة في شبكة الحضور */
  const dirtyAtt = useMemo(() => {
    let n = 0;
    for (const [d, st] of attMap) if ((attBase.get(d) || "") !== st) n++;
    for (const [d, st] of attBase) if (!attMap.has(d) && st) n++;
    return n;
  }, [attMap, attBase]);

  const load = useCallback(async (m: string) => {
    setRefreshing(true);
    try {
      const r = await fetch(`/api/hr?month=${m}`, { cache: "no-store" });
      if (r.ok) {
        const j: HrData = await r.json();
        setData(j);
        /* ★ v3.24.1: التحديد يُقرأ من المرجع — يُمسح فقط إذا اختفى الموظف فعلاً من القائمة */
        const curId = selIdRef.current;
        if (curId && !j.employees.some((e) => e._id === curId)) setSelId("");
      }
    } catch {}
    setRefreshing(false);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    selIdRef.current = selId;
  }, [selId]);

  useEffect(() => { load(month); }, [month, load]);

  /* تفاصيل الموظف المحدد: الحضور + الإجازات + الدفعات */
  useEffect(() => {
    if (!sel || !month) {
      setAttMap(new Map()); setAttBase(new Map()); setLeaves([]); setPays([]);
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/hr/payslip?employeeId=${sel._id}&month=${month}`, { cache: "no-store" });
        if (r.ok) {
          const j: Payslip = await r.json();
          const m = new Map(j.attendance.map((a) => [a.date, a.status]));
          setAttMap(m);
          setAttBase(new Map(m));
          setLeaves(j.leaves as LeaveRow[]);
          setPays(j.payments as PayRow[]);
        }
      } catch {}
    })();
  }, [sel, month]);

  const post = async (payload: Record<string, unknown>, okMsg?: string) => {
    setBusy(true);
    try {
      const r = await fetch("/api/hr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        if (okMsg) toast.success(okMsg);
        await load(month);
        return true;
      }
      toast.error(j.error || t("common.error"));
    } catch {
      toast.error(t("err.conn"));
    }
    setBusy(false);
    return false;
  };

  const shiftMonth = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    setMonth(ymOf(d));
  };

  const openAdd = () => {
    setEditEmp(null); setFName(""); setFRole("other"); setFSalary(""); setFPhone(""); setFNotes(""); setFActive(true);
    setShowForm(true);
  };
  const openEdit = (e: Emp) => {
    setEditEmp(e); setFName(e.name); setFRole(e.role); setFSalary(String(e.baseSalary || ""));
    setFPhone(e.phone || ""); setFNotes(e.notes || ""); setFActive(e.active !== false);
    setShowForm(true);
  };
  const saveEmp = async () => {
    if (fName.trim().length < 2) { toast.error(t("err.required")); return; }
    const payload = editEmp
      ? { action: "employee.update", _id: editEmp._id, name: fName.trim(), role: fRole, baseSalary: Number(fSalary) || 0, phone: fPhone.trim(), notes: fNotes.trim(), active: fActive }
      : { action: "employee.add", name: fName.trim(), role: fRole, baseSalary: Number(fSalary) || 0, phone: fPhone.trim(), notes: fNotes.trim() };
    const okR = await post(payload, t("hr.empSaved"));
    if (okR) { setShowForm(false); setBusy(false); }
  };

  /* ★ v3.24.1: النقر على يوم يغيّر الحالة محلياً فقط — بلا حفظ تلقائي وبلا إغلاق
     التقويم؛ الحفظ يدوي بزر واحد يجمع كل التغييرات دفعة واحدة، والتقويم يبقى مفتوحاً
     لمتابعة التعديل. عند التبديل لموظف آخر تُحفظ التغييرات المعلّقة تلقائياً بلا إزعاج. */
  const cycleAtt = (date: string) => {
    if (!sel) return;
    const cur = attMap.get(date) || "";
    const idx = ATT_CYCLE.indexOf(cur as (typeof ATT_CYCLE)[number]);
    const next = ATT_CYCLE[(idx + 1) % ATT_CYCLE.length];
    setAttMap((prev) => {
      const nm = new Map(prev);
      if (next === "") nm.delete(date); else nm.set(date, next);
      return nm;
    });
  };

  /* الحفظ اليدوي — يرسل الفروق فقط دفعة واحدة، ثم يجدد الإحصائيات بلا إغلاق اللوحة */
  const saveAtt = async (silent = false) => {
    if (!sel || attSaving) return true;
    const changes: { date: string; status: string }[] = [];
    for (const [d, st] of attMap) if ((attBase.get(d) || "") !== st) changes.push({ date: d, status: st });
    for (const [d, st] of attBase) if (!attMap.has(d) && st) changes.push({ date: d, status: "" });
    if (!changes.length) return true;
    setAttSaving(true);
    try {
      const r = await fetch("/api/hr", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attendance.batch", employeeId: sel._id, changes }),
      });
      if (r.ok) {
        setAttBase(new Map(attMap));
        setAttSaving(false);
        if (!silent) toast.success(t("hr.attSaved"));
        await load(month); /* إحصائيات محدثة — التحديد يبقى واللوحات لا تغلق */
        return true;
      }
      if (!silent) toast.error(t("common.error"));
    } catch {
      if (!silent) toast.error(t("err.conn"));
    }
    setAttSaving(false);
    return false;
  };

  /* اختيار موظف — حفظ صامت للتغييرات المعلّقة أولاً حتى لا يضيع عمل المستخدم */
  const selectEmp = (id: string) => {
    if (id !== selId && dirtyAtt > 0) void saveAtt(true);
    setSelId(id);
  };

  const openLeaveEdit = (l: LeaveRow) => {
    setEditLeave(l); setLvFrom(l.start); setLvTo(l.end);
    setLvType(l.type === "unpaid" ? "unpaid" : "paid"); setLvNote(l.note || "");
  };
  const cancelLeaveEdit = () => {
    setEditLeave(null); setLvFrom(""); setLvTo(""); setLvType("paid"); setLvNote("");
  };

  const addLeave = async () => {
    if (!sel || !lvFrom || !lvTo) { toast.error(t("err.required")); return; }
    if (lvTo < lvFrom) { toast.error(t("common.error")); return; }
    /* النوع/السبب اختياري — ينجح الحفظ حتى لو بقي فارغاً */
    const payload = editLeave
      ? { action: "leave.edit", _id: editLeave._id, start: lvFrom, end: lvTo, type: lvType, note: lvNote.trim() }
      : { action: "leave.add", employeeId: sel._id, start: lvFrom, end: lvTo, type: lvType, note: lvNote.trim() };
    const okR = await post(payload, t(editLeave ? "hr.leaveUpdated" : "hr.leaveSaved"));
    if (okR) { cancelLeaveEdit(); setBusy(false); }
  };

  const openPayEdit = (p: PayRow) => {
    setEditPay(p); setPayType(p.type || "acompte"); setPayAmount(String(p.amount || ""));
    setPayDate(p.date || new Date().toISOString().slice(0, 10)); setPayNote(p.note || "");
  };
  const cancelPayEdit = () => {
    setEditPay(null); setPayType("acompte"); setPayAmount("");
    setPayDate(new Date().toISOString().slice(0, 10)); setPayNote("");
  };

  const addPay = async () => {
    if (!sel || !payAmount || Number(payAmount) <= 0) { toast.error(t("err.required")); return; }
    const payload = editPay
      ? { action: "payment.edit", _id: editPay._id, type: payType, amount: Number(payAmount), date: payDate, note: payNote.trim() }
      : { action: "payment.add", employeeId: sel._id, month, type: payType, amount: Number(payAmount), date: payDate, note: payNote.trim() };
    const okR = await post(payload, t(editPay ? "hr.payUpdated" : "hr.paySaved"));
    if (okR) { cancelPayEdit(); setBusy(false); }
  };

  const openPayslip = async () => {
    if (!sel) return;
    setSlipBusy(true);
    try {
      const r = await fetch(`/api/hr/payslip?employeeId=${sel._id}&month=${month}`, { cache: "no-store" });
      if (r.ok) setPayslip(await r.json());
      else toast.error(t("common.error"));
    } catch { toast.error(t("err.conn")); }
    setSlipBusy(false);
  };

  const monthLabel = useMemo(() => {
    try {
      const [y, m] = month.split("-").map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString(localeOf(lang), { month: "long", year: "numeric" });
    } catch { return month; }
  }, [month, lang]);

  /* ★ v3.24.1: اسم ملف PDF عند الطباعة/الحفظ = ورقة راتب + اسم الموظف + الشهر،
     ووضعية body.slip-printing تجعل الطباعة صفحة واحدة بلا عناصر التطبيق */
  const prevTitle = useRef("");
  useEffect(() => {
    if (payslip) {
      prevTitle.current = document.title;
      document.title = `${t("ps.file")} ${payslip.employee.name} - ${payslip.month}`;
      document.body.classList.add("slip-printing");
      return () => {
        document.title = prevTitle.current;
        document.body.classList.remove("slip-printing");
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payslip]);

  /* شبكة الحضور — تبدأ من الأحد */
  const attCells = useMemo(() => {
    if (!sel) return [];
    const dim = daysInMonth(month);
    const [y, m] = month.split("-").map(Number);
    const lead = new Date(y, m - 1, 1).getDay();
    const cells: ({ day: number; date: string } | null)[] = Array.from({ length: lead }, () => null);
    for (let i = 1; i <= dim; i++) {
      const date = `${month}-${String(i).padStart(2, "0")}`;
      cells.push({ day: i, date });
    }
    return cells;
  }, [sel, month]);

  const statChips = (s: Stats) => (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
      <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-700 dark:text-rose-400">
        <Ban className="h-3 w-3" /> {t("hr.st.absent")}: {s.absentForDeduction}
      </span>
      <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-400">
        <Plane className="h-3 w-3" /> {t("hr.st.leave")}: {s.leave + s.paidLeave}
      </span>
      {/* ★ v3.24.1: شارة الدفعات المقدمة — كانت الشارات غياب/إجازة فقط */}
      <span className="flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-violet-700 dark:text-violet-400">
        <HandCoins className="h-3 w-3" /> {t("hr.acomptes")}: {money(s.acomptes)}
      </span>
      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">
        <Wallet className="h-3 w-3" /> {t("hr.net")}: {money(s.net)}
      </span>
      <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5", s.remaining >= 0 ? "bg-sky-500/10 text-sky-700 dark:text-sky-400" : "bg-rose-500/10 text-rose-700 dark:text-rose-400")}>
        <HandCoins className="h-3 w-3" /> {t("hr.remaining")}: {money(s.remaining)}
      </span>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <BackButton onBack={() => navigate("home")} />
          <h1 className="text-xl sm:text-2xl font-black break-words">{t("hr.title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => load(month)} disabled={refreshing}
            className="gap-1.5 rounded-full text-xs">
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {t("dash.refresh")}
          </Button>
          <Button size="sm" onClick={openAdd} disabled={busy} className="gap-1.5 rounded-full text-xs">
            <Plus className="h-3.5 w-3.5" /> {t("hr.addEmployee")}
          </Button>
        </div>
      </div>

      <p className="rounded-xl border border-primary/15 bg-primary/[0.05] px-4 py-2.5 text-sm leading-relaxed text-primary">
        {t("hr.sub")}
      </p>

      {loading ? (
        <PageSkeleton kind="cards" count={4} label={t("common.loading")} />
      ) : !data ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">{t("common.error")}</CardContent>
        </Card>
      ) : (
        <>
          {/* تنقل الشهور */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-2.5">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" aria-label={t("common.back")}
              onClick={() => shiftMonth(-1)}>‹</Button>
            <p className="text-sm font-black text-primary">{monthLabel}</p>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-9 rounded-xl px-3 text-xs font-bold"
                onClick={() => setMonth(ymOf(new Date()))}>{t("appt.calToday")}</Button>
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" aria-label={t("common.next")}
                onClick={() => shiftMonth(1)}>›</Button>
            </div>
          </div>

          {/* الاستيراد من الحسابات — الأخصائيون بنظام الراتب والمساعدة */}
          {data.importable.length > 0 && (
            <Card className="rounded-2xl border-dashed border-primary/30 bg-primary/[0.03]">
              <CardContent className="space-y-2 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-primary">
                  <Import className="h-4 w-4" /> {t("hr.importAccounts")}
                </p>
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">{t("hr.importHint")}</p>
                <div className="flex flex-wrap gap-2">
                  {data.importable.map((u) => (
                    <Button key={u._id} variant="outline" size="sm" disabled={busy}
                      className="h-9 gap-1.5 rounded-full text-xs"
                      onClick={async () => {
                        const okR = await post({ action: "employee.add", name: u.name, role: u.role, baseSalary: u.salaryAmount, userId: u._id }, t("hr.imported"));
                        if (okR) setBusy(false);
                      }}>
                      <Plus className="h-3.5 w-3.5" />
                      {u.name} {u.salaryAmount > 0 && <span className="tabular-nums opacity-70">({money(u.salaryAmount)})</span>}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* قائمة الموظفين */}
          {data.employees.length === 0 ? (
            <Card className="rounded-3xl border-dashed">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">{t("hr.empty")}</CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {data.employees.map((e) => (
                <Card key={e._id} className={cn("ait-card rounded-2xl shadow-sm", selId === e._id && "ring-2 ring-primary/40")}>
                  {/* ★ v3.24.1: البطاقة كلها قابلة للنقر لفتح تفاصيل الموظف — لا النص وحده */}
                  <CardContent className="cursor-pointer space-y-2.5 p-4"
                    onClick={() => selectEmp(selId === e._id ? "" : e._id)}
                    role="button" tabIndex={0}
                    onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); selectEmp(selId === e._id ? "" : e._id); } }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <UserRound className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-auto">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-black break-words">
                          {e.name}
                          {e.userId && (
                            <Badge variant="outline" className="rounded-full text-[10px] border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400">
                              {t("hr.linked")}
                            </Badge>
                          )}
                          {e.active === false && (
                            <Badge variant="outline" className="rounded-full text-[10px] border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400">
                              {t("hr.inactive")}
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t(ROLE_KEY[e.role] || "hr.role.other")} · {t("hr.base")}: {money(e.baseSalary)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" aria-label={t("hr.edit")}
                          onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg text-destructive" aria-label={t("hr.delete")}
                          onClick={(ev) => { ev.stopPropagation(); setDelEmp(e); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    {statChips(e.stats)}
                    <p className="text-[11px] text-muted-foreground sm:hidden">{t("hr.selectEmp")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ═══ ملف الموظف المحدد — الشهر الكامل ═══ */}
          {sel && (
            <>
              {/* ملخص الشهر */}
              <Card className="ait-card rounded-3xl shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <h2 className="flex flex-wrap items-center gap-2 font-black text-base sm:text-lg">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Wallet className="h-5 w-5" />
                    </span>
                    {t("hr.summary")} — {sel.name}
                  </h2>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { l: t("hr.base"), v: money(sel.stats.base), cls: "" },
                      { l: t("hr.absenceDays"), v: String(sel.stats.absentForDeduction), cls: "text-rose-600 dark:text-rose-400" },
                      { l: t("hr.deduction"), v: money(sel.stats.deduction), cls: "text-rose-600 dark:text-rose-400" },
                      { l: t("hr.bonus"), v: money(sel.stats.bonuses), cls: "text-sky-600 dark:text-sky-400" },
                      { l: t("hr.acomptes"), v: money(sel.stats.acomptes), cls: "text-amber-600 dark:text-amber-400" },
                      { l: t("hr.paidOut"), v: money(sel.stats.paidOut), cls: "" },
                      { l: t("hr.net"), v: money(sel.stats.net), cls: "text-emerald-600 dark:text-emerald-400" },
                      { l: t("hr.remaining"), v: money(sel.stats.remaining), cls: sel.stats.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400" },
                    ].map((c) => (
                      <div key={c.l} className="rounded-xl border bg-card/60 p-2.5 text-center">
                        <p className="text-[10.5px] leading-tight text-muted-foreground">{c.l}</p>
                        <p className={cn("text-sm sm:text-base font-black tabular-nums break-all", c.cls)}>{c.v}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {t("hr.deductionPerDay")}: {money(sel.stats.deductionPerDay)} · {t("hr.unpaidNote")}
                  </p>
                  <Button variant="outline" size="sm" onClick={openPayslip} disabled={slipBusy}
                    className="gap-1.5 rounded-full text-xs">
                    <Printer className="h-3.5 w-3.5" /> {t("hr.payslip")}
                  </Button>
                </CardContent>
              </Card>

              {/* الحضور والغياب — شبكة الشهر + حفظ يدوي جماعي */}
              <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 font-black text-base sm:text-lg">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
                        <CalendarCheck2 className="h-5 w-5" />
                      </span>
                      {t("hr.attendance")}
                    </h2>
                    {/* ★ v3.24.1: الحفظ اليدوي — يجمع كل تغييرات الأيام دفعة واحدة، والتقويم يبقى مفتوحاً */}
                    <Button size="sm" onClick={() => void saveAtt()} disabled={dirtyAtt === 0 || attSaving}
                      className={cn("gap-1.5 rounded-full text-xs", dirtyAtt > 0 && "shadow-md shadow-primary/25")}>
                      <Save className="h-3.5 w-3.5" />
                      {dirtyAtt > 0 ? `${t("hr.attSave")} (${dirtyAtt})` : t("hr.attSaved")}
                    </Button>
                  </div>
                  <p className="text-[11.5px] leading-relaxed text-muted-foreground">{t("hr.attManualNote")}</p>
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS.map((d) => (
                      <div key={d} className="pb-1 text-center text-[10px] font-black text-muted-foreground">{d}</div>
                    ))}
                    {attCells.map((c, i) =>
                      !c ? (
                        <div key={`e${i}`} className="min-h-9 rounded-lg bg-muted/30" />
                      ) : (
                        (() => {
                          const st = attMap.get(c.date) || "";
                          const isDirty = (attBase.get(c.date) || "") !== st;
                          const isToday = c.date === new Date().toISOString().slice(0, 10);
                          return (
                            <button key={c.date} type="button" onClick={() => cycleAtt(c.date)}
                              aria-label={`${c.date} — ${st ? t(`hr.st.${st}`) : t("hr.st.present")}`}
                              className={cn(
                                "relative flex min-h-9 flex-col items-center justify-center gap-0.5 rounded-lg border p-0.5 transition-all",
                                st === "absent" && "border-rose-400/60 bg-rose-500/10",
                                st === "leave" && "border-amber-400/60 bg-amber-500/10",
                                st === "holiday" && "border-sky-400/60 bg-sky-500/10",
                                st === "present" && "border-emerald-400/60 bg-emerald-500/10",
                                !st && "border-transparent bg-muted/30 hover:bg-muted/60",
                                isToday && "ring-2 ring-primary/50",
                                isDirty && "ring-2 ring-primary/70 ring-offset-1 ring-offset-card"
                              )}>
                              <span className="text-[11px] font-black tabular-nums">{c.day}</span>
                              {st && <span className={cn("h-1.5 w-1.5 rounded-full", ATT_DOT[st])} />}
                            </button>
                          );
                        })()
                      )
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-bold text-muted-foreground">
                    {(["present", "absent", "leave", "holiday"] as const).map((s) => (
                      <span key={s} className="flex items-center gap-1">
                        <span className={cn("h-2.5 w-2.5 rounded-full", ATT_DOT[s])} />
                        {t(`hr.st.${s}`)}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* الإجازات — إضافة/تعديل + نوع/سبب اختياري */}
              <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <h2 className="flex items-center gap-2 font-black text-base sm:text-lg">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                      <Plane className="h-5 w-5" />
                    </span>
                    {editLeave ? t("hr.leaveEdit") : t("hr.leaves")}
                    {editLeave && (
                      <Button variant="ghost" size="sm" onClick={cancelLeaveEdit} className="h-8 gap-1 rounded-full text-xs">
                        <X className="h-3.5 w-3.5" /> {t("common.cancel")}
                      </Button>
                    )}
                  </h2>
                  <div className="grid grid-cols-1 gap-2 rounded-2xl border bg-card/50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">{t("hr.leaveFrom")}</Label>
                      <Input type="date" value={lvFrom} onChange={(e) => setLvFrom(e.target.value)} className="h-10" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("hr.leaveTo")}</Label>
                      <Input type="date" value={lvTo} onChange={(e) => setLvTo(e.target.value)} className="h-10" />
                    </div>
                    <Select value={lvType} onValueChange={setLvType}>
                      <SelectTrigger className="h-10 w-full sm:w-36" aria-label={t("hr.payType")}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">{t("hr.leavePaid")}</SelectItem>
                        <SelectItem value="unpaid">{t("hr.leaveUnpaid")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="space-y-1 sm:col-span-3">
                      <Label className="text-xs">{t("hr.reason")}</Label>
                      <Input value={lvNote} onChange={(e) => setLvNote(e.target.value)} className="h-10"
                        placeholder={t("hr.reasonHint")} />
                    </div>
                    <Button size="sm" onClick={addLeave} disabled={busy} className="h-10 gap-1.5 rounded-xl text-xs sm:col-span-3">
                      <Plus className="h-3.5 w-3.5" /> {editLeave ? t("common.save") : t("hr.leaveAdd")}
                    </Button>
                  </div>
                  {leaves.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground">{t("hr.noLeaves")}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {leaves.map((l) => (
                        <div key={l._id} className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5 text-sm">
                          <Badge variant="outline" className={cn("rounded-full text-[10px]", l.type === "unpaid" ? PAY_BADGE.deduction : PAY_BADGE.salary)}>
                            {l.type === "unpaid" ? t("hr.leaveUnpaid") : t("hr.leavePaid")}
                          </Badge>
                          <span className="tabular-nums text-xs text-muted-foreground" dir="ltr">{l.start} → {l.end}</span>
                          {l.note && <span className="min-w-0 flex-1 text-xs break-words text-muted-foreground">{l.note}</span>}
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-primary"
                            aria-label={t("hr.leaveEdit")}
                            onClick={() => openLeaveEdit(l)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive"
                            aria-label={t("hr.delete")}
                            onClick={async () => { if (await post({ action: "leave.delete", _id: l._id }, t("hr.leaveDeleted"))) setBusy(false); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* الدفعات — إضافة/تعديل + سبب/ملاحظة اختيارية */}
              <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <h2 className="flex items-center gap-2 font-black text-base sm:text-lg">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                      <HandCoins className="h-5 w-5" />
                    </span>
                    {editPay ? t("hr.payEdit") : t("hr.payments")}
                    {editPay && (
                      <Button variant="ghost" size="sm" onClick={cancelPayEdit} className="h-8 gap-1 rounded-full text-xs">
                        <X className="h-3.5 w-3.5" /> {t("common.cancel")}
                      </Button>
                    )}
                  </h2>
                  <div className="grid grid-cols-1 gap-2 rounded-2xl border bg-card/50 p-3 sm:grid-cols-[auto_1fr_1fr] sm:items-end">
                    <Select value={payType} onValueChange={setPayType}>
                      <SelectTrigger className="h-10 w-full sm:w-44" aria-label={t("hr.payType")}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["acompte", "salary", "bonus", "deduction"] as const).map((k) => (
                          <SelectItem key={k} value={k}>{t(PAY_KEY[k])}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" min={0} placeholder={t("hr.amount")} value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)} className="h-10 tabular-nums" />
                    <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="h-10" />
                    <div className="space-y-1 sm:col-span-3">
                      <Label className="text-xs">{t("hr.reason")}</Label>
                      <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} className="h-10"
                        placeholder={t("hr.reasonHint")} />
                    </div>
                    <Button size="sm" onClick={addPay} disabled={busy} className="h-10 gap-1.5 rounded-xl text-xs sm:col-span-3">
                      <Plus className="h-3.5 w-3.5" /> {editPay ? t("common.save") : t("hr.payAdd")}
                    </Button>
                  </div>
                  {pays.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground">{t("hr.noPayments")}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {pays.map((p) => (
                        <div key={p._id} className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5 text-sm">
                          <Badge variant="outline" className={cn("rounded-full text-[10px]", PAY_BADGE[p.type])}>
                            {t(PAY_KEY[p.type] || "hr.pt.acompte")}
                          </Badge>
                          <span className="font-black tabular-nums">{money(p.amount)}</span>
                          <span className="tabular-nums text-xs text-muted-foreground" dir="ltr">{p.date}</span>
                          {p.byName && <span className="text-[11px] text-muted-foreground">{t("hr.paidBy", { n: p.byName })}</span>}
                          {p.note && <span className="min-w-0 flex-1 text-xs break-words text-muted-foreground">{p.note}</span>}
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-primary"
                            aria-label={t("hr.payEdit")}
                            onClick={() => openPayEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive"
                            aria-label={t("hr.delete")}
                            onClick={async () => { if (await post({ action: "payment.delete", _id: p._id }, t("hr.payDeleted"))) setBusy(false); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* نموذج إضافة/تعديل موظف */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={() => setShowForm(false)}>
          <Card className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="space-y-3.5 p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-black text-lg">
                  <UsersRound className="h-5 w-5 text-primary" />
                  {editEmp ? t("hr.edit") : t("hr.addEmployee")}
                </h2>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("common.close")} onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Label>{t("hr.name")} *</Label>
                <Input value={fName} onChange={(e) => setFName(e.target.value)} className="h-11" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("hr.role")}</Label>
                  <Select value={fRole} onValueChange={setFRole}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["specialist", "assistant", "cleaner", "guard", "other"] as const).map((r) => (
                        <SelectItem key={r} value={r}>{t(ROLE_KEY[r])}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("hr.baseSalary")}</Label>
                  <Input type="number" min={0} step={500} value={fSalary} onChange={(e) => setFSalary(e.target.value)} className="h-11 tabular-nums" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("hr.phone")}</Label>
                <Input type="tel" dir="ltr" value={fPhone} onChange={(e) => setFPhone(e.target.value)} className="h-11 text-start" />
              </div>
              <div className="space-y-2">
                <Label>{t("hr.notes")}</Label>
                <Textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2} className="resize-none" />
              </div>
              {editEmp && (
                <label className="flex items-center justify-between rounded-xl border p-3">
                  <span className="text-sm font-semibold">{t("hr.active")}</span>
                  <Switch checked={fActive} onCheckedChange={setFActive} />
                </label>
              )}
              <Button onClick={saveEmp} disabled={busy} className="h-12 w-full rounded-xl text-base">
                {busy ? t("common.saving") : t("common.save")}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* تأكيد حذف الموظف */}
      <AlertDialog open={!!delEmp} onOpenChange={(v) => !v && setDelEmp(null)}>
        <AlertDialogContent className="max-w-md rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <CircleAlert className="h-5 w-5" /> {t("hr.delete")}
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">{t("hr.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <AlertDialogCancel className="rounded-xl">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const e = delEmp; setDelEmp(null);
                if (e) { if (await post({ action: "employee.delete", _id: e._id }, t("hr.empDeleted"))) { setSelId(""); setBusy(false); } }
              }}>
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ ورقة الراتب الاحترافية (★ v3.24.1) — بوابة إلى جذر المستند لطباعة وحيدة
          بلا صفحات فارغة، مع اسم ملف PDF يحمل اسم الموظف وشهر الأجر ═══ */}
      {payslip && (() => {
        const c = payslip.center;
        const cap = { fr: "Fr", en: "En", tr: "Tr", es: "Es" } as Record<string, string>;
        const centerTitle = lang === "ar" ? (c.name || "") : ((c as unknown as Record<string, string>)[`name${cap[lang]}`] || c.name || "");
        const centerAddr = lang === "ar" ? (c.address || "") : ((c as unknown as Record<string, string>)[`address${cap[lang]}`] || c.address || "");
        const logo = c.logoBase64 || "/logo.png";
        const net = payslip.stats.net;
        const rows = [
          /* المستحقات — الأجر الأساسي دائماً، والمكافآت عند وجودها */
          { side: "in" as const, label: t("hr.base"), value: payslip.stats.base, show: true },
          { side: "in" as const, label: t("hr.bonus"), value: payslip.stats.bonuses, show: payslip.stats.bonuses > 0 },
          /* الخصومات والدفعات — تظهر فقط عند وجود قيمة */
          { side: "out" as const, label: `${t("hr.deduction")} (${payslip.stats.absentForDeduction} ${t("ps.daysUnit")} × ${money(payslip.stats.deductionPerDay)})`, value: payslip.stats.deduction, show: payslip.stats.deduction > 0 },
          { side: "out" as const, label: t("hr.pt.deduction"), value: payslip.stats.adminDeductions, show: payslip.stats.adminDeductions > 0 },
          { side: "out" as const, label: t("hr.acomptes"), value: payslip.stats.acomptes, show: payslip.stats.acomptes > 0 },
          { side: "out" as const, label: t("hr.paidOut"), value: payslip.stats.paidOut, show: payslip.stats.paidOut > 0 },
        ];
        return createPortal(
          <div className="slip-root fixed inset-0 z-[70] overflow-y-auto bg-black/60 p-3 sm:p-6" onClick={() => setPayslip(null)}>
            <div className="mx-auto w-full max-w-[860px]" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex items-center justify-end gap-2 slip-no-print">
                <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 rounded-full bg-white text-xs">
                  <Printer className="h-3.5 w-3.5" /> {t("hr.print")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPayslip(null)} className="gap-1.5 rounded-full bg-white text-xs">
                  <X className="h-3.5 w-3.5" /> {t("common.close")}
                </Button>
              </div>
              <div className="slip-sheet rounded-2xl bg-white p-6 text-foreground shadow-2xl sm:p-10">
                {/* الرأس — اللوغو واسم المركز بلغة الوثيقة والعنوان */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-gray-900 pb-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo} alt="" className="h-14 w-14 shrink-0 object-contain" />
                    <div className="min-w-0">
                      <p className="text-lg font-black leading-tight break-words">{centerTitle}</p>
                      {centerAddr && <p className="text-[11px] leading-snug text-gray-600 break-words">{centerAddr}</p>}
                      {c.phone && <p className="text-[11px] text-gray-600 tabular-nums" dir="ltr">{c.phone}</p>}
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="text-xl font-black uppercase tracking-wide">{t("ps.header")}</p>
                    <p className="mt-1 text-xs font-bold text-gray-700">{t("hr.payslipMonth")}: <span className="tabular-nums" dir="ltr">{payslip.month}</span></p>
                    <p className="text-xs text-gray-600">{t("hr.payslipDate")}: <span className="tabular-nums" dir="ltr">{payslip.issuedOn.slice(0, 10)}</span></p>
                  </div>
                </div>

                {/* جدول الهوية — بيانات العامل */}
                <table className="mt-5 w-full border-collapse text-[13px]">
                  <tbody>
                    <tr>
                      <td className="w-1/4 border border-gray-300 bg-gray-50 px-3 py-1.5 font-bold text-gray-700">{t("ps.empName")}</td>
                      <td className="w-1/4 border border-gray-300 px-3 py-1.5 font-black break-words">{payslip.employee.name}</td>
                      <td className="w-1/4 border border-gray-300 bg-gray-50 px-3 py-1.5 font-bold text-gray-700">{t("ps.job")}</td>
                      <td className="w-1/4 border border-gray-300 px-3 py-1.5">{t(ROLE_KEY[payslip.employee.role] || "hr.role.other")}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 bg-gray-50 px-3 py-1.5 font-bold text-gray-700">{t("ps.payPeriod")}</td>
                      <td className="border border-gray-300 px-3 py-1.5 tabular-nums" dir="ltr">{payslip.month}</td>
                      <td className="border border-gray-300 bg-gray-50 px-3 py-1.5 font-bold text-gray-700">{t("ps.phoneLbl")}</td>
                      <td className="border border-gray-300 px-3 py-1.5 tabular-nums" dir="ltr">{payslip.employee.phone || "—"}</td>
                    </tr>
                  </tbody>
                </table>

                {/* جدول الاحتساب — المستحقات مقابل الخصومات والدفعات */}
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="border border-gray-400 bg-gray-900 px-3 py-1.5 text-center text-[12px] font-black uppercase text-white">{t("ps.earn")}</p>
                    <table className="w-full border-collapse text-[13px]">
                      <tbody>
                        {rows.filter((r) => r.side === "in" && r.show).map((r) => (
                          <tr key={r.label}>
                            <td className="border border-gray-300 px-3 py-1.5">{r.label}</td>
                            <td className="border border-gray-300 px-3 py-1.5 text-end font-bold tabular-nums" dir="ltr">{money(r.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <p className="border border-gray-400 bg-gray-900 px-3 py-1.5 text-center text-[12px] font-black uppercase text-white">{t("ps.deduct")}</p>
                    <table className="w-full border-collapse text-[13px]">
                      <tbody>
                        {rows.filter((r) => r.side === "out" && r.show).map((r) => (
                          <tr key={r.label}>
                            <td className="border border-gray-300 px-3 py-1.5">{r.label}</td>
                            <td className="border border-gray-300 px-3 py-1.5 text-end font-bold tabular-nums" dir="ltr">{`- ${money(r.value)}`}</td>
                          </tr>
                        ))}
                        {rows.filter((r) => r.side === "out" && r.show).length === 0 && (
                          <tr><td colSpan={2} className="border border-gray-300 px-3 py-2 text-center text-gray-500">{t("ps.noDeduct")}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* الصافي — السطر المهم */}
                <table className="mt-4 w-full border-collapse text-sm">
                  <tbody>
                    <tr className="bg-gray-900 text-white">
                      <td className="px-3 py-2.5 font-black">{t("hr.payslipNet")}</td>
                      <td className="px-3 py-2.5 text-end text-base font-black tabular-nums" dir="ltr">{money(net)}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-3 py-1.5 font-bold text-gray-700">{t("hr.remaining")}</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-end font-black tabular-nums" dir="ltr">{money(payslip.stats.remaining)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* ملخص الحضور */}
                <p className="mt-3 text-[11.5px] leading-relaxed text-gray-700">
                  <span className="font-black">{t("ps.attSummary")}:</span>{" "}
                  {t("hr.absenceDays")}: {payslip.stats.absentForDeduction} {t("ps.daysUnit")} · {t("hr.st.leave")}: {payslip.stats.leave + payslip.stats.paidLeave} {t("ps.daysUnit")} ({t("hr.leavePaid")}: {payslip.stats.paidLeave} — {t("hr.leaveUnpaid")}: {payslip.stats.unpaidLeave}) · {t("hr.deductionPerDay")}: {money(payslip.stats.deductionPerDay)}
                </p>

                {/* تفصيل الدفعات */}
                {payslip.payments.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[12px] font-black text-gray-800">{t("ps.paymentsDetail")}</p>
                    <table className="mt-1 w-full border-collapse text-[12px]">
                      <thead>
                        <tr className="bg-gray-100 text-gray-700">
                          <th className="border border-gray-300 px-2 py-1 text-start font-bold">{t("hr.payType")}</th>
                          <th className="border border-gray-300 px-2 py-1 text-start font-bold">{t("ps.payDate")}</th>
                          <th className="border border-gray-300 px-2 py-1 text-end font-bold">{t("hr.amount")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payslip.payments.map((p, i) => (
                          <tr key={p._id || i}>
                            <td className="border border-gray-300 px-2 py-1">{t(PAY_KEY[p.type] || "hr.pt.acompte")}{p.note ? ` — ${p.note}` : ""}</td>
                            <td className="border border-gray-300 px-2 py-1 tabular-nums" dir="ltr">{p.date}</td>
                            <td className="border border-gray-300 px-2 py-1 text-end font-bold tabular-nums" dir="ltr">{money(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* تفصيل الإجازات */}
                {payslip.leaves.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[12px] font-black text-gray-800">{t("ps.leavesDetail")}</p>
                    <table className="mt-1 w-full border-collapse text-[12px]">
                      <thead>
                        <tr className="bg-gray-100 text-gray-700">
                          <th className="border border-gray-300 px-2 py-1 text-start font-bold">{t("hr.leaveFrom")}</th>
                          <th className="border border-gray-300 px-2 py-1 text-start font-bold">{t("hr.leaveTo")}</th>
                          <th className="border border-gray-300 px-2 py-1 text-start font-bold">{t("hr.payType")}</th>
                          <th className="border border-gray-300 px-2 py-1 text-start font-bold">{t("hr.reason")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payslip.leaves.map((l, i) => (
                          <tr key={l._id || i}>
                            <td className="border border-gray-300 px-2 py-1 tabular-nums" dir="ltr">{l.start}</td>
                            <td className="border border-gray-300 px-2 py-1 tabular-nums" dir="ltr">{l.end}</td>
                            <td className="border border-gray-300 px-2 py-1">{l.type === "unpaid" ? t("hr.leaveUnpaid") : t("hr.leavePaid")}</td>
                            <td className="border border-gray-300 px-2 py-1">{l.note || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* الملاحظة القانونية — احتساب قسط اليوم وفق قانون العمل */}
                <p className="mt-4 rounded border border-gray-300 bg-gray-50 px-3 py-2 text-[10.5px] leading-relaxed text-gray-600">
                  {t("ps.legal", { d: money(payslip.stats.deductionPerDay) })}
                </p>

                {/* التوقيعات */}
                <div className="mt-6 grid grid-cols-2 gap-6 border-t border-gray-300 pt-5 text-center text-xs text-gray-700">
                  <div>
                    <p className="font-bold">{t("ps.signEmp")}</p>
                    <div className="mx-auto mt-8 w-40 border-t border-gray-400 pt-1">{payslip.employee.name}</div>
                  </div>
                  <div>
                    <p className="font-bold">{t("ps.signAdmin")}</p>
                    <div className="mx-auto mt-8 w-40 border-t border-gray-400 pt-1">{centerTitle}</div>
                  </div>
                </div>
                <p className="mt-4 text-center text-[9.5px] text-gray-400">
                  {t("ps.electronic", { d: payslip.issuedOn.slice(0, 10) })}
                </p>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}

"use client";
/**
 * لوحة القيادة — إحصائيات المركز الحية للإدارة والمساعد
 * مواعيد بالحالة، جلسات عن بُعد/حضورية، الأداء، الملفات، البلاغات، طلبات الاستعادة
 * ★ v3.6: بطاقة المبالغ الشاملة — كل المبالغ في مكان واحد:
 *   الحجوزات (مدفوع/غير مدفوع/الإجمالي) + التكوينات المتوقعة + الخدمات المحجوزة
 *   + الإجمالي العام — تحديث تلقائي كل 45 ثانية وعند العودة للصفحة
 * ★ v3.8: رسوم بيانية حية — الحجوزات الشهرية، الخدمات الأكثر طلباً، نمو العملاء
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard, UsersRound, Stethoscope, CalendarClock, Hourglass, CheckCircle2,
  CircleCheckBig, XCircle, Wallet, PiggyBank, FolderHeart, MessageSquareHeart, KeyRound,
  ArrowLeft, ArrowRight, Wifi, MapPinned, RefreshCw, Coins, GraduationCap, Sparkles, Banknote,
  BarChart3, TrendingUp, ShieldCheck, ChartPie, Download, FileSpreadsheet, DatabaseBackup,
  BookOpenText,
} from "lucide-react";
import type { Navigate } from "@/lib/nav";
import { localeOf } from "@/components/tri-input";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";

type Stats = { clients: number; specialists: number; remote: number; onsite: number; centerDays: number; languages: number };
type Dash = {
  pending: number; confirmed: number; completed: number; cancelled: number;
  unpaidSum: number; paidSum: number; unpaidCount: number; files: number; newFeedback: number; resets: number;
  /* v3.6 — بطاقة المبالغ الشاملة */
  coursesExpected?: number; coursesEnrolled?: number;
  servicesPaid?: number; servicesUnpaid?: number; servicesCount?: number; grandTotal?: number;
  ebooksPaid?: number; ebooksCount?: number;
  /* v3.8 — الرسوم البيانية */
  monthly?: { month: string; pending: number; confirmed: number; completed: number }[];
  topServices?: { name: string; count: number; sum: number }[];
  growth?: { month: string; count: number; total: number }[];
};

export default function Dashboard({ navigate }: { navigate: Navigate }) {
  const { t, lang, me } = useApp();
  const [stats, setStats] = useState<Stats | null>(null);
  const [dash, setDash] = useState<Dash | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const dir = lang === "ar" ? "rtl" : "ltr";
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;

  /* ★ v3.5: المبالغ والأرقام تُحدَّث مباشرة — جلب يدوي + تحديث تلقائي كل 45 ثانية
     + تحديث فوري عند العودة إلى الصفحة/النافذة */
  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/stats", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setStats(j.stats || null);
        setDash(j.dashboard || null);
      }
    } catch {}
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 45000);
    const onFocus = () => load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const money = (n: number) => `${(n || 0).toLocaleString(lang === "ar" ? "ar-DZ" : "fr-DZ")} ${lang === "ar" ? "دج" : "DA"}`;

  /* ★ v3.23: لوحة القيادة للإدارة فقط — حُجبت عن حساب المساعد (طلب المستخدم).
     الحرس بعد كل الـ hooks حتى تُستدعى دائماً بنفس الترتيب */
  if (me?.role !== "admin") {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-600">
          <ShieldCheck className="h-8 w-8" />
        </span>
        <h1 className="text-xl font-black">{t("common.noAccess")}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("dash.adminOnly")}</p>
        <Button variant="outline" onClick={() => navigate("home")} className="rounded-xl">
          {t("common.goHome")}
        </Button>
      </div>
    );
  }

  /* اسم الشهر بلغة الواجهة — "2025-05" → "ماي" */
  const monthName = (ym: string) => {
    try {
      const [y, m] = ym.split("-").map(Number);
      const d = new Date(y, (m || 1) - 1, 1);
      return d.toLocaleDateString(localeOf(lang), { month: "short" });
    } catch {
      return ym;
    }
  };

  /* بطاقة المبالغ الشاملة (v3.6) — صف: أيقونة، تسمية، قيمة */
  const amountRows: { icon: typeof PiggyBank; label: string; value: string; cls?: string }[] = [
    { icon: PiggyBank, label: t("dash.amtPaid"), value: money(dash?.paidSum || 0), cls: "text-emerald-600 dark:text-emerald-400" },
    { icon: Wallet, label: t("dash.amtUnpaid"), value: `${money(dash?.unpaidSum || 0)} (${dash?.unpaidCount ?? 0})`, cls: "text-amber-600 dark:text-amber-400" },
    { icon: Banknote, label: t("dash.amtBookingsTotal"), value: money((dash?.paidSum || 0) + (dash?.unpaidSum || 0)) },
    { icon: GraduationCap, label: t("dash.amtCourses"), value: `${money(dash?.coursesExpected || 0)} (${dash?.coursesEnrolled ?? 0})`, cls: "text-sky-600 dark:text-sky-400" },
    { icon: Sparkles, label: t("dash.amtServicesPaid"), value: money(dash?.servicesPaid || 0), cls: "text-emerald-600 dark:text-emerald-400" },
    { icon: Sparkles, label: t("dash.amtServicesUnpaid"), value: money(dash?.servicesUnpaid || 0), cls: "text-amber-600 dark:text-amber-400" },
    { icon: BookOpenText, label: t("dash.amtEbooks"), value: `${money(dash?.ebooksPaid || 0)} (${dash?.ebooksCount ?? 0})`, cls: "text-violet-600 dark:text-violet-400" },
  ];

  const cards: { icon: typeof UsersRound; label: string; value: string; cls?: string }[] = [
    { icon: UsersRound, label: t("dash.clients"), value: String(stats?.clients ?? "—") },
    { icon: Stethoscope, label: t("dash.specialists"), value: String(stats?.specialists ?? "—") },
    { icon: Wifi, label: t("dash.remote"), value: String(stats?.remote ?? "—") },
    { icon: MapPinned, label: t("dash.onsite"), value: String(stats?.onsite ?? "—") },
    { icon: Hourglass, label: t("dash.pending"), value: String(dash?.pending ?? "—") },
    { icon: CheckCircle2, label: t("dash.confirmed"), value: String(dash?.confirmed ?? "—") },
    { icon: CircleCheckBig, label: t("dash.completed"), value: String(dash?.completed ?? "—") },
    { icon: XCircle, label: t("dash.cancelled"), value: String(dash?.cancelled ?? "—") },
    { icon: FolderHeart, label: t("dash.files"), value: String(dash?.files ?? "—") },
    { icon: MessageSquareHeart, label: t("dash.newFeedback"), value: String(dash?.newFeedback ?? "—") },
  ];

  /* ★ v3.23: بطاقة الخدمات الأكثر طلباً — دائرة نسب مؤية بأسماء كاملة بلا اقتصاص */
  const PIE_COLORS = ["#0f766e", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#a855f7"];
  const pieTotal = (dash?.topServices || []).reduce((a, s) => a + s.count, 0);
  const pieData = (dash?.topServices || []).map((s) => ({
    fullName: s.name,
    count: s.count,
    pct: pieTotal > 0 ? Math.round((s.count / pieTotal) * 1000) / 10 : 0,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BackButton onBack={() => navigate("home")} />
        <h1 className="text-xl sm:text-2xl font-black">{t("dash.title")}</h1>
        {/* زر التحديث الفوري — الأرقام حية دائماً */}
        <Button variant="outline" size="sm" onClick={load} disabled={refreshing}
          className="ms-auto gap-1.5 rounded-full text-xs">
          <RefreshCw className={"h-3.5 w-3.5 " + (refreshing ? "animate-spin" : "")} />
          {t("dash.refresh")}
        </Button>
      </div>

      {dash && dash.resets > 0 && (
        <Button variant="outline" onClick={() => navigate("accounts")} className="w-full justify-between gap-2 border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400 h-auto py-3">
          <span className="flex items-center gap-2 font-bold">
            <KeyRound className="h-4 w-4" />
            {t("dash.resets")} ({dash.resets})
          </span>
          <Arrow className="h-4 w-4" />
        </Button>
      )}

      {/* ═══ بطاقة المبالغ الشاملة (v3.6) — كل المبالغ في مكان واحد ═══ */}
      <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-black flex items-center gap-2 text-base sm:text-lg">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Coins className="h-5 w-5" />
              </span>
              {t("dash.amountsTitle")}
            </h2>
            <Badge variant="secondary" className="rounded-full text-[11px]">
              {t("dash.amountsLive")}
            </Badge>
          </div>

          {!stats ? (
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
            </div>
          ) : (
            <>
              <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-3">
                {amountRows.map((r) => (
                  <div key={r.label} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                      <r.icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className={"text-sm sm:text-base font-black tabular-nums leading-tight break-all " + (r.cls || "")}>{r.value}</p>
                      <p className="text-[11px] sm:text-xs text-muted-foreground font-semibold leading-snug break-words">{r.label}</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* الإجمالي العام */}
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-primary to-primary/85 px-4 py-3.5 text-primary-foreground shadow-md shadow-primary/20">
                <span className="flex items-center gap-2 font-black text-sm sm:text-base">
                  <Banknote className="h-5 w-5 shrink-0" />
                  {t("dash.grandTotal")}
                </span>
                <span className="text-lg sm:text-xl font-black tabular-nums break-all">{money(dash?.grandTotal || 0)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!stats ? (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-28 rounded-3xl" />)}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.label} className="ait-card rounded-3xl shadow-sm">
              <CardContent className="p-4 sm:p-5 space-y-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <c.icon className="h-5 w-5" />
                </span>
                <p className={"text-2xl font-black tabular-nums break-all " + (c.cls || "")}>{c.value}</p>
                <p className="text-xs sm:text-[13px] text-muted-foreground font-semibold leading-snug break-words">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* اختصارات سريعة — إدارة الوثائق لحساب الإدارة فقط */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { k: "appointments" as const, icon: CalendarClock, label: t("nav.appointments") },
          { k: "patients" as const, icon: FolderHeart, label: t("nav.patients") },
          ...(me?.role === "admin" ? [{ k: "documents" as const, icon: LayoutDashboard, label: t("nav.documents") }] : []),
        ].map((q) => (
          <Button key={q.k} variant="outline" onClick={() => navigate(q.k)} className="h-12 rounded-2xl gap-2 justify-start">
            <q.icon className="h-4.5 w-4.5 text-primary" /> {q.label}
          </Button>
        ))}
      </div>

      {/* ═══════ v3.8: الرسوم البيانية الحية ═══════ */}
      {dash?.monthly && dash.monthly.length > 0 && (
        <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <h2 className="font-black flex items-center gap-2 text-base sm:text-lg">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <BarChart3 className="h-5 w-5" />
              </span>
              {t("dash.chartMonthly")}
            </h2>
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dash.monthly.map((m) => ({ ...m, label: monthName(m.month) }))} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b844" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="completed" name={t("dash.completed")} fill="#0f766e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="confirmed" name={t("dash.confirmed")} fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" name={t("dash.pending")} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* نمو العملاء */}
        {dash?.growth && dash.growth.length > 0 && (
          <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <h2 className="font-black flex items-center gap-2 text-base sm:text-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
                  <TrendingUp className="h-5 w-5" />
                </span>
                {t("dash.chartGrowth")}
              </h2>
              <div className="h-60 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dash.growth.map((g) => ({ ...g, label: monthName(g.month) }))} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gGrowth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b844" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                    <Area type="monotone" dataKey="total" name={t("dash.chartTotalClients")} stroke="#0ea5e9" strokeWidth={2.5} fill="url(#gGrowth)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* الخدمات الأكثر طلباً — ★ v3.23: دائرة نسب مؤية بأسماء كاملة بلا اقتصاص */}
        {dash?.topServices && dash.topServices.length > 0 && (
          <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <h2 className="font-black flex items-center gap-2 text-base sm:text-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <ChartPie className="h-5 w-5" />
                </span>
                {t("dash.chartTopServices")}
              </h2>
              <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-center">
                {/* الدائرة — الإجمالي في المركز */}
                <div className="relative h-52 w-52 shrink-0" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="count"
                        nameKey="fullName"
                        innerRadius="70%"
                        outerRadius="94%"
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                        formatter={(v: number | string, name: string) => {
                          const pct = pieData.find((p) => p.fullName === name)?.pct ?? 0;
                          return [`${v} (${pct}%)`, name] as [string, string];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black tabular-nums leading-none">{pieTotal}</span>
                    <span className="mt-1 max-w-24 text-center text-[10px] font-bold leading-tight text-muted-foreground">
                      {t("dash.chartBookingsCount")}
                    </span>
                  </div>
                </div>
                {/* التفسير — الأسماء كاملة تتلف بلا اقتطاع، نسب ومجاميع */}
                <ul className="w-full min-w-0 flex-1 space-y-1.5">
                  {pieData.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-xl border bg-card p-2.5">
                      <span
                        aria-hidden="true"
                        className="mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-background"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="min-w-0 flex-1 text-xs font-bold leading-snug break-words">{s.fullName}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] tabular-nums">{s.count}</Badge>
                        <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/8 px-2 py-0.5 text-[10px] font-black tabular-nums text-primary">
                          {s.pct}%
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

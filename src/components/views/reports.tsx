"use client";
/**
 * ★ v3.23 — التقارير المالية والإدارية (حساب الإدارة فقط)
 * لوحة شاملة: مداخيل المركز المحققة (الجلسات المدفوعة + الكتب المباعة)،
 * مصاريف الرواتب (الأخصائيون × النسب + المساعدة)، وصافي الأرباح.
 *  — تفصيل الشهر المختار + التكوينات كمتوقع خارج الصافي (تسجيل مقعد ≠ تحصيل)
 *  — سلسلة 12 شهراً: رسم بياني مركّب + جدول
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { PageSkeleton } from "@/components/brand-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Info, TrendingUp, Wallet, PiggyBank, GraduationCap, Banknote,
  BookOpenText, Sparkles, RefreshCw, Table2, UsersRound,
} from "lucide-react";
import { localeOf } from "@/components/tri-input";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import type { Navigate } from "@/lib/nav";

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
type Reports = {
  month: string;
  series: MonthRow[];
  detail: MonthRow & {
    coursesExpected: number;
    coursesSeats: number;
    salariesBreakdown: {
      specialistsDues: number;
      specialistsSessions: number;
      assistantNet: number;
      assistantSaved: boolean;
      total: number;
    };
  };
};

function currentYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Reports({ navigate }: { navigate: Navigate }) {
  const { t, lang } = useApp();
  const [month, setMonth] = useState(currentYm());
  const [data, setData] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (ym: string) => {
    setRefreshing(true);
    try {
      const r = await fetch(`/api/reports?month=${ym}`, { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch {}
    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => { load(month); }, [month, load]);

  const money = (n: number) => `${(n || 0).toLocaleString(lang === "ar" ? "ar-DZ" : "fr-DZ")} ${lang === "ar" ? "دج" : "DA"}`;
  const monthName = (ym: string) => {
    try {
      const [y, m] = ym.split("-").map(Number);
      return new Date(y, (m || 1) - 1, 1).toLocaleDateString(localeOf(lang), { month: "short", year: "2-digit" });
    } catch {
      return ym;
    }
  };

  const d = data?.detail;

  const summary: { icon: typeof Wallet; label: string; value: string; cls: string; ring: string }[] = [
    {
      icon: TrendingUp,
      label: t("rep.revenue"),
      value: money(d?.revenue || 0),
      cls: "text-emerald-600 dark:text-emerald-400",
      ring: "bg-emerald-500/10 text-emerald-600",
    },
    {
      icon: Wallet,
      label: t("rep.salaries"),
      value: money(d?.salaries || 0),
      cls: "text-rose-600 dark:text-rose-400",
      ring: "bg-rose-500/10 text-rose-600",
    },
    {
      icon: PiggyBank,
      label: t("rep.net"),
      value: money(d?.net || 0),
      cls: (d?.net || 0) >= 0 ? "text-primary" : "text-rose-600 dark:text-rose-400",
      ring: "bg-primary/10 text-primary",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <BackButton onBack={() => navigate("home")} />
          <h1 className="text-xl sm:text-2xl font-black break-words">{t("rep.title")}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(month)} disabled={refreshing}
          className="ms-auto gap-1.5 rounded-full text-xs">
          <RefreshCw className={"h-3.5 w-3.5 " + (refreshing ? "animate-spin" : "")} />
          {t("dash.refresh")}
        </Button>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-primary/6 border border-primary/15 px-4 py-2.5 text-sm text-primary">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span className="leading-relaxed">{t("rep.note")}</span>
      </p>

      {/* اختيار الشهر */}
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="rep-month" className="text-sm font-bold">{t("pay.month")}</Label>
        <Input
          id="rep-month"
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="h-11 w-44"
        />
      </div>

      {loading ? (
        <PageSkeleton kind="cards" count={3} label={t("common.loading")} />
      ) : !d ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">{t("common.error")}</CardContent>
        </Card>
      ) : (
        <>
          {/* ═══ ملخص الشهر: مداخيل / رواتب / صافي ═══ */}
          <div className="grid gap-3 sm:grid-cols-3">
            {summary.map((c) => (
              <Card key={c.label} className="ait-card rounded-3xl shadow-sm">
                <CardContent className="p-4 sm:p-5 space-y-2">
                  <span className={"flex h-10 w-10 items-center justify-center rounded-2xl " + c.ring}>
                    <c.icon className="h-5 w-5" />
                  </span>
                  <p className={"text-xl sm:text-2xl font-black tabular-nums break-all " + c.cls}>{c.value}</p>
                  <p className="text-xs sm:text-[13px] text-muted-foreground font-semibold leading-snug break-words">{c.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ═══ تفصيل الشهر ═══ */}
          <div className="grid gap-3 lg:grid-cols-2">
            {/* المداخيل */}
            <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
              <CardContent className="p-5 sm:p-6 space-y-3">
                <h2 className="font-black flex items-center gap-2 text-base sm:text-lg">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                    <Banknote className="h-5 w-5" />
                  </span>
                  {t("rep.revenueTitle")}
                </h2>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-3.5">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <Sparkles className="h-4 w-4 text-emerald-500 shrink-0" />
                      {t("rep.sessionsPaid")}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="rounded-full text-[11px]">{d.sessionsCount}</Badge>
                      <span className="text-sm font-black tabular-nums break-all">{money(d.sessionsPaid)}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-3.5">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <BookOpenText className="h-4 w-4 text-sky-500 shrink-0" />
                      {t("rep.ebooks")}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="rounded-full text-[11px]">{d.ebooksCount}</Badge>
                      <span className="text-sm font-black tabular-nums break-all">{money(d.ebooks)}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/25 bg-primary/5 p-3.5">
                    <span className="flex items-center gap-2 text-sm font-black">
                      <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                      {t("rep.revenueTotal")}
                    </span>
                    <span className="text-base font-black tabular-nums text-primary break-all">{money(d.revenue)}</span>
                  </div>
                  {/* التكوينات — متوقع خارج الصافي */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5">
                    <span className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
                      <GraduationCap className="h-4 w-4 shrink-0" />
                      {t("rep.courses")}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-full border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-400">
                        {t("rep.coursesSeats", { n: d.coursesSeats })}
                      </Badge>
                      <span className="text-sm font-black tabular-nums text-amber-700 dark:text-amber-400 break-all">
                        {money(d.coursesExpected)}
                      </span>
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{t("rep.coursesHint")}</p>
                </div>
              </CardContent>
            </Card>

            {/* الرواتب */}
            <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
              <CardContent className="p-5 sm:p-6 space-y-3">
                <h2 className="font-black flex items-center gap-2 text-base sm:text-lg">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
                    <Wallet className="h-5 w-5" />
                  </span>
                  {t("rep.salariesTitle")}
                </h2>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-3.5">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <UsersRound className="h-4 w-4 text-primary shrink-0" />
                      {t("rep.specDues")}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary" className="rounded-full text-[11px]">
                        {t("pay.sessionsDone", { n: d.salariesBreakdown.specialistsSessions })}
                      </Badge>
                      <span className="text-sm font-black tabular-nums break-all">
                        {money(d.salariesBreakdown.specialistsDues)}
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card p-3.5">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <Banknote className="h-4 w-4 text-violet-500 shrink-0" />
                      {t("rep.assistantNet")}
                    </span>
                    <span className="text-sm font-black tabular-nums break-all">
                      {money(d.salariesBreakdown.assistantNet)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-3.5">
                    <span className="flex items-center gap-2 text-sm font-black text-rose-700 dark:text-rose-400">
                      <Wallet className="h-4 w-4 shrink-0" />
                      {t("rep.salariesTotal")}
                    </span>
                    <span className="text-base font-black tabular-nums text-rose-700 dark:text-rose-400 break-all">
                      {money(d.salariesBreakdown.total)}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{t("rep.salariesHint")}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ═══ رسم 12 شهراً ═══ */}
          <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <h2 className="font-black flex items-center gap-2 text-base sm:text-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <TrendingUp className="h-5 w-5" />
                </span>
                {t("rep.chartTitle")}
              </h2>
              <div className="h-72 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={[...data!.series].reverse().map((r) => ({ ...r, label: monthName(r.month) }))}
                    margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b844" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                      formatter={(v: number | string, name: string) => [money(Number(v)), name] as [string, string]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name={t("rep.revenue")} fill="#10b981" radius={[4, 4, 0, 0]} barSize={14} />
                    <Bar dataKey="salaries" name={t("rep.salaries")} fill="#f87171" radius={[4, 4, 0, 0]} barSize={14} />
                    <Line type="monotone" dataKey="net" name={t("rep.net")} stroke="#0f766e" strokeWidth={2.5} dot={{ r: 2.5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* ═══ جدول 12 شهراً — تمرير أفقي على الهاتف ═══ */}
          <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <h2 className="font-black flex items-center gap-2 text-base sm:text-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
                  <Table2 className="h-5 w-5" />
                </span>
                {t("rep.tableTitle")}
              </h2>
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      {[t("pay.month"), t("rep.sessionsPaid"), t("rep.ebooks"), t("rep.revenue"), t("rep.salaries"), t("rep.net")].map((h, i) => (
                        <th key={i} className="border-b border-border bg-muted/50 px-3 py-2 text-start text-xs font-black text-muted-foreground first:rounded-se-lg first:rounded-ss-lg last:rounded-ee-lg last:rounded-es-lg">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data!.series.map((r) => (
                      <tr key={r.month} className={r.month === data!.month ? "bg-primary/[0.06]" : undefined}>
                        <td className="border-b border-border/60 px-3 py-2.5 font-bold whitespace-nowrap">{monthName(r.month)}</td>
                        <td className="border-b border-border/60 px-3 py-2.5 tabular-nums whitespace-nowrap">{money(r.sessionsPaid)}</td>
                        <td className="border-b border-border/60 px-3 py-2.5 tabular-nums whitespace-nowrap">{money(r.ebooks)}</td>
                        <td className="border-b border-border/60 px-3 py-2.5 tabular-nums font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{money(r.revenue)}</td>
                        <td className="border-b border-border/60 px-3 py-2.5 tabular-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">{money(r.salaries)}</td>
                        <td className={"border-b border-border/60 px-3 py-2.5 tabular-nums font-black whitespace-nowrap " + (r.net >= 0 ? "text-primary" : "text-rose-600 dark:text-rose-400")}>
                          {money(r.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

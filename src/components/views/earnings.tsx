"use client";
/**
 * ★ v3.23 — أرباحي (للأخصائي فقط)
 * إحصائيات المستحقات الشهرية بناءً على الجلسات التي أتمّها فعلاً:
 *  — بطاقات: نسبته من الجلسة + جلرات الشهر الحالي + مستحقات الشهر + الإجمالي الكلي
 *  — رسم بياني لمستحقات آخر 6 أشهر
 *  — جدول شهري مفصّل (الجلسات، مجموع الجلرات، المستحقات)
 * المعادلة: المستحقات = (سعر الجلسة − الخصم) × النسبة — للجلسات المنتهية فقط،
 * والنسبة تضبطها الإدارة لكل أخصائي على حدة.
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { PageSkeleton } from "@/components/brand-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Info, Coins, Percent, CalendarCheck2, Wallet, PiggyBank, BarChart3, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { localeOf } from "@/components/tri-input";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { Navigate } from "@/lib/nav";

type MonthRow = { month: string; sessions: number; revenue: number; dues: number };
type Earnings = {
  rate: number;
  current: MonthRow;
  months: MonthRow[];
  totals: { sessions: number; revenue: number; dues: number };
  formula: string;
};

export default function Earnings({ navigate }: { navigate: Navigate }) {
  const { t, lang, me } = useApp();
  const [data, setData] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/earnings", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch {}
    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const money = (n: number) => `${(n || 0).toLocaleString(lang === "ar" ? "ar-DZ" : "fr-DZ")} ${lang === "ar" ? "دج" : "DA"}`;

  const monthName = (ym: string) => {
    try {
      const [y, m] = ym.split("-").map(Number);
      return new Date(y, (m || 1) - 1, 1).toLocaleDateString(localeOf(lang), { month: "long", year: "numeric" });
    } catch {
      return ym;
    }
  };

  /* ★ v3.23.1: اسم الشهر المختصر — ملصقات المحور الأفقي تبقى مضغوطة لا تتزاحم على الهاتف */
  const monthShort = (ym: string) => {
    try {
      const [y, m] = ym.split("-").map(Number);
      return new Date(y, (m || 1) - 1, 1).toLocaleDateString(localeOf(lang), { month: "short" });
    } catch {
      return ym;
    }
  };

  const cards: { icon: typeof Coins; label: string; value: string; cls?: string }[] = [
    {
      icon: Percent,
      label: t("earn.rate"),
      value: `${data?.rate ?? 0}%`,
      cls: "text-primary",
    },
    {
      icon: CalendarCheck2,
      label: t("earn.sessionsThisMonth"),
      value: String(data?.current?.sessions ?? "—"),
    },
    {
      icon: Wallet,
      label: t("earn.duesThisMonth"),
      value: money(data?.current?.dues || 0),
      cls: "text-emerald-600 dark:text-emerald-400",
    },
    {
      icon: PiggyBank,
      label: t("earn.duesTotal"),
      value: money(data?.totals?.dues || 0),
      cls: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <BackButton onBack={() => navigate("home")} />
          <h1 className="text-xl sm:text-2xl font-black break-words">{t("earn.title")}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={refreshing}
          className="ms-auto gap-1.5 rounded-full text-xs">
          <RefreshCw className={"h-3.5 w-3.5 " + (refreshing ? "animate-spin" : "")} />
          {t("dash.refresh")}
        </Button>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-primary/6 border border-primary/15 px-4 py-2.5 text-sm text-primary">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span className="leading-relaxed">{t("earn.note", { rate: data?.rate ?? me?.commissionRate ?? 0 })}</span>
      </p>

      {loading ? (
        <PageSkeleton kind="cards" count={4} label={t("common.loading")} />
      ) : !data ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">{t("common.error")}</CardContent>
        </Card>
      ) : (
        <>
          {/* النسبة صفر — لم تُضبط بعد */}
          {data.rate === 0 && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm font-semibold text-amber-800 dark:text-amber-300 break-words">
              {t("earn.noRate")}
            </p>
          )}

          {/* البطاقات */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label} className="ait-card rounded-3xl shadow-sm">
                <CardContent className="p-4 sm:p-5 space-y-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <c.icon className="h-5 w-5" />
                  </span>
                  <p className={"text-xl sm:text-2xl font-black tabular-nums break-all " + (c.cls || "")}>{c.value}</p>
                  <p className="text-xs sm:text-[13px] text-muted-foreground font-semibold leading-snug break-words">{c.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* رسم مستحقات آخر 6 أشهر */}
          <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <h2 className="font-black flex items-center gap-2 text-base sm:text-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <BarChart3 className="h-5 w-5" />
                </span>
                {t("earn.chartTitle")}
              </h2>
              <div className="h-64 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[...data.months].reverse().map((m) => ({ ...m, label: monthShort(m.month) }))}
                    margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b844" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                      formatter={(v: number | string) => [money(Number(v)), t("earn.dues")] as [string, string]}
                    />
                    <Bar dataKey="dues" name={t("earn.dues")} fill="#0f766e" radius={[6, 6, 0, 0]} barSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* الجدول الشهري المفصّل */}
          <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <h2 className="font-black flex items-center gap-2 text-base sm:text-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <Coins className="h-5 w-5" />
                </span>
                {t("earn.monthlyTitle")}
              </h2>
              <div className="space-y-2">
                {data.months.map((m) => (
                  /* ★ v3.23.1: اسم الشهر في سطر مستقل على الهاتف — لا ينضغط أبداً
                     إلى عمود أحرف (كان flex-1 بأساس صفر يسحقه أمام العناصر shrink-0) */
                  <div key={m.month} className="flex flex-col gap-2 rounded-2xl border bg-card p-3.5 sm:flex-row sm:items-center sm:gap-3">
                    <p className="text-sm font-bold break-words">{monthName(m.month)}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:ms-auto">
                      <Badge variant="secondary" className="rounded-full text-[11px]">
                        {t("earn.sessionsCount", { n: m.sessions })}
                      </Badge>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {t("earn.revenue")}: {money(m.revenue)}
                      </span>
                      <span className="text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                        {money(m.dues)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {/* الإجمالي الكلي */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary/85 px-4 py-3.5 text-primary-foreground shadow-md shadow-primary/20">
                <span className="flex items-center gap-2 font-black text-sm sm:text-base">
                  <PiggyBank className="h-5 w-5 shrink-0" />
                  {t("earn.grandTotal", { n: data.totals.sessions })}
                </span>
                <span className="text-lg sm:text-xl font-black tabular-nums break-all">{money(data.totals.dues)}</span>
              </div>
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                {data.formula}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

"use client";
/**
 * ★ v3.23 — الأجور والمستحقات (حساب الإدارة فقط)
 * الاحتساب التلقائي للأجور:
 *  — كل أخصائي: عدد الجلسات المنتهية في الشهر × نسبته (%) = مستحقاته (تلقائي من المواعيد)
 *  — المساعدة: راتب ثابت (قابل للتعديل) − أيام الغياب × قسط الخصم اليومي = الصافي
 * الإدارة تختار الشهر وتحرّر تسوية المساعدة وتحفظها لكل شهر على حدة،
 * مع حقل للراتب الثابت الافتراضي للمساعدة (يُستخدم لأشهر جديدة).
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
import { Info, Wallet, UsersRound, Percent, CalendarCheck2, PiggyBank, Banknote, Save, Landmark } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Navigate } from "@/lib/nav";

type SpecRow = {
  specialistId: string;
  name: string;
  photoBase64: string;
  rate: number;
  sessions: number;
  revenue: number;
  dues: number;
};
type Assistant = {
  base: number;
  absenceDays: number;
  deductionPerDay: number;
  deduction: number;
  net: number;
  note: string;
  saved: boolean;
};
type Payroll = {
  month: string;
  rows: SpecRow[];
  assistant: Assistant;
  totals: {
    specialistsDues: number;
    specialistsSessions: number;
    specialistsRevenue: number;
    assistantNet: number;
    grand: number;
  };
};

function currentYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Payroll({ navigate }: { navigate: Navigate }) {
  const { t, lang } = useApp();
  const [month, setMonth] = useState(currentYm());
  const [data, setData] = useState<Payroll | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  /* حقول تسوية المساعدة — تحرير محلي ثم حفظ */
  const [base, setBase] = useState(0);
  const [absenceDays, setAbsenceDays] = useState(0);
  const [deductionPerDay, setDeductionPerDay] = useState(0);
  const [note, setNote] = useState("");
  /* الراتب الثابت الافتراضي للمساعدة (الإعدادات) */
  const [defaultSalary, setDefaultSalary] = useState<number | null>(null);
  const [savingDefault, setSavingDefault] = useState(false);

  const load = useCallback(async (ym: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/payroll?month=${ym}`, { cache: "no-store" });
      if (r.ok) {
        const j: Payroll = await r.json();
        setData(j);
        setBase(j.assistant.base);
        setAbsenceDays(j.assistant.absenceDays);
        setDeductionPerDay(j.assistant.deductionPerDay);
        setNote(j.assistant.note || "");
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(month); }, [month, load]);

  /* الراتب الافتراضي من الإعدادات (مرة واحدة) */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/settings", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          setDefaultSalary(Math.max(0, Math.round(Number(j.settings?.assistantSalary) || 0)));
        }
      } catch {}
    })();
  }, []);

  const money = (n: number) => `${(n || 0).toLocaleString(lang === "ar" ? "ar-DZ" : "fr-DZ")} ${lang === "ar" ? "دج" : "DA"}`;
  const monthLabel = (ym: string) => {
    try {
      const [y, m] = ym.split("-").map(Number);
      return new Date(y, (m || 1) - 1, 1).toLocaleDateString(lang === "ar" ? "ar-DZ" : "fr-DZ", { month: "long", year: "numeric" });
    } catch {
      return ym;
    }
  };

  /* الخصم والصافي المحسوبان محلياً — يظهران حياً أثناء التحرير */
  const liveDeduction = Math.min(base, Math.max(0, Math.round(absenceDays) || 0) * Math.max(0, Math.round(deductionPerDay) || 0));
  const liveNet = Math.max(0, base - liveDeduction);

  const saveAssistant = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/payroll", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, assistantBase: base, absenceDays, deductionPerDay, note }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setData(j);
        toast.success(t("pay.saved"));
      } else toast.error(j.error || t("common.error"));
    } catch {
      toast.error(t("err.conn"));
    }
    setBusy(false);
  };

  const saveDefault = async () => {
    setSavingDefault(true);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantSalary: defaultSalary || 0 }),
      });
      if (r.ok) toast.success(t("pay.defaultSaved"));
      else toast.error(t("common.error"));
    } catch {
      toast.error(t("err.conn"));
    }
    setSavingDefault(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 min-w-0">
        <BackButton onBack={() => navigate("home")} />
        <h1 className="text-xl sm:text-2xl font-black break-words">{t("pay.title")}</h1>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-primary/6 border border-primary/15 px-4 py-2.5 text-sm text-primary">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span className="leading-relaxed">{t("pay.note")}</span>
      </p>

      {/* اختيار الشهر */}
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="pay-month" className="text-sm font-bold">{t("pay.month")}</Label>
        <Input
          id="pay-month"
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="h-11 w-44"
        />
        <Badge variant="secondary" className="rounded-full text-xs">{monthLabel(month)}</Badge>
        {data && !data.assistant.saved && (
          <Badge variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-400">
            {t("pay.usingDefaults")}
          </Badge>
        )}
      </div>

      {loading ? (
        <PageSkeleton kind="cards" count={4} label={t("common.loading")} />
      ) : !data ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">{t("common.error")}</CardContent>
        </Card>
      ) : (
        <>
          {/* ═══ مستحقات الأخصائيين — احتساب تلقائي ═══ */}
          <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-black flex items-center gap-2 text-base sm:text-lg">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <UsersRound className="h-5 w-5" />
                  </span>
                  {t("pay.specTitle")}
                </h2>
                <Badge variant="secondary" className="rounded-full text-[11px]">
                  {t("pay.autoBadge")}
                </Badge>
              </div>

              {data.rows.length === 0 ? (
                <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground text-center break-words">
                  {t("pay.noSpecs")}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.rows.map((r) => (
                    <div key={r.specialistId} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-card p-4">
                      <div className="min-w-0 flex-auto">
                        <p className="text-sm font-black break-words">{r.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/8 text-[11px] font-bold text-primary gap-1">
                            <Percent className="h-3 w-3" />
                            {t("pay.rate", { n: r.rate })}
                          </Badge>
                          <Badge variant="secondary" className="rounded-full text-[11px]">
                            <CalendarCheck2 className="h-3 w-3" />
                            {t("pay.sessionsDone", { n: r.sessions })}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {t("pay.sessionsRevenue")}: {money(r.revenue)}
                          </span>
                        </div>
                      </div>
                      <div className="text-end ms-auto">
                        <p className="text-[10px] font-bold text-muted-foreground">{t("pay.dues")}</p>
                        <p className="text-lg font-black tabular-nums text-emerald-600 dark:text-emerald-400 break-all">
                          {money(r.dues)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* إجمالي مستحقات الأخصائيين */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-black">
                  <Wallet className="h-4.5 w-4.5 text-primary" />
                  {t("pay.specTotal", { n: data.totals.specialistsSessions })}
                </span>
                <span className="text-lg font-black tabular-nums text-primary break-all">{money(data.totals.specialistsDues)}</span>
              </div>
            </CardContent>
          </Card>

          {/* ═══ راتب المساعدة — ثابت مع خصم الغياب ═══ */}
          <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-4">
              <h2 className="font-black flex items-center gap-2 text-base sm:text-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
                  <Banknote className="h-5 w-5" />
                </span>
                {t("pay.assistantTitle")}
              </h2>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pay-base" className="text-xs">{t("pay.assistantBase")}</Label>
                  <Input
                    id="pay-base"
                    type="number" min={0} step={500}
                    value={base}
                    onChange={(e) => setBase(Math.max(0, Number(e.target.value) || 0))}
                    className="h-11 tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-abs" className="text-xs">{t("pay.absenceDays")}</Label>
                  <Input
                    id="pay-abs"
                    type="number" min={0} max={31} step={1}
                    value={absenceDays}
                    onChange={(e) => setAbsenceDays(Math.max(0, Math.min(31, Number(e.target.value) || 0)))}
                    className="h-11 tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-perday" className="text-xs">{t("pay.deductionPerDay")}</Label>
                  <Input
                    id="pay-perday"
                    type="number" min={0} step={100}
                    value={deductionPerDay}
                    onChange={(e) => setDeductionPerDay(Math.max(0, Number(e.target.value) || 0))}
                    className="h-11 tabular-nums"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-note" className="text-xs">{t("pay.noteField")}</Label>
                <Input
                  id="pay-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("common.optional")}
                  className="h-11"
                  maxLength={300}
                />
              </div>

              {/* الخصم والصافي — حي */}
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-3">
                  <span className="text-sm font-bold text-rose-700 dark:text-rose-400">{t("pay.deduction")}</span>
                  <span className="text-base font-black tabular-nums text-rose-700 dark:text-rose-400 break-all">
                    − {money(liveDeduction)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-primary to-primary/85 px-4 py-3 text-primary-foreground shadow-md shadow-primary/20">
                  <span className="text-sm font-black">{t("pay.assistantNet")}</span>
                  <span className="text-lg font-black tabular-nums break-all">{money(liveNet)}</span>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{t("pay.assistantHint")}</p>

              <Button onClick={saveAssistant} disabled={busy} className="gap-2 rounded-xl shadow-md shadow-primary/20">
                <Save className="h-4 w-4" />
                {busy ? t("common.saving") : t("pay.saveMonth", { m: monthLabel(month) })}
              </Button>
            </CardContent>
          </Card>

          {/* ═══ الراتب الثابت الافتراضي للمساعدة ═══ */}
          <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <h2 className="font-black flex items-center gap-2 text-base sm:text-lg">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                  <PiggyBank className="h-5 w-5" />
                </span>
                {t("pay.defaultTitle")}
              </h2>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5 w-44">
                  <Label htmlFor="pay-default" className="text-xs">{t("pay.defaultLabel")}</Label>
                  <Input
                    id="pay-default"
                    type="number" min={0} step={500}
                    value={defaultSalary ?? ""}
                    onChange={(e) => setDefaultSalary(Math.max(0, Number(e.target.value) || 0))}
                    className="h-11 tabular-nums"
                  />
                </div>
                <Button variant="outline" onClick={saveDefault} disabled={savingDefault || defaultSalary === null}
                  className="h-11 gap-2 rounded-xl">
                  <Save className="h-4 w-4" />
                  {savingDefault ? t("common.saving") : t("common.save")}
                </Button>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{t("pay.defaultHint")}</p>
            </CardContent>
          </Card>

          {/* ═══ الإجمالي العام للشهر ═══ */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-gradient-to-r from-primary to-primary/85 px-5 py-4 text-primary-foreground shadow-lg shadow-primary/25">
            <span className="flex items-center gap-2 font-black text-sm sm:text-base">
              <Landmark className="h-5 w-5 shrink-0" />
              {t("pay.grandTotal")} — {monthLabel(month)}
            </span>
            <span className="text-xl sm:text-2xl font-black tabular-nums break-all">{money(data.totals.grand)}</span>
          </div>
          <p className={cn("text-[11px] text-muted-foreground leading-relaxed")}>{t("pay.grandBreakdown")}</p>
        </>
      )}
    </div>
  );
}

"use client";
/**
 * لوحة القيادة — إحصائيات المركز الحية للإدارة والمساعد
 * مواعيد بالحالة، جلسات عن بُعد/حضورية، الأداء، الملفات، البلاغات، طلبات الاستعادة
 * ★ v3.6: بطاقة المبالغ الشاملة — كل المبالغ في مكان واحد:
 *   الحجوزات (مدفوع/غير مدفوع/الإجمالي) + التكوينات المتوقعة + الخدمات المحجوزة
 *   + الإجمالي العام — تحديث تلقائي كل 45 ثانية وعند العودة للصفحة
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
} from "lucide-react";
import type { Navigate } from "@/lib/nav";

type Stats = { clients: number; specialists: number; remote: number; onsite: number; centerDays: number; languages: number };
type Dash = {
  pending: number; confirmed: number; completed: number; cancelled: number;
  unpaidSum: number; paidSum: number; unpaidCount: number; files: number; newFeedback: number; resets: number;
  /* v3.6 — بطاقة المبالغ الشاملة */
  coursesExpected?: number; coursesEnrolled?: number;
  servicesPaid?: number; servicesUnpaid?: number; servicesCount?: number; grandTotal?: number;
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

  /* بطاقة المبالغ الشاملة (v3.6) — صف: أيقونة، تسمية، قيمة */
  const amountRows: { icon: typeof PiggyBank; label: string; value: string; cls?: string }[] = [
    { icon: PiggyBank, label: t("dash.amtPaid"), value: money(dash?.paidSum || 0), cls: "text-emerald-600 dark:text-emerald-400" },
    { icon: Wallet, label: t("dash.amtUnpaid"), value: `${money(dash?.unpaidSum || 0)} (${dash?.unpaidCount ?? 0})`, cls: "text-amber-600 dark:text-amber-400" },
    { icon: Banknote, label: t("dash.amtBookingsTotal"), value: money((dash?.paidSum || 0) + (dash?.unpaidSum || 0)) },
    { icon: GraduationCap, label: t("dash.amtCourses"), value: `${money(dash?.coursesExpected || 0)} (${dash?.coursesEnrolled ?? 0})`, cls: "text-sky-600 dark:text-sky-400" },
    { icon: Sparkles, label: t("dash.amtServicesPaid"), value: money(dash?.servicesPaid || 0), cls: "text-emerald-600 dark:text-emerald-400" },
    { icon: Sparkles, label: t("dash.amtServicesUnpaid"), value: money(dash?.servicesUnpaid || 0), cls: "text-amber-600 dark:text-amber-400" },
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
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
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
    </div>
  );
}

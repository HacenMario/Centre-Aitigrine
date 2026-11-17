"use client";
/**
 * ★ v3.23/v3.24 — لوحة تقويم المواعيد للأخصائي (Calendar Sync)
 * ترقية صفحة «مواعيدي» إلى لوحة تحكم كاملة:
 *  — عرض شهري: شبكة الشهر مع نقاط ملوّنة بحالة كل يوم (قيد الانتظار/مؤكد/منتهي/ملغي)
 *    والنقر على أي يوم يفتح أجندته
 *  — عرض أسبوعي: أعمدة الأيام السبعة بمواعيد كل يوم (مكدسة على الهاتف)
 *  — عرض يومي: أجندة اليوم بأكملها مع إجراءات الحالة (تأكيد/إنهاء/إلغاء)
 * ★ v3.24: بطاقة الأجندة اليومية بتفاصيل أعمق لكل موعد — نوع الخدمة، هاتف العميل
 *   (اتصال بنقرة)، سن العميل وجنسه — نظرة مسبقة قبل الجلسة. تجاوب كامل وRTL/LTR.
 */
import { useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, CircleCheckBig,
  CalendarDays, UserRound, Tag, Clock, Phone, Cake,
} from "lucide-react";
import { toast } from "sonner";
import { pickTri } from "@/components/tri-input";
import { localeOf } from "@/components/tri-input";
import { cn } from "@/lib/utils";

export type CalAppt = {
  _id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: string;
  clientName?: string;
  serviceTitle?: string;
  serviceTitleFr?: string;
  serviceTitleEn?: string;
  notes?: string;
  /* ★ v3.24: تفاصيل العميل في بطاقة اليوم */
  clientPhone?: string;
  clientAge?: number | null;
  clientGender?: string | null;
};

/* أسماء الأيام حسب اللغة (0 = الأحد) — نفس ترتيب صفحة المواعيد */
const DAYS_BY_LANG: Record<string, string[]> = {
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  tr: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
  es: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseYmd(s: string): Date {
  return new Date(`${s}T00:00:00`);
}

/* ألوان الحالات — نقاط وشرائط موحّدة مع شارات القائمة */
const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-emerald-500",
  completed: "bg-sky-500",
  cancelled: "bg-rose-500",
};
const STATUS_RING: Record<string, string> = {
  pending: "border-amber-400/60 bg-amber-500/[0.07]",
  confirmed: "border-emerald-400/60 bg-emerald-500/[0.07]",
  completed: "border-sky-400/60 bg-sky-500/[0.07]",
  cancelled: "border-rose-300/50 bg-rose-500/[0.05] opacity-70",
};

export default function ApptCalendar({ appts, onReload }: { appts: CalAppt[]; onReload: () => void }) {
  const { t, lang, dir } = useApp();
  const DAYS = DAYS_BY_LANG[lang] || DAYS_BY_LANG.ar;
  const [mode, setMode] = useState<"month" | "week" | "day">("month");
  const [anchor, setAnchor] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [selected, setSelected] = useState<string>(() => ymd(new Date()));
  const [busyId, setBusyId] = useState("");

  const PrevIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const NextIcon = dir === "rtl" ? ChevronLeft : ChevronRight;
  const today = ymd(new Date());

  /* فهرس المواعيد حسب التاريخ */
  const byDate = useMemo(() => {
    const m = new Map<string, CalAppt[]>();
    for (const a of appts) {
      const k = a.date;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    for (const list of m.values()) list.sort((a, b) => a.time.localeCompare(b.time));
    return m;
  }, [appts]);

  const monthLabel = useMemo(() => {
    try {
      return anchor.toLocaleDateString(localeOf(lang), { month: "long", year: "numeric" });
    } catch {
      return `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}`;
    }
  }, [anchor, lang]);

  const weekLabel = useMemo(() => {
    const start = new Date(anchor); start.setDate(start.getDate() - start.getDay());
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => {
      try { return d.toLocaleDateString(localeOf(lang), { day: "numeric", month: "short" }); }
      catch { return ymd(d); }
    };
    return `${fmt(start)} — ${fmt(end)}`;
  }, [anchor, lang]);

  const dayLabel = (s: string) => {
    const d = parseYmd(s);
    try { return d.toLocaleDateString(localeOf(lang), { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
    catch { return s; }
  };

  const shiftMonth = (n: number) => {
    const d = new Date(anchor);
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    setAnchor(d);
  };
  const shiftWeek = (n: number) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + n * 7);
    setAnchor(d);
  };
  const shiftDay = (n: number) => {
    const d = parseYmd(selected);
    d.setDate(d.getDate() + n);
    setSelected(ymd(d));
    setAnchor(d);
  };
  const goToday = () => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    setAnchor(d);
    setSelected(ymd(d));
  };

  /* شبكة الشهر — تبدأ من الأحد (0) متسقة مع ترتيب DAYS */
  const monthCells = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    const lead = first.getDay();
    const cells: { date: string; day: number }[] = [];
    for (let i = 0; i < lead; i++) cells.push({ date: "", day: 0 });
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ date: ymd(new Date(anchor.getFullYear(), anchor.getMonth(), i)), day: i });
    }
    return cells;
  }, [anchor]);

  const weekDays = useMemo(() => {
    const start = new Date(anchor); start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i);
      return ymd(d);
    });
  }, [anchor]);

  const dayAppts = byDate.get(selected) || [];

  /* تغيير حالة الموعد من التقويم */
  const setStatus = async (id: string, status: string) => {
    setBusyId(id);
    try {
      const r = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (r.ok) {
        toast.success(status === "confirmed" ? t("appt.confirmed") : status === "completed" ? t("appt.completed") : t("appt.cancelled"));
        onReload();
      } else toast.error(t("common.error"));
    } catch {
      toast.error(t("err.conn"));
    }
    setBusyId("");
  };

  /* بطاقة موعد داخل الأجندة اليومية */
  const AgendaCard = ({ a }: { a: CalAppt }) => (
    <Card className={cn("rounded-2xl border shadow-sm", STATUS_RING[a.status] || "border")}>
      <CardContent className="flex flex-col gap-2.5 p-3.5 sm:flex-row sm:items-center sm:gap-3">
        <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/8 text-primary">
          <Clock className="h-4 w-4" />
          <span className="text-[13px] font-black tabular-nums leading-none" dir="ltr">{a.time}</span>
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-bold break-words">
            <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {a.clientName || "—"}
          </p>
          {!!pickTri(a as unknown as Record<string, unknown>, "serviceTitle", lang) && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground break-words">
              <Tag className="h-3 w-3 shrink-0" />
              {pickTri(a as unknown as Record<string, unknown>, "serviceTitle", lang)}
            </p>
          )}
          {/* ★ v3.24: تفاصيل العميل — هاتف (اتصال بنقرة) + سن + جنس — تلتف بأمان على الهاتف */}
          {(a.clientPhone || (a.clientAge ?? null) !== null || a.clientGender) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {a.clientPhone && (
                <a href={`tel:${a.clientPhone}`} dir="ltr"
                  className="flex items-center gap-1 font-bold text-primary hover:underline">
                  <Phone className="h-3 w-3 shrink-0" /> {a.clientPhone}
                </a>
              )}
              {(a.clientAge ?? null) !== null && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Cake className="h-3 w-3 shrink-0" />
                  <span className="tabular-nums">{t("cld.years", { n: a.clientAge as number })}</span>
                </span>
              )}
              {a.clientGender && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <UserRound className="h-3 w-3 shrink-0" />
                  {a.clientGender === "male" ? t("cld.male") : t("cld.female")}
                </span>
              )}
            </div>
          )}
          {a.notes && <p className="text-[11px] text-muted-foreground break-words">{a.notes}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          {a.status === "pending" && (
            <Button size="sm" variant="outline" disabled={busyId === a._id}
              className="h-8 gap-1.5 rounded-lg text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400"
              onClick={() => setStatus(a._id, "confirmed")}>
              <CheckCircle2 className="h-3.5 w-3.5" /> {t("appt.confirmed")}
            </Button>
          )}
          {a.status === "confirmed" && (
            <Button size="sm" variant="outline" disabled={busyId === a._id}
              className="h-8 gap-1.5 rounded-lg text-sky-600 border-sky-200 hover:bg-sky-50 dark:text-sky-400"
              onClick={() => setStatus(a._id, "completed")}>
              <CircleCheckBig className="h-3.5 w-3.5" /> {t("appt.completed")}
            </Button>
          )}
          {["pending", "confirmed"].includes(a.status) && (
            <Button size="sm" variant="outline" disabled={busyId === a._id}
              className="h-8 gap-1.5 rounded-lg text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400"
              onClick={() => setStatus(a._id, "cancelled")}>
              <XCircle className="h-3.5 w-3.5" /> {t("appt.cancelled")}
            </Button>
          )}
          {["completed", "cancelled"].includes(a.status) && (
            <Badge variant="outline" className={cn(
              "border",
              a.status === "completed"
                ? "bg-sky-500/12 text-sky-700 dark:text-sky-400 border-sky-500/25"
                : "bg-rose-500/12 text-rose-700 dark:text-rose-400 border-rose-500/25"
            )}>
              {a.status === "completed" ? t("appt.completed") : t("appt.cancelled")}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3">
      {/* شريط التحكم: النمط + التنقل */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="h-10">
            <TabsTrigger value="month" className="gap-1.5 text-xs px-3"><CalendarDays className="h-3.5 w-3.5" />{t("appt.calMonth")}</TabsTrigger>
            <TabsTrigger value="week" className="gap-1.5 text-xs px-3">{t("appt.calWeek")}</TabsTrigger>
            <TabsTrigger value="day" className="gap-1.5 text-xs px-3">{t("appt.calDay")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" aria-label={t("common.back")}
            onClick={() => (mode === "month" ? shiftMonth(-1) : mode === "week" ? shiftWeek(-1) : shiftDay(-1))}>
            <PrevIcon className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-9 rounded-xl px-3 text-xs font-bold" onClick={goToday}>
            {t("appt.calToday")}
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" aria-label={t("common.next")}
            onClick={() => (mode === "month" ? shiftMonth(1) : mode === "week" ? shiftWeek(1) : shiftDay(1))}>
            <NextIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* عنوان الفترة */}
      <p className="text-sm font-black text-primary break-words">
        {mode === "month" ? monthLabel : mode === "week" ? weekLabel : dayLabel(selected)}
      </p>

      {/* ═══ العرض الشهري ═══ */}
      {mode === "month" && (
        <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
          <CardContent className="p-3 sm:p-4 space-y-2">
            {/* مفتاح الألوان */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px] font-bold text-muted-foreground">
              {(["pending", "confirmed", "completed", "cancelled"] as const).map((s) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[s])} />
                  {t(`appt.${s}`)}
                </span>
              ))}
            </div>
            {/* رؤوس الأيام */}
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((d) => (
                <div key={d} className="pb-1 text-center text-[10px] sm:text-[11px] font-black text-muted-foreground truncate">{d}</div>
              ))}
            </div>
            {/* شبكة الأيام */}
            <div className="grid grid-cols-7 gap-1">
              {monthCells.map((c, i) =>
                !c.date ? (
                  <div key={`e${i}`} className="min-h-14 rounded-xl bg-muted/30 sm:min-h-16" />
                ) : (
                  (() => {
                    const list = byDate.get(c.date) || [];
                    const counts: Record<string, number> = {};
                    for (const a of list) counts[a.status] = (counts[a.status] || 0) + 1;
                    const active = selected === c.date;
                    return (
                      <button
                        key={c.date}
                        type="button"
                        onClick={() => { setSelected(c.date); setMode("day"); }}
                        aria-label={`${c.date} — ${list.length}`}
                        className={cn(
                          "group flex min-h-14 flex-col items-center gap-1 rounded-xl border p-1 text-center transition-all sm:min-h-16",
                          active
                            ? "border-primary bg-primary/10 shadow-sm"
                            : list.length > 0
                              ? "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
                              : "border-transparent bg-muted/30 hover:bg-muted/60"
                        )}
                      >
                        <span className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-[11px] sm:text-xs font-black tabular-nums",
                          c.date === today ? "bg-primary text-primary-foreground shadow-sm" : active ? "text-primary" : "text-foreground/80"
                        )}>
                          {c.day}
                        </span>
                        {/* نقاط الحالات — حتى 4 نقاط بأعدادها */}
                        {list.length > 0 && (
                          <span className="flex flex-wrap items-center justify-center gap-0.5">
                            {(["pending", "confirmed", "completed", "cancelled"] as const).map((s) =>
                              counts[s] ? (
                                <span key={s} className={cn(
                                  "flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] font-black text-white",
                                  STATUS_DOT[s]
                                )}>
                                  {counts[s]}
                                </span>
                              ) : null
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })()
                )
              )}
            </div>
            {byDate.size === 0 && (
              <p className="pt-2 text-center text-sm text-muted-foreground">{t("appt.calNoAppts")}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ العرض الأسبوعي ═══ */}
      {mode === "week" && (
        <div className="grid gap-2 lg:grid-cols-7">
          {weekDays.map((d) => {
            const list = byDate.get(d) || [];
            const isToday = d === today;
            return (
              <div key={d} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => { setSelected(d); setMode("day"); }}
                  className={cn(
                    "flex w-full items-center justify-between gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-black transition-colors",
                    isToday ? "border-primary bg-primary/10 text-primary" : "bg-card text-foreground/80 hover:border-primary/40"
                  )}
                >
                  <span className="truncate">{DAYS[parseYmd(d).getDay()]}</span>
                  <span className="tabular-nums text-[11px]">{d.slice(8, 10)}/{d.slice(5, 7)}</span>
                </button>
                {list.length === 0 ? (
                  <div className="rounded-xl bg-muted/30 px-2 py-2 text-center text-[10px] text-muted-foreground">—</div>
                ) : (
                  list.map((a) => (
                    <div key={a._id} className={cn("rounded-xl border px-2 py-1.5", STATUS_RING[a.status] || "border")}>
                      <p className="text-[11px] font-black tabular-nums text-foreground/80" dir="ltr">{a.time}</p>
                      <p className="truncate text-[11px] font-bold">{a.clientName || "—"}</p>
                      <span className="mt-1 flex items-center gap-1">
                        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[a.status])} />
                        <span className="text-[9px] font-bold text-muted-foreground">{t(`appt.${a.status}`)}</span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ العرض اليومي — أجندة اليوم ═══ */}
      {mode === "day" && (
        <div className="space-y-2">
          {dayAppts.length === 0 ? (
            <Card className="rounded-3xl border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {t("appt.calNoAppts")}
              </CardContent>
            </Card>
          ) : (
            dayAppts.map((a) => <AgendaCard key={a._id} a={a} />)
          )}
        </div>
      )}
    </div>
  );
}

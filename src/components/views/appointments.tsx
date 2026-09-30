"use client";
/**
 * مواعيدي — لكل الأدوار
 * العميل: حجز جديد (أخصائي ← يوم ← وقت بالنقر من أوقاته المحفوظة) + إلغاء
 * الأخصائي: جلساته + تأكيد/إنهاء/إلغاء + تغيير وقت الموعد مع إشعار العميل ★ v3.12
 * الإدارة: كل مواعيد المركز + إدارة الحالات + حجز لعميل + تغيير الأوقات
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { PageSkeleton } from "@/components/brand-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarClock, Plus, Trash2, CheckCircle2, XCircle, CircleCheckBig, Info, UserRound, Star, Banknote, Coins, CalendarPlus, FileDown } from "lucide-react";
import { toast } from "sonner";
import RatingsDialog from "@/components/ratings-dialog";
import Pagination from "@/components/pagination";
import { pickTri } from "@/components/tri-input";
import { cn } from "@/lib/utils";
import type { Navigate } from "@/lib/nav";

const PAGE_SIZE = 12;

type Appt = {
  _id: string; clientId: string; specialistId: string; clientName?: string; specialistName?: string;
  serviceTitle: string; serviceTitleFr?: string; serviceTitleEn?: string;
  kind: string; date: string; time: string; status: string; notes: string;
  price?: number; paymentStatus?: string;
};
type Account = { _id: string; name: string; role: string; specialty?: string; title?: string; titleFr?: string; titleEn?: string; photoBase64?: string; weeklyHours?: Record<string, string[]>; services?: SpecService[]; active: boolean };
type ServiceItem = { _id: string; title: string; titleFr?: string; titleEn?: string; kind?: string; price?: number };
/* ★ v3.12: خدمة من خدمات الأخصائي المرتبطة (من /api/specialists) */
type SpecService = { _id: string; title: string; titleFr?: string; titleEn?: string; icon?: string; price?: number; durationMin?: number };

/* أسماء الأيام حسب اللغة — الحجز والتواريخ تظهر دائماً بلغة المستخدم (خمس لغات ★ v3.12) */
const DAYS_BY_LANG: Record<string, string[]> = {
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  tr: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
  es: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ★ v3.8: إضافة الموعد للتقويم — قائمة: Google Calendar + ملف iCal */
function AddToCalendar({ label, title, date, time, apptId }: {
  label: string; title: string; date: string; time: string; apptId: string;
}) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);

  const gcalUrl = () => {
    const [y, m, d] = date.split("-");
    const [hh, mm] = time.split(":");
    const pad = (n: string | number) => String(n).padStart(2, "0");
    let endH = Number(hh) + 1;
    let endD = Number(d);
    if (endH >= 24) { endH -= 24; endD += 1; }
    const start = `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`;
    const end = `${y}${pad(m)}${pad(endD)}T${pad(endH)}${pad(mm)}00`;
    const url = new URL("https://calendar.google.com/calendar/render");
    url.searchParams.set("action", "TEMPLATE");
    url.searchParams.set("text", title);
    url.searchParams.set("dates", `${start}/${end}`);
    url.searchParams.set("details", "Centre Aitigrine — مركز آيت تقرين");
    return url.toString();
  };

  const downloadIcs = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/calendar?id=${apptId}`);
      if (!r.ok) { toast.error(t("common.error")); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      el.href = url;
      el.download = `appointment-${date}-${time.replace(":", "-")}.ics`;
      el.click();
      URL.revokeObjectURL(url);
    } catch { toast.error(t("err.conn")); }
    setBusy(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <CalendarPlus className="h-4 w-4" /> {label}
        </Button>
      </DropdownMenuTrigger>
      {/* ★ v3.9.0: قائمة منبثقة بالنقر تعمل باللمس على الهاتف — تعبر الحواف تلقائياً (Radix) */}
      <DropdownMenuContent align="end" sideOffset={6} className="rounded-2xl min-w-48">
        <DropdownMenuItem asChild>
          <a
            href={gcalUrl()}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs font-semibold cursor-pointer"
          >
            <CalendarPlus className="h-3.5 w-3.5 text-primary" /> Google Calendar
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => downloadIcs()}
          disabled={busy}
          className="flex items-center gap-2 text-xs font-semibold cursor-pointer"
        >
          <FileDown className="h-3.5 w-3.5 text-primary" /> Apple / Outlook (.ics)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function statusBadge(s: string, t: (k: string) => string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: t("appt.pending"), cls: "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/25" },
    confirmed: { label: t("appt.confirmed"), cls: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/25" },
    completed: { label: t("appt.completed"), cls: "bg-sky-500/12 text-sky-700 dark:text-sky-400 border-sky-500/25" },
    cancelled: { label: t("appt.cancelled"), cls: "bg-rose-500/12 text-rose-700 dark:text-rose-400 border-rose-500/25" },
  };
  const v = map[s] || map.pending;
  return <Badge variant="outline" className={cn("border", v.cls)}>{v.label}</Badge>;
}

export default function Appointments({ navigate }: { navigate: Navigate }) {
  const { t, me, lang, viewId } = useApp();
  const DAYS = DAYS_BY_LANG[lang] || DAYS_BY_LANG.ar;
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [rateFor, setRateFor] = useState<{ id: string; name: string } | null>(null);
  /* ★ v3.12: تغيير وقت الموعد — للأخصائي صاحب الموعد وللإدارة */
  const [reschedFor, setReschedFor] = useState<Appt | null>(null);
  /* ترقيم الصفحات — الحالة قبل أي عائد مبكر (قواعد الـ hooks) */
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/appointments", { cache: "no-store" });
      const j = await r.json();
      setAppts(j.appointments || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (me) load();
    else setLoading(false);
  }, [me, load]);

  /* ترقيم الصفحات الاحترافي — قوائم المواعيد طويلة */
  useEffect(() => { setPage(1); }, [appts.length]);
  const pageCount = Math.max(1, Math.ceil(appts.length / PAGE_SIZE));
  const pageAppts = appts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ★ v3.6: قادم من إشعار — تمييز الموعد المقصود والتمرير إليه:
     الرابط يحمل معرّف الموعد (appointments:ID) فننتقل لصفحته ونبرزه */
  useEffect(() => {
    if (!viewId || appts.length === 0) return;
    const idx = appts.findIndex((a) => String(a._id) === viewId);
    if (idx === -1) return;
    setPage(Math.floor(idx / PAGE_SIZE) + 1);
    /* مهلة قصيرة ليُركَّب DOM الصفحة الصحيحة قبل التمرير */
    const tm = setTimeout(() => {
      try {
        document.getElementById(`apt-${viewId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {}
    }, 150);
    return () => clearTimeout(tm);
  }, [viewId, appts]);

  if (!me) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <CalendarClock className="mx-auto h-14 w-14 text-muted-foreground/40" />
        <p className="text-muted-foreground">{t("appt.loginHint")}</p>
        <Button onClick={() => navigate("login")}>{t("common.login")}</Button>
      </div>
    );
  }

  const isStaff = me.role === "admin" || me.role === "assistant";
  /* ★ v3.8.1: الفاتورة للإدارة والأخصائي فقط (دون المساعد ولا العميل) */
  const isStaffSpecialist = me.role === "admin" || me.role === "specialist";

  /* ★ v3.5: تحديد سعر الجلسة وحالة الأداء — المبالغ تُحدّث لوحة القيادة */
  const patchPayment = async (id: string, patch: { price?: number; paymentStatus?: string }) => {
    const r = await fetch(`/api/appointments/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (r.ok) {
      toast.success(t("appt.paymentSaved"));
      load();
    } else toast.error(t("common.error"));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <BackButton onBack={() => navigate("home")} />
          <h1 className="text-xl sm:text-2xl font-black break-words">
            {isStaff ? t("appt.centerAppointments") : t("appt.myAppointments")}
          </h1>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2 rounded-xl shadow-md shadow-primary/20">
          <Plus className="h-4.5 w-4.5" />
          {isStaff ? t("appt.bookFor") : t("appt.bookNew")}
        </Button>
      </div>

      <p className="flex items-center gap-2 rounded-xl bg-primary/6 border border-primary/15 px-4 py-2.5 text-sm text-primary">
        <Info className="h-4 w-4 shrink-0" />
        {t("appt.reminderNote")}
      </p>

      {loading ? (
        <PageSkeleton kind="rows" count={4} label={t("common.loading")} />
      ) : appts.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-14 text-center text-muted-foreground">
            {t("appt.noAppointments")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {pageAppts.map((a) => (
            <Card
              key={a._id}
              id={`apt-${a._id}`}
              className={cn(
                "rounded-2xl shadow-sm hover:shadow-md transition-shadow",
                viewId === a._id && "ring-2 ring-primary bg-primary/[0.04] shadow-lg shadow-primary/10"
              )}
            >
              {/* ★ v3.9.0: بطاقة عمودية — صف المعلومات ثم شريط أزرار بعرض كامل
                  يلتف على سطر أو سطرين بشكل منظم دون نصوص عمودية أو ضغط */}
              <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary/8 text-primary">
                  <span className="text-[11px] font-bold">{DAYS[new Date(a.date + "T00:00:00").getDay()]}</span>
                  <span className="text-lg font-black tabular-nums leading-none">{a.date.slice(8, 10)}/{a.date.slice(5, 7)}</span>
                  <span className="text-[11px] font-bold tabular-nums">{a.time}</span>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-bold text-sm sm:text-base break-words">
                    {me.role === "client" ? a.specialistName : a.clientName}
                    <span className="text-muted-foreground font-normal text-sm"> — {pickTri(a as unknown as Record<string, unknown>, "serviceTitle", lang) || t(`roles.${me.role === "client" ? "specialist" : "client"}`)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {a.date} · {a.time}
                  </p>
                  {a.notes && <p className="text-xs text-muted-foreground break-words">{a.notes}</p>}
                  {/* ★ v3.5: المبلغ وحالة الأداء — الإدارة تحدّدهما مباشرة من البطاقة */}
                  {isStaff && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Coins className="h-3.5 w-3.5 text-amber-500" />
                      <Input
                        type="number" min={0} step={10}
                        defaultValue={a.price ?? 0}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (!isNaN(v) && v >= 0 && v !== (a.price ?? 0)) patchPayment(a._id, { price: v });
                        }}
                        className="h-8 w-24 text-center tabular-nums"
                        aria-label={t("appt.setPrice")}
                      />
                      <span className="text-[11px] font-semibold text-muted-foreground">{lang === "ar" ? "دج" : "DA"}</span>
                      <button
                        type="button"
                        onClick={() => patchPayment(a._id, { paymentStatus: a.paymentStatus === "paid" ? "unpaid" : "paid" })}
                        className={cn(
                          "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors",
                          a.paymentStatus === "paid"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        )}
                      >
                        <Banknote className="h-3.5 w-3.5" />
                        {a.paymentStatus === "paid" ? t("appt.paid") : t("appt.unpaid")}
                      </button>
                    </div>
                  )}
                </div>
                </div>
                {/* شريط الحالة والأزرار — بعرض كامل تحت المعلومات، يلتف بشكل منظم */}
                <div className="flex items-center gap-2 flex-wrap w-full">
                  {statusBadge(a.status, t)}
                  {/* أزرار الحالة */}
                  {me.role === "client" && a.status === "pending" && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                      onClick={async () => {
                        const r = await fetch(`/api/appointments/${a._id}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "cancelled" }),
                        });
                        if (r.ok) { toast.success(t("appt.cancelled")); load(); }
                      }}>
                      <XCircle className="h-4 w-4" /> {t("appt.cancelled")}
                    </Button>
                  )}
                  {(me.role === "specialist" || isStaff) && a.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        onClick={async () => {
                          const r = await fetch(`/api/appointments/${a._id}`, {
                            method: "PATCH", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "confirmed" }),
                          });
                          if (r.ok) { toast.success(t("appt.confirmed")); load(); }
                        }}>
                        <CheckCircle2 className="h-4 w-4" /> {t("appt.confirmed")}
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                        onClick={async () => {
                          const r = await fetch(`/api/appointments/${a._id}`, {
                            method: "PATCH", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "cancelled" }),
                          });
                          if (r.ok) { toast.success(t("appt.cancelled")); load(); }
                        }}>
                        <XCircle className="h-4 w-4" /> {t("appt.cancelled")}
                      </Button>
                    </>
                  )}
                  {(me.role === "specialist" || isStaff) && a.status === "confirmed" && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-sky-600 border-sky-200 hover:bg-sky-50"
                      onClick={async () => {
                        const r = await fetch(`/api/appointments/${a._id}`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "completed" }),
                        });
                        if (r.ok) { toast.success(t("appt.completed")); load(); }
                      }}>
                      <CircleCheckBig className="h-4 w-4" /> {t("appt.completed")}
                    </Button>
                  )}
                  {me.role === "client" && a.status === "completed" && (
                    <Button size="sm" variant="outline" className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:text-amber-400"
                      onClick={() => setRateFor({ id: (a as unknown as { specialistId?: string }).specialistId || "", name: a.specialistName || "—" })}>
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {t("rate.button")}
                    </Button>
                  )}
                  {/* ★ v3.12: تغيير وقت الموعد — للأخصائي صاحب الموعد وللإدارة، مع إشعار العميل */}
                  {(me.role === "specialist" || isStaff) && ["pending", "confirmed"].includes(a.status) && (
                    <Button size="sm" variant="outline" className="gap-1.5"
                      onClick={() => setReschedFor(a)}>
                      <CalendarClock className="h-4 w-4" /> {t("appt.changeTime")}
                    </Button>
                  )}
                  {/* ★ v3.8: إضافة الموعد للتقويم — Google Calendar أو ملف iCal */}
                  {["confirmed", "completed"].includes(a.status) && (me.role === "client" || isStaff) && (
                    <AddToCalendar
                      label={t("appt.addToCalendar")}
                      title={pickTri(a as unknown as Record<string, unknown>, "serviceTitle", lang) || t("nav.appointments")}
                      date={a.date}
                      time={a.time}
                      apptId={a._id}
                    />
                  )}
                  {/* ★ v3.8: فاتورة PDF — للجلسات المنتهية أو المدفوعة · v3.8.1: للإدارة والأخصائي فقط */}
                  {isStaffSpecialist && (a.status === "completed" || a.paymentStatus === "paid") && (
                    <Button size="sm" variant="outline" className="gap-1.5"
                      onClick={async () => {
                        try {
                          toast.info(t("invoice.preparing"));
                          const r = await fetch(`/api/invoices?id=${a._id}`);
                          if (!r.ok) { toast.error(t("common.error")); return; }
                          const blob = await r.blob();
                          const url = URL.createObjectURL(blob);
                          const el = document.createElement("a");
                          el.href = url;
                          el.download = `invoice-${a.date}.pdf`;
                          el.click();
                          URL.revokeObjectURL(url);
                          toast.success(t("invoice.downloaded"));
                        } catch { toast.error(t("err.conn")); }
                      }}>
                      <FileDown className="h-4 w-4" /> {t("invoice.button")}
                    </Button>
                  )}
                  {isStaff && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label={t("common.delete")}
                      onClick={() => setDelId(a._id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} onPage={setPage} total={appts.length} pageSize={PAGE_SIZE} />

      <BookingDialog open={open} onClose={() => { setOpen(false); load(); }} />
      {/* ★ v3.12: نافذة تغيير وقت الموعد */}
      <RescheduleDialog open={!!reschedFor} appt={reschedFor} onClose={() => { setReschedFor(null); load(); }} />
      {rateFor && (
        <RatingsDialog
          specialistId={rateFor.id}
          specialistName={rateFor.name}
          open={!!rateFor}
          onOpenChange={(v) => !v && setRateFor(null)}
        />
      )}
      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("appt.deleteNote")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                const r = await fetch(`/api/appointments/${delId}`, { method: "DELETE" });
                if (r.ok) { toast.success(t("toast.appointmentDeleted")); setDelId(null); load(); }
              }}>
              {t("common.yes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ───────────────── نافذة الحجز (نمط طمأنينة) ─────────────────
 * خطوة ١: اختيار الأخصائي — خطوة ٢: اليوم والتوقيت — خطوة ٣: التأكيد
 * الأوقات المعروضة = ساعات الأخصائي الفعلية لذلك اليوم، المحجوز والماضي معطّل
 */
function BookingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, me, lang } = useApp();
  const DAYS = DAYS_BY_LANG[lang] || DAYS_BY_LANG.ar;
  const isStaff = me?.role === "admin" || me?.role === "assistant";
  const [step, setStep] = useState(1);

  const [specialists, setSpecialists] = useState<Account[]>([]);
  const [clients, setClients] = useState<Account[]>([]);
  const [specId, setSpecId] = useState("");
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [taken, setTaken] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  /* ★ v3.8: الكوبون — إدخال + تحقق + خصم معروض فورياً */
  const [couponInput, setCouponInput] = useState("");
  const [couponInfo, setCouponInfo] = useState<{ code: string; discount: number } | null>(null);
  const [couponErr, setCouponErr] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);

  const reset = () => {
    setStep(1);
    setSpecId(""); setClientId(""); setServiceId(""); setDate(""); setTime(""); setNotes("");
    setTaken([]);
    setCouponInput(""); setCouponInfo(null); setCouponErr("");
  };

  useEffect(() => {
    if (!open) return;
    reset();
    (async () => {
      /* قائمة الأخصائيين من نقطة النهاية العامة (تعمل للعميل والضيف — نمط طمأنينة) */
      try {
        const sr = await fetch("/api/specialists", { cache: "no-store" });
        const sj = await sr.json();
        setSpecialists(sj.specialists || []);
      } catch {}
      if (isStaff) {
        try {
          const cr = await fetch("/api/accounts?role=client");
          const cj = await cr.json();
          setClients((cj.users || []).filter((u: Account) => u.active));
        } catch {}
      }
    })();
  }, [open, isStaff]);

  const spec = useMemo(() => specialists.find((s) => s._id === specId), [specId, specialists]);
  /* ★ v3.12: خدمات الأخصائي المختار حصراً — يختار العميل من بينها لا من كل خدمات العيادة */
  const specServices: SpecService[] = spec?.services || [];
  const specTitle = (s: Account) =>
    pickTri(s as unknown as Record<string, unknown>, "title", lang) ||
    (s.specialty === "art_therapy" ? t("specialty.art_therapy") : s.specialty === "both" ? t("specialty.both") : t("specialty.psychological"));
  const svcTitle = (s: SpecService) => pickTri(s as unknown as Record<string, unknown>, "title", lang) || s.title;

  /* ★ v3.12: أوقات الأخصائي المحفوظة حصراً لليوم المختار —
   * أوقات العيادة العامة لا تطغى أبداً: اليوم بلا أوقات محفوظة = لا حجز */
  const daySlots = useMemo(() => {
    if (!specId || !date) return [];
    const dow = String(new Date(date + "T00:00:00").getDay());
    const own = spec?.weeklyHours?.[dow] || [];
    return [...own].sort();
  }, [specId, date, spec]);

  /* أيام استقبال الأخصائي (لها أوقات محفوظة) — النقر يختار أقرب تاريخ لهذا اليوم */
  const specDays = useMemo(() => {
    const wh = spec?.weeklyHours || {};
    const out: { dow: number; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const n = (wh[String(i)] || []).length;
      if (n > 0) out.push({ dow: i, count: n });
    }
    return out;
  }, [spec]);

  const nextDateForDow = (dow: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!specId || !date) { setTaken([]); return; }
    (async () => {
      try {
        const r = await fetch(`/api/appointments?mode=taken&specialistId=${specId}&date=${date}`, { cache: "no-store" });
        const j = await r.json();
        setTaken(j.taken || []);
      } catch {}
    })();
  }, [specId, date]);

  /* الأوقات المعطّلة: المحجوزة + الماضية (إن كان اليوم) */
  const disabledTimes = useMemo(() => {
    const dis = [...taken];
    if (date === todayStr()) {
      const nm = nowHM();
      daySlots.forEach((s) => { if (s <= nm && !dis.includes(s)) dis.push(s); });
    }
    return dis;
  }, [taken, date, daySlots]);

  const freeSlots = daySlots.filter((s) => !disabledTimes.includes(s));

  const canNext = step === 1 ? !!specId && (!isStaff || !!clientId) : step === 2 ? !!date && !!time : true;

  /* ★ v3.8: السعر الأساس للخصم = سعر الخدمة المختارة من خدمات الأخصائي (أو 0) */
  const basePrice = Math.max(0, Number(specServices.find((s) => s._id === serviceId)?.price) || 0);
  const finalPrice = Math.max(0, basePrice - (couponInfo?.discount || 0));

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponBusy(true);
    setCouponErr("");
    try {
      const r = await fetch(`/api/coupons?validate=${encodeURIComponent(code)}&price=${basePrice}`);
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.coupon) {
        setCouponInfo({ code: j.coupon.code, discount: j.coupon.discount || 0 });
        toast.success(`${t("appt.couponOk")} — ${t("appt.discount")}: ${j.coupon.discount} ${lang === "ar" ? "دج" : "DA"}`);
      } else {
        setCouponInfo(null);
        setCouponErr(j.error || t("appt.couponBad"));
      }
    } catch {
      setCouponErr(t("err.conn"));
    }
    setCouponBusy(false);
  };

  const submit = async () => {
    if (!specId || !date || !time || (!me?.role || (isStaff && !clientId))) {
      toast.error(t("err.required"));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialistId: specId,
          clientId: isStaff ? clientId : me?._id,
          serviceId: serviceId || undefined,
          serviceTitle: specServices.find((s) => s._id === serviceId)?.title || "",
          serviceTitleFr: specServices.find((s) => s._id === serviceId)?.titleFr || "",
          serviceTitleEn: specServices.find((s) => s._id === serviceId)?.titleEn || "",
          kind: spec?.specialty === "art_therapy" ? "art_therapy" : "psychological",
          mode: "onsite",
          price: basePrice,
          couponCode: couponInfo?.code || "",
          date, time, notes,
        }),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success(t("appt.bookingDone"));
        onClose();
      } else {
        toast.error(j.error || t("common.error"));
        /* الوقت اختُط لاحقاً؟ أعد تحميل المحجوز وارجع للخطوة ٢ */
        if (String(j.error || "").includes("محجوز") || r.status === 409) setStep(2);
      }
    } catch {
      toast.error(t("err.conn"));
    }
    setBusy(false);
  };

  const minDate = todayStr();
  const stepLabels = [t("appt.stepSpecialist"), t("appt.stepSchedule"), t("appt.stepConfirm")];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-start">{isStaff ? t("appt.bookFor") : t("appt.bookNew")}</DialogTitle>
          <DialogDescription className="text-start">{t("appt.reminderNote")}</DialogDescription>
        </DialogHeader>

        {/* مؤشر الخطوات */}
        <div className="flex items-center gap-1.5" role="tablist" aria-label={t("appt.bookNew")}>
          {stepLabels.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => { if (done || active) setStep(n); }}
                className={cn(
                  "flex-1 rounded-xl px-2 py-2 text-[11px] sm:text-xs font-bold transition-all min-h-11 flex items-center justify-center gap-1.5",
                  active ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : done ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                    : "bg-muted/70 text-muted-foreground"
                )}
              >
                <span className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black",
                  active ? "bg-primary-foreground/25" : done ? "bg-emerald-500 text-white" : "bg-muted"
                )}>
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
                </span>
                <span className="break-words">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {/* ── الخطوة ١: الأطراف ── */}
          {step === 1 && (
            <>
              {isStaff && (
                <div className="space-y-2">
                  <Label>{t("appt.client")}</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger className="h-12"><SelectValue placeholder={t("appt.client")} /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("appt.specialist")}</Label>
                {specialists.length === 0 ? (
                  <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground text-center">
                    {t("appt.noSpecialists")}
                  </p>
                ) : (
                  <div className="grid gap-2 max-h-64 overflow-y-auto p-1">
                    {specialists.map((s) => (
                      <button
                        key={s._id}
                        type="button"
                        onClick={() => { setSpecId(s._id); setTime(""); setServiceId(""); }}
                        aria-pressed={specId === s._id}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border p-3 text-start transition-all min-h-[64px]",
                          specId === s._id
                            ? "border-primary bg-primary/6 shadow-sm shadow-primary/10"
                            : "border-border hover:border-primary/40 hover:bg-muted/40"
                        )}
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
                          {s.photoBase64 ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.photoBase64} alt={s.name} className="h-full w-full object-cover" />
                          ) : (
                            <UserRound className="h-5 w-5" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-bold">{s.name}</span>
                          <span className="block break-words text-xs text-muted-foreground">
                            {specTitle(s)}
                          </span>
                        </span>
                        {specId === s._id && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("appt.chooseService")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
                {/* ★ v3.12: خدمات الأخصائي المختار حصراً — لا كل خدمات العيادة */}
                {specId && specServices.length === 0 ? (
                  <p className="rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                    {t("appt.noSpecServices")}
                  </p>
                ) : (
                  <Select value={serviceId} onValueChange={setServiceId} disabled={!specId}>
                    <SelectTrigger className="h-12"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {specServices.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          <span className="flex items-center gap-2">
                            <span aria-hidden="true">{s.icon || "✨"}</span>
                            {svcTitle(s)}
                            {Number(s.price) > 0 && <span className="text-xs font-bold text-primary">{Number(s.price).toLocaleString(lang === "ar" ? "ar-DZ" : "fr-DZ")} {lang === "ar" ? "دج" : "DA"}</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </>
          )}

          {/* ── الخطوة ٢: اليوم والتوقيت ── */}
          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>{t("appt.chooseDate")}</Label>
                <Input
                  type="date"
                  min={minDate}
                  value={date}
                  onChange={(e) => { setDate(e.target.value); setTime(""); }}
                  className="h-12"
                />
                {date && (
                  <p className="text-xs font-semibold text-primary">
                    {DAYS[new Date(date + "T00:00:00").getDay()]}
                  </p>
                )}
              </div>
              {/* ★ v3.12: أيام استقبال الأخصائي — النقر يقفز لأقرب تاريخ لهذا اليوم */}
              {specDays.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("appt.specDays")}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {specDays.map(({ dow, count }) => {
                      const active = date && new Date(date + "T00:00:00").getDay() === dow;
                      return (
                        <button
                          key={dow}
                          type="button"
                          onClick={() => { setDate(nextDateForDow(dow)); setTime(""); }}
                          aria-pressed={!!active}
                          className={cn(
                            "flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-all",
                            active
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          )}
                        >
                          {DAYS[dow]}
                          <span className={cn(
                            "rounded-full px-1.5 text-[10px] tabular-nums",
                            active ? "bg-primary-foreground/25" : "bg-primary/10 text-primary"
                          )}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {specId && date && (
                <div className="space-y-2">
                  <Label>{t("appt.chooseTime")}</Label>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{t("appt.onlySpecSlots")}</p>
                  {specDays.length === 0 ? (
                    <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground text-center">
                      {t("appt.noSpecHours")}
                    </p>
                  ) : daySlots.length === 0 ? (
                    <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground text-center">
                      {t("appt.noHours")}
                    </p>
                  ) : freeSlots.length === 0 ? (
                    <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground text-center">
                      {t("appt.allTaken")}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 gap-2">
                      {daySlots.map((s) => {
                        const dis = disabledTimes.includes(s);
                        const sel = time === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            disabled={dis}
                            aria-pressed={sel}
                            onClick={() => setTime(sel ? "" : s)}
                            className={cn(
                              "rounded-xl px-1 py-2.5 text-sm font-semibold tabular-nums transition-all border select-none",
                              "min-h-[44px] flex items-center justify-center",
                              dis
                                ? "bg-muted/50 text-muted-foreground/50 line-through cursor-not-allowed border-transparent"
                                : sel
                                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25 scale-[1.03]"
                                  : "bg-background hover:border-primary/50 hover:bg-primary/5 border-border"
                            )}
                          >
                            <span dir="ltr">{s}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {taken.length > 0 && (
                    <p className="text-xs text-muted-foreground">{t("appt.taken")}: <span dir="ltr">{taken.join(" · ")}</span></p>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── الخطوة ٣: التأكيد ── */}
          {step === 3 && (
            <>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2.5">
                <p className="flex justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{t("appt.specialist")}</span>
                  <span className="font-bold">{spec?.name || "—"}</span>
                </p>
                {isStaff && (
                  <p className="flex justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{t("appt.client")}</span>
                    <span className="font-bold">{clients.find((c) => c._id === clientId)?.name || "—"}</span>
                  </p>
                )}
                {serviceId && (
                  <p className="flex justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{t("appt.chooseService")}</span>
                    <span className="font-bold">{specServices.find((s) => s._id === serviceId) ? svcTitle(specServices.find((s) => s._id === serviceId)!) : "—"}</span>
                  </p>
                )}
                <p className="flex justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{t("appt.chooseDate")}</span>
                  <span className="font-bold">{DAYS[new Date(date + "T00:00:00").getDay()]} · <span dir="ltr">{date}</span></span>
                </p>
                <p className="flex justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{t("appt.chooseTime")}</span>
                  <span className="font-bold tabular-nums" dir="ltr">{time}</span>
                </p>
                {/* ★ v3.8: المبالغ والخصم */}
                {basePrice > 0 && (
                  <>
                    <p className="flex justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">{t("appt.price")}</span>
                      <span className="font-bold tabular-nums">{basePrice.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-DZ")} {lang === "ar" ? "دج" : "DA"}</span>
                    </p>
                    {couponInfo && couponInfo.discount > 0 && (
                      <p className="flex justify-between gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                        <span>{t("appt.discount")} ({couponInfo.code})</span>
                        <span className="font-bold tabular-nums">− {couponInfo.discount.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-DZ")} {lang === "ar" ? "دج" : "DA"}</span>
                      </p>
                    )}
                    <p className="flex justify-between gap-2 text-sm border-t border-primary/15 pt-2">
                      <span className="font-black">{t("appt.total")}</span>
                      <span className="font-black tabular-nums text-primary">{finalPrice.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-DZ")} {lang === "ar" ? "دج" : "DA"}</span>
                    </p>
                  </>
                )}
              </div>
              {/* ★ v3.8: كود الخصم */}
              <div className="space-y-1.5">
                <Label>{t("appt.coupon")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponInfo(null); setCouponErr(""); }}
                    placeholder={t("appt.couponPh")}
                    className="h-11 font-black tracking-widest ltr:font-mono rtl:font-sans"
                    dir="ltr"
                  />
                  <Button type="button" variant="outline" onClick={applyCoupon} disabled={!couponInput.trim() || couponBusy} className="h-11 shrink-0 rounded-xl">
                    {t("appt.couponApply")}
                  </Button>
                </div>
                {couponInfo && couponInfo.discount > 0 && (
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">✓ {t("appt.couponOk")}</p>
                )}
                {couponErr && <p className="text-xs font-semibold text-red-600">{couponErr}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t("common.notes")}</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t("common.optional")} />
              </div>
            </>
          )}

          {/* أزرار التنقل */}
          <div className="flex items-center gap-2 pt-1">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="h-12 rounded-xl">
                {t("common.back")}
              </Button>
            )}
            {step < 3 ? (
              <Button
                type="button"
                disabled={!canNext}
                onClick={() => setStep(step + 1)}
                className="flex-1 h-12 text-base rounded-xl"
              >
                {t("common.next")}
              </Button>
            ) : (
              <Button onClick={submit} disabled={busy} className="flex-1 h-12 text-base rounded-xl">
                {busy ? t("common.loading") : t("appt.confirmBooking")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────── نافذة تغيير وقت الموعد ★ v3.12 ─────────────────
 * للأخصائي صاحب الموعد وللإدارة — الأوقات المعروضة = أوقات الأخصائي
 * المحفوظة في إعداداته حصراً (لا أوقات العيادة العامة) —
 * عند الحفظ يتحقق الخادم كاملاً ويتلقى العميل إشعاراً فورياً بالتوقيت الجديد */
function RescheduleDialog({ open, appt, onClose }: { open: boolean; appt: Appt | null; onClose: () => void }) {
  const { t, me, lang } = useApp();
  const DAYS = DAYS_BY_LANG[lang] || DAYS_BY_LANG.ar;
  const isStaff = me?.role === "admin" || me?.role === "assistant";
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [specHours, setSpecHours] = useState<Record<string, string[]>>({});
  const [taken, setTaken] = useState<string[]>([]);

  /* فتح النافذة: جلب ساعات الأخصائي — الأخصائي نفسه من حسابه، الإدارة من الحسابات */
  useEffect(() => {
    if (!open || !appt) return;
    setDate(appt.date);
    setTime("");
    setTaken([]);
    setSpecHours({});
    (async () => {
      if (me?.role === "specialist") {
        setSpecHours(me?.weeklyHours || {});
      } else if (isStaff) {
        try {
          const r = await fetch("/api/accounts", { cache: "no-store" });
          const j = await r.json();
          const s = (j.users || []).find((u: Account) => u._id === appt.specialistId);
          setSpecHours(s?.weeklyHours || {});
        } catch {
          setSpecHours({});
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appt?._id]);

  /* الأوقات المحجوزة لليوم المختار — الموعد نفسه متاح (ننتقل منه) */
  useEffect(() => {
    if (!open || !appt || !date) {
      setTaken([]);
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/appointments?mode=taken&specialistId=${appt.specialistId}&date=${date}`, { cache: "no-store" });
        const j = await r.json();
        setTaken((j.taken || []).filter((x: string) => !(date === appt.date && x === appt.time)));
      } catch {
        setTaken([]);
      }
    })();
  }, [open, appt, date]);

  const daySlots = useMemo(() => {
    if (!date) return [];
    const dow = String(new Date(date + "T00:00:00").getDay());
    return [...(specHours[dow] || [])].sort();
  }, [date, specHours]);

  /* الأوقات المعطّلة: المحجوزة + الماضية (إن كان اليوم) */
  const disabledTimes = useMemo(() => {
    const dis = [...taken];
    if (date === todayStr()) {
      const nm = nowHM();
      daySlots.forEach((s) => {
        if (s <= nm && !dis.includes(s)) dis.push(s);
      });
    }
    return dis;
  }, [taken, date, daySlots]);

  const hasAnyHours = Object.values(specHours).some((v) => (v || []).length > 0);

  const save = async () => {
    if (!appt || !date || !time) {
      toast.error(t("err.required"));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/appointments/${appt._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        toast.success(t("appt.rescheduleDone"));
        onClose();
      } else {
        toast.error(j.error || t("common.error"));
      }
    } catch {
      toast.error(t("err.conn"));
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-start">{t("appt.rescheduleTitle")}</DialogTitle>
          <DialogDescription className="text-start">{t("appt.rescheduleHint")}</DialogDescription>
        </DialogHeader>
        {appt && (
          <div className="space-y-4">
            {/* التوقيت الحالي */}
            <div className="flex items-center gap-3 rounded-2xl border bg-muted/40 p-3">
              <span className="flex h-13 w-13 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 py-1.5 text-primary">
                <span className="text-[10px] font-bold leading-none">{DAYS[new Date(appt.date + "T00:00:00").getDay()]}</span>
                <span className="mt-1 text-sm font-black tabular-nums leading-none">{appt.time}</span>
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="break-words font-bold">{me?.role === "client" ? appt.specialistName : appt.clientName || "—"}</p>
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {appt.date} · {appt.time}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="resched-date">{t("appt.chooseDate")}</Label>
              <Input
                id="resched-date"
                type="date"
                min={todayStr()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime("");
                }}
                className="h-12"
              />
              {date && <p className="text-xs font-semibold text-primary">{DAYS[new Date(date + "T00:00:00").getDay()]}</p>}
            </div>

            {date && (
              <div className="space-y-2">
                <Label>{t("appt.chooseTime")}</Label>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{t("appt.onlySpecSlots")}</p>
                {!hasAnyHours ? (
                  <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground text-center">{t("appt.noSpecHours")}</p>
                ) : daySlots.length === 0 ? (
                  <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground text-center">{t("appt.noHours")}</p>
                ) : disabledTimes.filter((s) => daySlots.includes(s)).length >= daySlots.length ? (
                  <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground text-center">{t("appt.allTaken")}</p>
                ) : (
                  <div className="grid grid-cols-3 xs:grid-cols-4 gap-2">
                    {daySlots.map((s) => {
                      const dis = disabledTimes.includes(s);
                      const sel = time === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={dis}
                          aria-pressed={sel}
                          onClick={() => setTime(sel ? "" : s)}
                          className={cn(
                            "rounded-xl px-1 py-2.5 text-sm font-semibold tabular-nums transition-all border select-none",
                            "min-h-[44px] flex items-center justify-center",
                            dis
                              ? "bg-muted/50 text-muted-foreground/50 line-through cursor-not-allowed border-transparent"
                              : sel
                                ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25 scale-[1.03]"
                                : "bg-background hover:border-primary/50 hover:bg-primary/5 border-border"
                          )}
                        >
                          <span dir="ltr">{s}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose} className="h-12 flex-1 rounded-xl">
                {t("common.cancel")}
              </Button>
              <Button onClick={save} disabled={busy || !date || !time} className="h-12 flex-1 rounded-xl">
                {busy ? t("common.saving") : t("common.confirm")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

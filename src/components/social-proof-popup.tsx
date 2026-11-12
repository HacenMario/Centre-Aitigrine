"use client";
/**
 * نافذة الإثبات الاجتماعي (v3.20) — طلب صاحب المركز:
 * «تظهر بشكل مناسب في الشاشة و تغلق تلقائيا بعد 10 ثواني مع زر اغلاق يدوي.
 *  يظهر فيها لقب المستخدم و تفاصيل حول الموعد الذي حجزه أو التكوين الذي حجز فيه
 *  مقعد أو ال E-book الذي اشتراه... تجنب التكرار حتى يظهر تفاصيل ما قام به كل
 *  المستخدمين. النافذة مرة كل 5 دقائق لكل مستخدم حتى لا تزعجه والاغلاق اليدوي
 *  يوقفها عن الظهور له نهائيا حتى يعيد الولوج الى الموقع من جديد»
 *
 * القواعد المطبقة حرفياً:
 * - أنشطة حقيقية من /api/activities (نبضة لكل مستخدم — دوران بلا تكرار)
 * - مرة كل 5 دقائق (sessionStorage) — إغلاق تلقائي بعد 10 ثوانٍ بشريط تقدم
 * - الإغلاق اليدوي (×) يوقفها لبقية الجلسة حتى ولوج جديد للموقع
 * - ★ v3.22.3: فوق شريط التبويبات على الجوال/التابلت (< lg) — كانت bottom-4 z-30
 *   فتظهر خلف الشريط السفلي (z-40) — الآن bottom فوق الشريط تماماً (نفس ارتفاع
 *   الأزرار العائمة + safe-area) و z-[55] فوق عناصر الواجهة وتحت النوافذ
 *   أما الحاسوب (lg) فموضعها كما هو bottom-4 حرفياً — لا تغيير إطلاقاً
 * - للجميع: زوار ومسجلون — هي رسالة تحفيز للمركز لا بيانات خاصة
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { BookOpenText, CalendarClock, GraduationCap, X } from "lucide-react";

type Item = {
  kind: "appointment" | "course" | "ebook";
  name: string;
  labels: { ar: string; fr: string; en: string; tr: string; es: string };
  at: string;
};

const CLOSED_KEY = "ait_sp_closed";
const LAST_KEY = "ait_sp_last";
const LAST_NAME_KEY = "ait_sp_lastname";
const REPEAT_MS = 5 * 60 * 1000; /* مرة كل 5 دقائق */
const SHOW_MS = 10_000; /* إغلاق تلقائي بعد 10 ثوانٍ */
const FIRST_DELAY_MS = 12_000; /* أول ظهور بعد استقرار الصفحة */

export default function SocialProofPopup() {
  const { t, lang, ready } = useApp();
  const [item, setItem] = useState<Item | null>(null);
  const [progressKey, setProgressKey] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastName = useRef<string>("");

  const locale = lang === "ar" ? "ar-DZ" : lang === "fr" ? "fr-FR" : lang === "tr" ? "tr-TR" : lang === "es" ? "es-ES" : "en-GB";

  /* «منذ …» بلغة المستخدم */
  const ago = useCallback(
    (iso: string) => {
      try {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
        if (mins < 1) return rtf.format(0, "minute");
        if (mins < 60) return rtf.format(-mins, "minute");
        const h = Math.floor(mins / 60);
        if (h < 24) return rtf.format(-h, "hour");
        return rtf.format(-Math.floor(h / 24), "day");
      } catch {
        return "";
      }
    },
    [locale]
  );

  const tryShow = useCallback(async () => {
    try {
      if (sessionStorage.getItem(CLOSED_KEY) === "1") return;
      const last = Number(sessionStorage.getItem(LAST_KEY) || "0");
      if (Date.now() - last < REPEAT_MS) return;
      if (document.hidden) return;
      const r = await fetch("/api/activities", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      const items = (j.activities || []) as Item[];
      if (!items.length) return;
      const stored = sessionStorage.getItem(LAST_NAME_KEY) || "";
      lastName.current = stored;
      /* دوران بلا تكرار: اسم مختلف عن الظهور السابق إن أمكن */
      const pool = items.filter((i) => i.name !== stored);
      const pick = (pool.length ? pool : items)[Math.floor(Math.random() * (pool.length ? pool.length : items.length))];
      setItem(pick);
      setProgressKey((k) => k + 1);
      sessionStorage.setItem(LAST_KEY, String(Date.now()));
      sessionStorage.setItem(LAST_NAME_KEY, pick.name || "");
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setItem(null), SHOW_MS);
    } catch {}
  }, []);

  useEffect(() => {
    if (!ready) return;
    const first = setTimeout(tryShow, FIRST_DELAY_MS);
    const iv = setInterval(tryShow, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [ready, tryShow]);

  /* إيقاف يدوي: نهائي لبقية الجلسة — يعود بالولوج الجديد للموقع */
  const closeManual = () => {
    try {
      sessionStorage.setItem(CLOSED_KEY, "1");
    } catch {}
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setItem(null);
  };

  if (!item) return null;

  const Icon = item.kind === "appointment" ? CalendarClock : item.kind === "course" ? GraduationCap : BookOpenText;
  const tone =
    item.kind === "appointment"
      ? "bg-emerald-100 text-emerald-700"
      : item.kind === "course"
        ? "bg-violet-100 text-violet-700"
        : "bg-amber-100 text-amber-700";
  const label = item.labels?.[lang] || item.labels?.ar || "";
  const action =
    item.kind === "appointment" ? t("sp.appointment") : item.kind === "course" ? t("sp.course") : t("sp.ebook");

  return (
    <div
      className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] start-4 z-[55] w-[19rem] max-w-[calc(100vw-2rem)] lg:bottom-4"
      role="status"
      aria-live="polite"
    >
      <div className="overflow-hidden rounded-2xl border bg-card/95 shadow-xl backdrop-blur animate-in fade-in slide-in-from-bottom-3 duration-500">
        <div className="flex items-start gap-3 p-3.5">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug break-words whitespace-normal">
              <span className="font-black">{item.name || "—"}</span>{" "}
              <span className="text-muted-foreground">{action}</span>{" "}
              {label && <span className="font-bold text-primary">«{label}»</span>}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/80">{ago(item.at)}</p>
          </div>
          <button
            type="button"
            onClick={closeManual}
            aria-label={t("common.close")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* شريط التقدم: 10 ثوانٍ حتى الإغلاق التلقائي */}
        <div className="h-0.5 w-full bg-muted/60">
          <div
            key={progressKey}
            className="h-full bg-primary/70"
            style={{ animation: `ait-sp-progress ${SHOW_MS}ms linear forwards` }}
          />
        </div>
      </div>
    </div>
  );
}

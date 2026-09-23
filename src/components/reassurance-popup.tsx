"use client";
/**
 * نافذة «لحظة اطمئنان» — نمط طمأنينة كامل (v3.5)
 * ★ عبارة تُختار من مكتبة يديرها حساب الإدارة (/api/quotes) بثلاث لغات
 * ★ دورة بلا تكرار: لا تظهر عبارة ثانيةً إلا بعد ظهور كل العبارات مرة
 *   واحدة على الأقل (حقيبة خلط محفوظة محلياً — نمط طمأنينة v2.13)
 * ★ المكتبة المدمجة (re-quotes.ts) شبكة أمان إن تعذر الاتصال
 * تظهر عند ولوج الرئيسية مرة واحدة في جلسة التصفح،
 * وتختفي تلقائياً بعد 10 ثوانٍ أو بإغلاق يدوي.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { RE_QUOTES } from "@/lib/re-quotes";
import type { Lang } from "@/lib/app-context";

const SHOW_DELAY_MS = 700;
const AUTO_CLOSE_MS = 10000;
const SEEN_KEY = "ait_reassure_seen";
const SEEN_QUOTES_KEY = "ait_quote_seen";

type QuoteRow = { id: string; ar: string; fr: string; en: string; tr?: string; es?: string; author?: string };

export default function ReassurancePopup() {
  const { t, lang, view, ready } = useApp();
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (!ready || view !== "home") return;
    let cancelled = false;
    try {
      if (sessionStorage.getItem(SEEN_KEY) === "1") return;
    } catch {}

    const launch = setTimeout(async () => {
      if (cancelled) return;
      /* ١) مكتبة الإدارة من الخادم — والمدمجة شبكة أمان */
      let pool: QuoteRow[] = [];
      try {
        const r = await fetch("/api/quotes", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          pool = (j.quotes || []).map((q: Record<string, unknown>) => ({
            id: String(q.id),
            ar: String(q.textAr || ""),
            fr: String(q.textFr || ""),
            en: String(q.textEn || ""),
            tr: String(q.textTr || ""),
            es: String(q.textEs || ""),
            author: String(q.author || ""),
          }));
        }
      } catch {}
      if (pool.length === 0) {
        pool = RE_QUOTES.map((q, i) => ({ id: `seed-${i}`, ar: q.ar, fr: q.fr, en: q.en, tr: q.tr, es: q.es }));
      }
      if (cancelled || pool.length === 0) return;

      /* ٢) دورة بلا تكرار — السجل يُنظّف من معرّفات لم تعد موجودة */
      const poolIds = new Set(pool.map((q) => q.id));
      let seen: string[] = [];
      try {
        const raw = JSON.parse(localStorage.getItem(SEEN_QUOTES_KEY) || "[]");
        seen = Array.isArray(raw) ? raw.filter((x: unknown) => typeof x === "string" && poolIds.has(x)) : [];
      } catch {}
      const seenSet = new Set(seen);
      let fresh = pool.filter((q) => !seenSet.has(q.id));
      if (fresh.length === 0) {
        seen = [];
        fresh = pool;
      }
      const chosen = fresh[Math.floor(Math.random() * fresh.length)];
      seen.push(chosen.id);
      try {
        localStorage.setItem(SEEN_QUOTES_KEY, JSON.stringify(seen.slice(-400)));
      } catch {}

      if (cancelled) return;
      setQuote(chosen);
      setOpen(true);
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {}
      timerRef.current = setTimeout(close, AUTO_CLOSE_MS);
    }, SHOW_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(launch);
    };
  }, [ready, view, close]);

  if (!open || !quote) return null;
  const text =
      lang === "tr" ? (quote.tr || quote.en || quote.fr || quote.ar)
      : lang === "es" ? (quote.es || quote.en || quote.fr || quote.ar)
      : (quote[lang as Lang] || quote.ar);

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      role="dialog"
      aria-label={t("re.title")}
    >
      {/* خلفية شفافة هادئة */}
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={close}
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[3px] cursor-default"
      />

      {/* البطاقة */}
      <div className="ait-re-enter relative w-full max-w-md overflow-hidden rounded-[2rem] border bg-card/95 p-7 text-center shadow-2xl shadow-primary/10 sm:p-9">
        {/* هالة ضوئية ناعمة */}
        <span
          className="ait-re-glow pointer-events-none absolute -top-16 start-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute -bottom-20 -end-16 h-40 w-40 rounded-full bg-accent/15 blur-3xl"
          aria-hidden="true"
        />

        {/* زر الإغلاق */}
        <button
          type="button"
          onClick={close}
          aria-label={t("common.close")}
          className="absolute top-3.5 end-3.5 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-foreground hover:rotate-90 active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative space-y-4">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/25 text-primary shadow-inner ring-1 ring-primary/20">
            <Sparkles className="h-7 w-7" />
          </span>
          <p className="text-[11px] font-black uppercase text-primary/80">
            {t("re.title")}
          </p>
          <p className="text-[1.05rem] font-semibold leading-loose text-foreground sm:text-lg" dir="auto">
            {text}
          </p>
          {quote.author && (
            <span className="inline-block rounded-full bg-muted px-3 py-1 text-[11px] font-bold text-muted-foreground" dir="auto">
              {quote.author}
            </span>
          )}
          <div className="flex items-center justify-center gap-2 pt-1 text-[11px] font-semibold text-muted-foreground">
            <span className="h-px w-8 bg-border" aria-hidden="true" />
            {t("re.sub")}
            <span className="h-px w-8 bg-border" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}

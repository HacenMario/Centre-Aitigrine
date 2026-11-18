"use client";
/**
 * الإعلان العائم (نمط طمأنينة v1.17 مكيَّف) — ★ v3.26
 * • يظهر للعملاء والأخصائيين المسجلين فقط — بحد ظهور لكل مستخدم وصلاحية منتهية
 * • سلايدر وسائط (صور + فيديو) + شارة نوع الإعلان + لوغو + زر «لا تظهر مجدداً» لهذه الجلسة
 * • ★ النص كامل قابل للتمرير عمودياً (كان يُقطع دون تمرير) — سلاسة لمس على iOS
 * • ★ قنوات التواصل كأيقونات حقيقية قابلة للنقر + زر إجراء اختياري + عدّاد نقرات
 * • إغلاق يدوي (×) وإغلاق تلقائي بعد 20 ثانية
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Megaphone, Volume2, ExternalLink } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/client-api";
import { AdContactRow } from "@/components/views/ads";
import { hasContact, type AdContact } from "@/lib/ad-links";

interface FloatingAd {
  id: string;
  title: string;
  body: string;
  media: string[];
  adType?: string;
  logo?: string;
  contact?: AdContact;
  ctaText?: string;
  ctaUrl?: string;
}

const AUTO_CLOSE_MS = 20000;

function isVideo(url: string) {
  return url.startsWith("data:video/") || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

export default function FloatingAd() {
  const { t, me, ready, navigate } = useApp();
  const [ad, setAd] = useState<FloatingAd | null>(null);
  const [slide, setSlide] = useState(0);
  const [show, setShow] = useState(false);
  const shownIdRef = useRef<string | null>(null);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchX = useRef<number | null>(null);

  const dismissSession = () => {
    try {
      sessionStorage.setItem("ait_floating_ad_dismissed", "1");
    } catch {}
    setShow(false);
  };

  const fetchAd = useCallback(async () => {
    if (!me || !["client", "specialist"].includes(me.role)) return;
    try {
      if (sessionStorage.getItem("ait_floating_ad_dismissed") === "1") return;
    } catch {}
    try {
      const r = await fetch("/api/ads/floating", { cache: "no-store" });
      const j = await r.json();
      if (j.ad && j.ad.id && shownIdRef.current !== j.ad.id) {
        shownIdRef.current = j.ad.id;
        setAd(j.ad);
        setSlide(0);
        setShow(true);
        /* تسجيل ظهور لعدّاد حد الإزعاج */
        void fetch("/api/ads/floating", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-auth-token": getToken() || "" },
          body: JSON.stringify({ id: j.ad.id }),
        }).catch(() => {});
      }
    } catch {}
  }, [me]);

  useEffect(() => {
    if (!ready) return;
    /* مهلة خنق: لا إزعاج مباشر عند فتح الموقع — وبعد نافذة الاطمئنان (10 ثوانٍ) */
    const t1 = setTimeout(() => void fetchAd(), 12500);
    const poll = setInterval(() => void fetchAd(), 5 * 60000);
    return () => {
      clearTimeout(t1);
      clearInterval(poll);
    };
  }, [ready, fetchAd]);

  useEffect(() => {
    if (show) {
      autoTimerRef.current = setTimeout(() => setShow(false), AUTO_CLOSE_MS);
      return () => {
        if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      };
    }
  }, [show]);

  /* ★ v3.26: عدّاد نقرات التواصل/الإجراء */
  const countClick = (adId: string) => {
    void fetch("/api/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "click", id: adId }),
    }).catch(() => {});
  };

  if (!show || !ad) return null;
  const media = ad.media || [];
  const next = () => setSlide((i) => (media.length ? (i + 1) % media.length : 0));
  const prev = () => setSlide((i) => (media.length ? (i - 1 + media.length) % media.length : 0));

  return (
    <div className="fixed inset-x-3 top-3 z-[90] sm:inset-x-auto sm:top-auto sm:start-5 sm:bottom-5 sm:w-[26rem]">
      <div className="ait-float-ad flex max-h-[78dvh] flex-col overflow-hidden rounded-3xl border bg-popover shadow-2xl shadow-black/20">
        {/* الرأس: نوع الإعلان + اللوغو — ثابت */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-primary/8 px-4 py-2.5">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-black text-primary">
            <Megaphone className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{ad.adType || t("ads.floatBadge")}</span>
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={dismissSession}
              className="rounded-lg px-2 py-1 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground">
              {t("ads.dontShowAgain")}
            </button>
            <button type="button" onClick={() => setShow(false)} aria-label={t("common.close")}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* الوسائط — ثابتة أعلى */}
        {media.length > 0 && (
          <div className="relative shrink-0 bg-muted/40 select-none"
            onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
            onTouchEnd={(e) => {
              const sx = touchX.current;
              touchX.current = null;
              if (sx === null) return;
              const dx = (e.changedTouches[0]?.clientX ?? 0) - sx;
              if (Math.abs(dx) < 50) return;
              if (dx < 0) next();
              else prev();
            }}>
            {isVideo(media[slide]) ? (
              <video src={media[slide]} controls playsInline className="max-h-56 w-full bg-black object-contain" />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={media[slide]} alt={ad.title} className="max-h-56 w-full object-contain" />
            )}
            {media.length > 1 && (
              <>
                <button type="button" onClick={prev} aria-label="prev"
                  className="absolute start-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow">
                  <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
                </button>
                <button type="button" onClick={next} aria-label="next"
                  className="absolute end-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow">
                  <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" />
                </button>
                <div className="absolute bottom-2 start-1/2 flex -translate-x-1/2 gap-1 rtl:translate-x-1/2">
                  {media.map((_, i) => (
                    <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i === slide ? "bg-primary" : "bg-foreground/25")} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ★ المحتوى قابل للتمرير عمودياً — كامل النص واللوغو والتواصل والزر */}
        <div
          className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" } as React.CSSProperties}
        >
          <div className="flex items-start gap-2.5">
            {ad.logo && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={ad.logo} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-border" />
            )}
            <h3 className="min-w-0 font-black leading-snug">{ad.title}</h3>
          </div>
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{ad.body}</p>
          {hasContact(ad.contact) && <AdContactRow contact={ad.contact || {}} adId={ad.id} onCount={countClick} />}
          {ad.ctaText && ad.ctaUrl && (
            <a
              href={ad.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => countClick(ad.id)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              {ad.ctaText}
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={() => { dismissSession(); navigate("ads"); }} className="h-9 gap-1.5 rounded-full">
              <Volume2 className="h-3.5 w-3.5" />
              {t("ads.openAll")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShow(false)} className="h-9 rounded-full">
              {t("ads.later")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

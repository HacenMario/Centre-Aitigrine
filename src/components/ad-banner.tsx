"use client";
/**
 * الشريط الإعلاني الدوّار (نمط طمأنينة v1.16 مكيَّف)
 * شريط رفيع أنيق أعلى الرئيسية يدور تلقائياً بين الإعلانات المنشورة
 * (وسيط مصغّر + العنوان) — الضغط يفتح صفحة الإعلانات + إغلاق لكل جلسة
 */
import { useEffect, useState } from "react";
import { Megaphone, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";
import type { Navigate } from "@/lib/nav";

interface BannerAd {
  id: string;
  title: string;
  media: string[];
}

const ROTATE_MS = 7000;

function isVideo(url: string) {
  return url.startsWith("data:video/") || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

export default function AdBanner({ navigate }: { navigate: Navigate }) {
  const { t } = useApp();
  const [ads, setAds] = useState<BannerAd[]>([]);
  const [idx, setIdx] = useState(0);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("ait_adbanner_closed") === "1") {
        setClosed(true);
        return;
      }
    } catch {}
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/ads?pageSize=8", { cache: "no-store" });
        const j = await r.json();
        if (!alive || !Array.isArray(j?.ads)) return;
        const list: BannerAd[] = j.ads
          .filter((a: { id?: string; title?: string }) => a.id && a.title)
          .map((a: { id: string; title: string; media: string[] }) => ({ id: a.id, title: a.title, media: a.media || [] }));
        setAds(list);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (ads.length < 2) return;
    const timer = setInterval(() => setIdx((i) => (i + 1) % ads.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [ads.length]);

  if (closed || ads.length === 0) return null;
  const ad = ads[idx];
  const thumb = ad.media.find((m) => !isVideo(m));

  return (
    <div className="ait-ad-banner relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-2.5 shadow-sm">
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 text-[10px] font-black text-primary">
        <Megaphone className="h-3 w-3" />
        {t("ads.badge")}
      </span>
      {thumb && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={thumb} alt="" className="hidden h-9 w-12 shrink-0 rounded-lg object-cover ring-1 ring-border sm:block" />
      )}
      <button type="button" onClick={() => navigate("ads")} className="min-w-0 flex-1 text-start">
        <span className="block truncate text-sm font-bold text-foreground">{ad.title}</span>
        <span className="block text-[11px] text-muted-foreground">{t("ads.openAll")}</span>
      </button>
      {ads.length > 1 && (
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setIdx((i) => (i - 1 + ads.length) % ads.length)} aria-label="prev"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
          </button>
          <span className={cn("text-[10px] font-bold tabular-nums text-muted-foreground")}>{idx + 1}/{ads.length}</span>
          <button type="button" onClick={() => setIdx((i) => (i + 1) % ads.length)} aria-label="next"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5 rtl:-scale-x-100" />
          </button>
        </div>
      )}
      <button type="button" aria-label={t("common.close")}
        onClick={() => {
          setClosed(true);
          try {
            sessionStorage.setItem("ait_adbanner_closed", "1");
          } catch {}
        }}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-transform hover:rotate-90 hover:bg-muted hover:text-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

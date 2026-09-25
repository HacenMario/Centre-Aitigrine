"use client";
/**
 * معرض المركز — صور وفيديو بتمرير لمسي سلس (scroll-snap) وأزرار تحترم اتجاه اللغة
 * ★ الصورة تظهر كاملة دائماً تلقائياً (object-contain) — لا يخرج أي جزء خارج الإطار،
 *   والفراغ يُملأ بنسخة ضبابية من نفس الصورة (نمط المنصات العالمية)
 * تُدار الوسائط من إعدادات المركز (الإدارة)
 */
import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, PlayCircle } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function MediaSlider() {
  const { settings, dir, t } = useApp();
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const media = (settings?.sliderMedia || []).map((m) => ({ ...m, src: m.url || m.data || "" })).filter((m) => m.src);

  useEffect(() => setIdx(0), [media.length]);
  if (!media.length) return null;

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const w = el.firstElementChild?.clientWidth || 1;
    const gap = 16;
    setIdx(Math.round(Math.abs(el.scrollLeft) / (w + gap)));
  };

  /* الأزرار تحترم اتجاه التمرير: في RTL القيم السالبة/الموجبة معكوسة */
  const go = (step: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const w = el.firstElementChild?.clientWidth || 320;
    const sign = dir === "rtl" ? -1 : 1;
    el.scrollBy({ left: sign * step * (w + 16), behavior: "smooth" });
  };

  const ArrowPrevIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const ArrowNextIcon = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <section className="space-y-4" aria-label={t("landing.gallery")}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black">{t("landing.gallery")}</h2>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t("landing.gallerySub")}</p>
        </div>
        {media.length > 1 && (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <Button size="icon" variant="outline" onClick={() => go(-1)} aria-label="prev"
              className="rounded-full h-10 w-10">
              <ArrowPrevIcon className="h-5 w-5" />
            </Button>
            <Button size="icon" variant="outline" onClick={() => go(1)} aria-label="next"
              className="rounded-full h-10 w-10">
              <ArrowNextIcon className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      <div className="relative group">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 pt-1 px-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {media.map((m, i) => (
            <figure
              key={i}
              className="relative aspect-[16/10] w-[86%] shrink-0 snap-center overflow-hidden rounded-3xl bg-muted shadow-md ring-1 ring-black/5 transition-shadow hover:shadow-xl sm:w-[58%] lg:w-[44%]"
            >
              {m.type === "video" ? (
                <video
                  src={m.src}
                  className="h-full w-full bg-black object-cover"
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={m.title || `media ${i + 1}`}
                />
              ) : (
                <>
                  {/* خلفية ضبابية من نفس الصورة تملأ الفراغ */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.src}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl opacity-40"
                    draggable={false}
                    loading="lazy"
                  />
                  {/* الصورة كاملة — بلا قصّ إطلاقاً */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.src}
                    alt={m.title || `media ${i + 1}`}
                    className="relative h-full w-full object-contain select-none drop-shadow-lg"
                    draggable={false}
                    loading="lazy"
                  />
                </>
              )}
              {m.type === "video" && (
                <PlayCircle className="pointer-events-none absolute top-3 end-3 h-7 w-7 text-white/85 drop-shadow" />
              )}
              {m.title ? (
                <figcaption className="absolute inset-x-0 bottom-0 break-words bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-sm font-semibold text-white">
                  {m.title}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>

        {/* أزرار الجوال — ظاهرة دائماً أسفل المعرض نقاط المؤشر */}
        {media.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-1" aria-hidden="true">
            {media.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === idx ? "w-6 bg-primary" : "w-1.5 bg-primary/25"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

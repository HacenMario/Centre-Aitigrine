"use client";
/**
 * ScrollRow — صف تمرير أفقي مع أزرار تحكّم تظهر على الحاسوب فقط
 * ★ الأزرار تحترم اتجاه اللغة (RTL/LTR)
 * ★ على الهاتف يبقى التمرير اللمسي السلس (snap) بلا أزرار
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ScrollRow({
  children,
  className,
  trackClassName,
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  trackClassName?: string;
  ariaLabel?: string;
}) {
  const { dir } = useApp();
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft);
    setCanPrev(pos > 4);
    setCanNext(pos < max - 4);
  }, []);

  useEffect(() => {
    update();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  /* الأزرار تحترم اتجاه التمرير: في RTL القيم السالبة/الموجبة معكوسة */
  const go = (step: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const sign = dir === "rtl" ? -1 : 1;
    el.scrollBy({ left: sign * step * Math.max(el.clientWidth * 0.7, 200), behavior: "smooth" });
  };

  const PrevIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const NextIcon = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div className={cn("group/scroll relative", className)} aria-label={ariaLabel}>
      {/* أزرار الحاسوب — تظهر عند وجود طريح للتمرير */}
      {canPrev && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => go(-1)}
          aria-label="previous"
          className="absolute top-1/2 -translate-y-1/2 start-1 z-10 hidden md:flex h-9 w-9 rounded-full bg-background/95 shadow-md hover:bg-background"
        >
          <PrevIcon className="h-4.5 w-4.5" />
        </Button>
      )}
      {canNext && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => go(1)}
          aria-label="next"
          className="absolute top-1/2 -translate-y-1/2 end-1 z-10 hidden md:flex h-9 w-9 rounded-full bg-background/95 shadow-md hover:bg-background"
        >
          <NextIcon className="h-4.5 w-4.5" />
        </Button>
      )}
      <div
        ref={trackRef}
        onScroll={update}
        className={cn("flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 no-scrollbar", trackClassName)}
      >
        {children}
      </div>
    </div>
  );
}

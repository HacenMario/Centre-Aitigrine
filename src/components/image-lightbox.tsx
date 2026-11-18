"use client";
/**
 * ★ v3.26 — Lightbox: عرض الصورة بحجمها الكامل داخل الموقع
 * • نقرة على الصورة تفتحها بملء الشاشة قابلة للتمرير (1:1)
 * • زر تبديل: ملاءمة الشاشة ↔ الحجم الأصلي
 * • إغلاق بالنقر أو Escape — يعمل على الجوال والحاسوب
 */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ImageLightbox({
  src,
  alt = "",
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  const { t } = useApp();
  const [fit, setFit] = useState(true); /* true = ملاءمة الشاشة، false = الحجم الأصلي */
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const onScrollClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex flex-col bg-stone-950/95 backdrop-blur-sm"
      onClick={onScrollClick}
    >
      {/* شريط الأدوات */}
      <div className="flex shrink-0 items-center justify-end gap-2 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
        <Button variant="outline" size="sm" onClick={() => setFit((v) => !v)} className="gap-1.5 rounded-full bg-white/10 text-white border-white/20 hover:bg-white/20">
          {fit ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          <span className="hidden sm:inline">{fit ? t("img.actualSize") : t("img.fitScreen")}</span>
        </Button>
        <Button variant="outline" size="icon" onClick={onClose} aria-label={t("common.close")} title={t("common.close")}
          className="h-9 w-9 rounded-full border-white/20 bg-white/10 text-white hover:bg-destructive/60">
          <X className="h-4.5 w-4.5" />
        </Button>
      </div>
      {/* الصورة — قابلة للتمرير عند الحجم الأصلي */}
      <div className="min-h-0 flex-1 overflow-auto p-3" onClick={onScrollClick}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={cn(
            "mx-auto block rounded-lg shadow-2xl",
            fit ? "max-h-full max-w-full object-contain" : "max-w-none"
          )}
        />
      </div>
    </div>,
    document.body
  );
}

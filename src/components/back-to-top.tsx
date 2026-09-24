"use client";
/**
 * زر «العودة إلى الأعلى» — يظهر في كل الصفحات بعد التمرير
 * ★ v3.8.1: يرتكز داخل حزمة الأزرار العائمة (app-shell) — بلا تثبيت مستقل ولا تراكب
 *   عند الاختفاء ينكمش بسلاسة (h-0) ليبقى العمود مضبوطاً دون فراغات
 */
import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

export default function BackToTop() {
  const { t } = useApp();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "transition-all duration-300",
        show ? "h-11 opacity-100 translate-y-0" : "h-0 -mt-2.5 opacity-0 translate-y-6 pointer-events-none overflow-hidden"
      )}
      aria-hidden={!show}
    >
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label={t("backToTop")}
        title={t("backToTop")}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-primary/20",
          "transition-transform duration-300 hover:scale-110 hover:shadow-xl active:scale-95"
        )}
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </div>
  );
}

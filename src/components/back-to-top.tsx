"use client";
/**
 * زر «العودة إلى الأعلى» — يظهر في كل الصفحات بعد التمرير
 * يتماشى مع اتجاه اللغة (RTL/LTR) ويختفي فوق الشاشات الصغيرة عند عدم الحاجة
 */
import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

export default function BackToTop() {
  const { t, dir } = useApp();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={t("backToTop")}
      title={t("backToTop")}
      className={cn(
        "fixed bottom-4 z-[80] flex h-11 w-11 items-center justify-center rounded-full",
        "bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-primary/20",
        "transition-all duration-300 hover:scale-110 hover:shadow-xl active:scale-95",
        dir === "rtl" ? "left-4" : "right-4",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-16 opacity-0"
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

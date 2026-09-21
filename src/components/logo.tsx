"use client";
/**
 * شعار المركز v3 — الصورة + الاسم الكامل في سطرين
 * ★ نقرة واحدة → الرئيسية (إصلاح جذري: كان بلا onClick ولا يفعل شيئاً)
 * الضغط 3 مرات متتالية → إخفاء سريع (ميزة سرية محفوظة)
 */
import Image from "next/image";
import { useRef } from "react";
import { useApp } from "@/lib/app-context";
import { getQuickHideConfig } from "@/lib/quick-hide";
import { toast } from "sonner";

export default function Logo({ onClick, compact = false }: { onClick?: () => void; compact?: boolean }) {
  const { settings, setHidden, t, lang, navigate } = useApp();
  const logoSrc = settings?.logoBase64 || "/logo.png";
  const clicks = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /* الاسم الكامل مترجماً — العربية تحترم اسم المركز المخصص من الإعدادات */
  const line1 = lang === "ar" ? (settings?.centerName || t("app.nameLine")) : t("app.nameLine");
  const line2 = t("app.subLine");

  const handleClick = () => {
    /* الإخفاء السريع: 3 نقرات خلال 1.2 ثانية — يتطلب رمزاً سرياً مفعّلاً */
    clicks.current++;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => (clicks.current = 0), 1200);
    if (clicks.current >= 3) {
      clicks.current = 0;
      if (getQuickHideConfig().enabled) {
        setHidden(true);
        return;
      }
      toast.info(t("qh.notConfigured"));
    }
    if (onClick) onClick();
    else navigate("home");
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 sm:gap-2.5 min-w-0 text-start select-none rounded-xl"
      aria-label={t("app.full")}
      type="button"
      title={t("common.goHome")}
    >
      <span className="relative shrink-0 rounded-xl sm:rounded-2xl overflow-hidden shadow-sm ring-1 ring-primary/20 bg-background w-9 h-9 sm:w-11 sm:h-11 lg:w-12 lg:h-12">
        <Image src={logoSrc} alt={t("app.full")} fill sizes="52px" className="object-contain p-0.5 sm:p-1" />
      </span>
      {!compact && (
        <span className="flex flex-col min-w-0 leading-[1.3]">
          <span className="font-extrabold text-foreground whitespace-normal break-words text-[0.78rem] sm:text-[0.95rem] lg:text-[1.05rem]">
            {line1}
          </span>
          <span className="text-muted-foreground font-medium whitespace-normal break-words text-[0.62rem] sm:text-[0.72rem] lg:text-[0.8rem]">
            {line2}
          </span>
        </span>
      )}
    </button>
  );
}

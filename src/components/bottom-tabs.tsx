"use client";
/**
 * ★ v3.22.0 — شريط التبويبات السفلي للجوال (واجهة تطبيق حقيقية)
 * ثابت أسفل الشاشة على الشاشات الصغيرة فقط (< lg) — مثل التطبيقات الأصلية تماماً:
 *   [ الرئيسية • أهم صفحتين للدور • ملفي الشخصي • المزيد ]
 * «المزيد» يفتح درج التنقل الكامل — كل الصفحات تبقى متاحة كما هي (لا شيء مُزال)
 * للزوار: [ الرئيسية • الأخصائيون • الخدمات • المزيد ] — بوابات الدخول داخل الدرج
 * ✦ يراعي المساحات الآمنة للآيفون (safe-area-inset-bottom) والوضع الليلي والـ RTL/LTR
 */
import { useMemo } from "react";
import { useApp } from "@/lib/app-context";
import { NAV_ITEMS, ROLE_IMPORTANT, type Role, type ViewKey } from "@/lib/nav";
import { NAV_ICONS } from "./sidebar-nav";
import { Home, LayoutGrid, UserRound, LogIn, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { key: string; view: ViewKey | null; label: string; icon: LucideIcon };

export default function BottomTabs({ onMore }: { onMore: () => void }) {
  const { t, me, view, navigate, viewId } = useApp();
  const role: Role = (me?.role as Role) ?? "guest";

  const tabs = useMemo<Tab[]>(() => {
    const byKey = new Map(NAV_ITEMS.map((i) => [i.key, i]));
    const iconOf = (k: ViewKey, fallback: LucideIcon) => {
      const item = byKey.get(k);
      return (item && NAV_ICONS[item.icon]) || fallback;
    };
    const labelOf = (k: ViewKey, fallback: string) => {
      const item = byKey.get(k);
      return item ? t(item.label) : fallback;
    };

    const out: Tab[] = [
      { key: "home", view: "home", label: t("nav.home"), icon: Home },
    ];

    if (role === "guest") {
      /* الزائر: الأخصائيون + الخدمات ثم المزيد (بوابات الدخول داخل الدرج) */
      for (const k of ["specialists", "services"] as ViewKey[]) {
        out.push({ key: k, view: k, label: labelOf(k, k), icon: iconOf(k, Home) });
      }
    } else {
      /* أهم صفحتين للدور — بنفس منطق ROLE_IMPORTANT (القائمة الجانبية لا تتغير) */
      const important = ((ROLE_IMPORTANT as Record<string, ViewKey[]>)[role] || [])
        .filter((k) => byKey.has(k))
        .slice(0, 2);
      for (const k of important) {
        out.push({ key: k, view: k, label: labelOf(k, k), icon: iconOf(k, Home) });
      }
      /* الملف الشخصي — نقطة وصول سريعة مثل التطبيقات */
      out.push({ key: "profile", view: "profile", label: t("nav.profile"), icon: UserRound });
    }

    out.push({ key: "__more", view: null, label: t("nav.more"), icon: LayoutGrid });
    return out;
  }, [role, t, me]);

  const activeOf = (tab: Tab) => {
    if (tab.view === null) return false;
    if (tab.view !== view) return false;
    /* صفحة سجل المريض تُعدّ ضمن «المرضى» — تسجيل الدخول ضمن بواباته */
    if (view === "record") return tab.view === "patients";
    if (view === "login" && tab.key === "__more") return false;
    if (view === "ebook") return tab.view === "ebooks";
    return true;
  };

  return (
    <nav
      aria-label={t("nav.more")}
      className="ait-tabbar fixed inset-x-0 bottom-0 z-40 lg:hidden"
    >
      <div className="mx-auto flex max-w-xl items-stretch justify-around px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const active = activeOf(tab);
          const isMore = tab.view === null;
          const Icon = isMore && view === "login" ? LogIn : tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                if (isMore) onMore();
                else navigate(tab.view as ViewKey, tab.view === "login" ? viewId : undefined);
              }}
              aria-current={active ? "page" : undefined}
              aria-label={tab.label}
              className={cn(
                "group relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5",
                "transition-colors select-none active:scale-[0.94] motion-safe:transition-transform",
              )}
            >
              {/* قرص الأيقونة النشط — مثل iOS/Android */}
              <span
                className={cn(
                  "flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200",
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                    : "text-muted-foreground group-active:bg-muted"
                )}
              >
                <Icon className={cn("transition-transform", active ? "h-5 w-5" : "h-[1.15rem] w-[1.15rem]")} />
              </span>
              <span
                className={cn(
                  "max-w-full truncate text-[10px] leading-none font-bold tracking-tight",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

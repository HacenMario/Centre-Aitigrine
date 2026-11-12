"use client";
/**
 * شريط التطبيق v6 — ★ v3.22.1 تحسينات واجهة التطبيق (بعد المراجعة)
 * ★ زر القائمة (☰) عاد إلى الشريط على الجوال والحاسوب معاً — يفتح درج التنقل الكامل
 * ★ الشعار مع الاسم الكامل (سطرا الاسم والتخصصات) ظاهران على الجوال والحاسوب — كما كان
 *   الحاسوب: الشعار + فاصل أنيق + عنوان الصفحة الحالية (أيقونة + اسم)
 * ★ الشريط الجانبي لم يعد دائماً — يظهر ويختفي بزر القائمة (درج موحّد كل الأجهزة)
 * ★ زر «هام جدا» (تثبيت الموقع كتطبيق + الإشعارات) — كما هو
 * ★ خلفية صلبة غير شفافة دائماً | لا زر دخول في الشريط — بوابات الدخول في درج التنقل
 * نوافذ Radix فوق كل شيء (z-100+) | RTL/LTR عبر الخصائص المنطقية
 */
import { useApp } from "@/lib/app-context";
import { NAV_ITEMS, type ViewKey } from "@/lib/nav";
import { NAV_ICONS } from "./sidebar-nav";
import Logo from "./logo";
import LanguageMenu from "./language-menu";
import NotificationsBell from "./notifications-bell";
import ThemeToggle from "./theme-toggle";
import PwaHelp from "./pwa-help";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Home, LogOut, Menu, TriangleAlert, UserRound, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** عنوان الصفحة الحالية + أيقونتها — أسلوب تطبيق: الشريط يعكس موقعك دائماً */
function useViewMeta(): { title: string; Icon: LucideIcon } {
  const { t, view, viewId } = useApp();
  const item = NAV_ITEMS.find((i) => i.key === view);
  const Icon = (item && NAV_ICONS[item.icon]) || Home;
  let title = item ? t(item.label) : "";
  if (view === "login") {
    const byGate: Record<string, string> = {
      client: t("nav.loginClient"),
      specialist: t("nav.loginSpecialist"),
      admin: t("nav.loginAdmin"),
    };
    title = (viewId && byGate[viewId]) || t("nav.login");
  } else if (view === "record") title = t("nav.record");
  else if (view === "ebook") title = t("nav.ebooks");
  else if (!title) title = t("nav.home");
  return { title, Icon };
}

export default function Header({ onMenu }: { onMenu?: () => void }) {
  const { t, me, logout, navigate, dir } = useApp();
  const [helpOpen, setHelpOpen] = useState(false);
  const { title, Icon } = useViewMeta();

  const doLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    logout();
    toast.success(t("common.logout"));
    navigate("home");
  };

  return (
    <header className="ait-header fixed top-0 inset-x-0 z-40 w-full">
      <div className="mx-auto flex min-h-14 max-w-7xl items-center gap-1 sm:gap-3 px-2 py-2 sm:px-6">
        {/* ★ v3.22.1 زر القائمة (navbar) — على الهاتف والحاسوب معاً: يفتح درج التنقل */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenu}
          className="rounded-full shrink-0"
          aria-label={t("header.menu")}
        >
          <Menu className="h-5.5 w-5.5" />
        </Button>

        {/* ★ الشعار + الاسم الكامل — على الجوال والحاسوب (عادت العبارة المرافقة للوغو) */}
        <div className="min-w-0 flex-1 lg:flex-none">
          <Logo />
        </div>

        {/* الحاسوب: فاصل + عنوان الصفحة الحالية — سياق مكانك مثل التطبيقات */}
        <div className="hidden min-w-0 items-center gap-2.5 lg:flex lg:flex-1 ps-1 sm:ps-2">
          <span className="h-6 w-px shrink-0 bg-border" aria-hidden="true" />
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Icon className="h-4.5 w-4.5" />
          </span>
          <span className="truncate text-base font-black text-foreground">{title}</span>
        </div>

        {/* أدوات التحكم — كما هي تماماً */}
        <div className="flex items-center gap-1 sm:gap-2 ms-auto shrink-0">
          {/* «هام جدا» — دليل التثبيت والإشعارات (نمط طمأنينة) */}
          <Button
            size="sm"
            onClick={() => setHelpOpen(true)}
            title={t("important.title")}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black shadow-md shadow-amber-500/25 hover:from-amber-600 hover:to-orange-600 animate-ait-pulse px-3 h-9"
          >
            <TriangleAlert className="h-4 w-4" />
            <span className="hidden min-[480px]:inline">{t("important.badge")}</span>
          </Button>
          {/* نسخة أيقونة للجوال */}
          <Button
            size="icon"
            onClick={() => setHelpOpen(true)}
            title={t("important.title")}
            aria-label={t("important.title")}
            className="sm:hidden rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25 animate-ait-pulse h-9 w-9"
          >
            <TriangleAlert className="h-4.5 w-4.5" />
          </Button>

          <ThemeToggle />
          <LanguageMenu />
          <NotificationsBell />

          {/* الحساب — بلا زر دخول (بوابات الدخول في درج التنقل) */}
          {me ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 rounded-full ps-1.5 pe-2 sm:ps-2 sm:pe-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-sm font-bold shadow-sm">
                    {me.name?.charAt(0) || "؟"}
                  </span>
                  <span className="hidden md:flex flex-col items-start leading-tight">
                    <span className="text-sm font-semibold max-w-28 break-words leading-tight">{me.name}</span>
                    <span className="text-[11px] text-muted-foreground">{t(`roles.${me.role}`)}</span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl">
                <DropdownMenuLabel>
                  <span className="block break-words font-bold">{me.name}</span>
                  <span className="text-xs text-muted-foreground font-normal" dir="ltr">{me.phone}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("home")}>
                  <Home className="h-4 w-4" /> {t("common.goHome")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("profile")}>
                  <UserRound className="h-4 w-4" /> {t("nav.profile")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={doLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" /> {t("common.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {/* نافذة «هام جدا» — تثبيت الموقع كتطبيق + تفعيل الإشعارات */}
      <PwaHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </header>
  );
}

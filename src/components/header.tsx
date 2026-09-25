"use client";
/**
 * الهيدر v4 — خلفية صلبة غير شفافة دائماً (على أي تمرير)
 * ★ زر «هام جدا» (تثبيت الموقع كتطبيق + تفعيل الإشعارات) — نمط طمأنينة
 * ★ زر الوضع الليلي/النهاري
 * ★ لا زر دخول في الهيدر — بوابات الدخول في القائمة الجانبية
 * الشعار → الرئيسية فوراً | كل الأزرار تنقّل SPA داخلي | نوافذ Radix فوق كل شيء
 */
import { useApp } from "@/lib/app-context";
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
import { Home, LogOut, Menu, TriangleAlert, UserRound } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import SidebarNav from "./sidebar-nav";
import { useState } from "react";
import { toast } from "sonner";

export default function Header() {
  const { t, me, logout, navigate, dir } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const doLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    logout();
    toast.success(t("common.logout"));
    navigate("home");
  };

  return (
    <header className="ait-header fixed top-0 inset-x-0 z-50 w-full">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-1.5 sm:gap-3 px-2.5 py-2 sm:px-6">
        {/* قائمة التنقل — على الهاتف والحاسوب معاً: تظهر فقط بالضغط على زرها
            (منطق موحّد — القائمة الجانبية الثابتة نُزعت عن الحاسوب بطلب المستخدم) */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full shrink-0" aria-label={t("header.menu")}>
              <Menu className="h-5.5 w-5.5" />
            </Button>
          </SheetTrigger>
          <SheetContent side={dir === "rtl" ? "right" : "left"} className="w-[min(21rem,90vw)] p-0">
            {/* pe-14: مسافة آمنة بين الشعار وزر الإغلاق الأنيق (v3.6) */}
            <SheetHeader className="border-b p-4 pe-14">
              <SheetTitle className="text-start">
                {/* الشعار مع النص المرافق (سطرا الاسم) — مثل الهيدر تماماً */}
                <Logo />
              </SheetTitle>
            </SheetHeader>
            {/* تمرير كامل يضمن الوصول لكل محتوى القائمة */}
            <div className="h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain">
              <SidebarNav onNavigate={() => setMenuOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        {/* الشعار — نقرة واحدة → الرئيسية */}
        <div className="min-w-0 flex-1 sm:flex-none">
          <Logo />
        </div>

        {/* أدوات التحكم */}
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

          {/* الحساب — بلا زر دخول (بوابات الدخول في القائمة الجانبية) */}
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

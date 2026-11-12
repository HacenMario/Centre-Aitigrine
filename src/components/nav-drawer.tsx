"use client";
/**
 * ★ v3.22.1 — درج التنقّل الموحّد (الهاتف + الحاسوب)
 * نفس محتوى القائمة الجانبية بالكامل (بوابات الدخول، الصفحات، حجم النص، الإخفاء السريع)
 * يُفتح من زر ☰ في شريط التطبيق (كل الأجهزة) أو تبويب «المزيد» في الشريط السفلي
 * ★ تخطيط مرن: الرأس والتنقل وتوقيع النسخة أعمدة flex — لا حاجة لحسابات ارتفاع هشّة
 * ★ عرض أرحب على الحاسوب (23rem) — إحساس تطبيق سطح مكتب حقيقي
 */
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import SidebarNav from "./sidebar-nav";
import Logo from "./logo";
import { useApp } from "@/lib/app-context";

export default function NavDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t, dir } = useApp();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={dir === "rtl" ? "right" : "left"}
        className="w-[min(21rem,90vw)] sm:w-[22rem] lg:w-[23rem] p-0 gap-0"
      >
        <SheetHeader className="border-b p-4 pe-14">
          <SheetTitle className="text-start">
            {/* الشعار مع الاسم الكامل — مثل شريط التطبيق تماماً */}
            <Logo />
          </SheetTitle>
        </SheetHeader>
        {/* تمرير مرن يضمن الوصول لكل محتوى القائمة — كما كان تماماً */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <SidebarNav onNavigate={() => onOpenChange(false)} />
        </div>
        {/* توقيع النسخة — لمسة تطبيق احترافية ★ v3.22.1 */}
        <div className="shrink-0 border-t px-4 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 text-center">
          <p className="truncate text-[10.5px] font-semibold text-muted-foreground/70">
            {t("app.name")} · v3.22.1
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

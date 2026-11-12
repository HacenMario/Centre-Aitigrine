"use client";
/**
 * ★ v3.22.0 — درج التنقّل (الهاتف/التابلت)
 * نفس محتوى القائمة الجانبية بالكامل (بوابات الدخول، الصفحات، حجم النص، الإخفاء السريع)
 * يُفتح من تبويب «المزيد» في الشريط السفلي — نفس منطق القائمة القديمة دون أي تغيير
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
        className="w-[min(21rem,90vw)] p-0"
      >
        <SheetHeader className="border-b p-4 pe-14">
          <SheetTitle className="text-start">
            <Logo />
          </SheetTitle>
        </SheetHeader>
        {/* تمرير كامل يضمن الوصول لكل محتوى القائمة — كما كان تماماً */}
        <div className="h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain">
          <SidebarNav onNavigate={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

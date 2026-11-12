"use client";
/**
 * ★ v3.22.0 — الشريط الجانبي الدائم (الحاسوب lg+)
 * واجهة تطبيق حقيقية: الشعار في الأعلى، التنقل في الوسط، أسفل ثابت للحساب والإجراءات
 * يعيد استعمال SidebarNav كاملاً — نفس العناصر والترتيب والمنطق دون أي تغيير
 * ثابت في جهة البداية (يمين في RTL / يسار في LTR) مع تمرير مستقل عن المحتوى
 */
import { useApp } from "@/lib/app-context";
import SidebarNav from "./sidebar-nav";
import Logo from "./logo";

export default function AppSidebar() {
  const { t, settings } = useApp();
  return (
    <aside
      aria-label={t("header.menu")}
      className="ait-appside fixed inset-y-0 start-0 z-50 hidden w-[17rem] flex-col lg:flex"
    >
      {/* الشعار — ثابت في رأس الشريط */}
      <div className="flex shrink-0 items-center justify-center border-b px-4 py-3">
        <Logo />
      </div>

      {/* التنقل — تمرير مستقل */}
      <div className="ait-appside-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <SidebarNav />
      </div>

      {/* توقيع النسخة — لمسة تطبيق احترافية */}
      <div className="shrink-0 border-t px-4 py-2.5 text-center">
        <p className="truncate text-[10.5px] font-semibold text-muted-foreground/70">
          {t("app.name")} · v3.22.0
        </p>
        {settings?.centerName ? null : null}
      </div>
    </aside>
  );
}

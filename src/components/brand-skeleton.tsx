"use client";
/**
 * هيكل التحميل الموحّد — شعار المركز نابض + خطوط لمعان (shimmer)
 * يُستخدم عند إقلاع التطبيق وتحميل بيانات الصفحات
 * ★ v3.6: مدمج في كل الصفحات الممكنة —
 *   BrandSkeleton (الشعار) + CardsSkeleton (بطاقات) + RowsSkeleton (قوائم)
 *   + PageSkeleton (شعار مضغوط + شبكة/قائمة) لأي صفحة جلب بيانات
 */
import Image from "next/image";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

export function BrandSkeleton({ label, className, compact }: { label?: string; className?: string; compact?: boolean }) {
  const { settings, t } = useApp();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5",
        compact ? "py-8 gap-4" : "py-16",
        className
      )}
      aria-busy="true"
      role="status"
    >
      <div className="relative">
        <span className={cn("absolute inset-0 rounded-2xl bg-primary/25 animate-ping", compact ? "sm:rounded-2xl" : "sm:rounded-3xl")} aria-hidden="true" />
        <span
          className={cn(
            "relative flex items-center justify-center rounded-2xl bg-background shadow-lg shadow-primary/15 ring-1 ring-primary/20",
            compact ? "h-12 w-12" : "h-16 w-16 sm:h-20 sm:w-20 sm:rounded-3xl"
          )}
        >
          <Image
            src={settings?.logoBase64 || "/logo.png"}
            alt=""
            fill
            sizes="80px"
            className="object-contain p-1.5 animate-pulse"
          />
        </span>
      </div>
      <div className={cn("space-y-2.5", compact ? "w-36" : "w-48")}>
        <div className="ait-shimmer h-3 rounded-full" />
        <div className="ait-shimmer h-3 w-2/3 mx-auto rounded-full" />
      </div>
      <p className={cn("text-muted-foreground font-semibold animate-pulse", compact ? "text-[11px]" : "text-xs")}>
        {label || t("sk.loading")}
      </p>
    </div>
  );
}

export function CardsSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)} aria-busy="true" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-3xl border bg-card p-5 space-y-3 shadow-sm">
          <div className="ait-shimmer h-12 w-12 rounded-2xl" />
          <div className="ait-shimmer h-4 w-3/4 rounded-full" />
          <div className="ait-shimmer h-3 w-full rounded-full" />
          <div className="ait-shimmer h-3 w-2/3 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** v3.6: صفوف قوائم (المواعيد، المرضى، الحسابات…) بشكل يشبه البطاقات الحقيقية */
export function RowsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-3", className)} aria-busy="true" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="ait-shimmer h-14 w-14 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="ait-shimmer h-3.5 w-2/3 rounded-full" />
            <div className="ait-shimmer h-3 w-1/2 rounded-full" />
          </div>
          <div className="ait-shimmer h-8 w-20 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * v3.6: هيكل تحميل صفحة كاملة — شعار المركز مضغوط + بطاقات أو صفوف.
 * يُستخدم في كل صفحة تجلب بيانات (خدمات، تكوينات، إعلانات، مواعيد، مرضى…)
 */
export function PageSkeleton({
  kind = "cards",
  count,
  label,
  className,
}: {
  kind?: "cards" | "rows";
  count?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-5", className)} aria-busy="true" role="status">
      <BrandSkeleton compact label={label} />
      {kind === "cards" ? (
        <CardsSkeleton count={count ?? 6} />
      ) : (
        <RowsSkeleton count={count ?? 4} />
      )}
    </div>
  );
}

export default BrandSkeleton;

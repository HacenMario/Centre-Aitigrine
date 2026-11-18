"use client";
/**
 * ★ v3.26 — الفلترة الذكية المشتركة: صندوق بحث + شارات تصفية
 * نمط موحّد في كل صفحات الموقع (المواعيد، المساعدة، الحسابات، الخدمات،
 * الأخصائيون، الموارد البشرية، التكوينات، الكتب، المقالات)
 */
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function SmartSearch({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0 flex-1 sm:max-w-xs", className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-full border bg-card ps-9 pe-3 text-sm outline-none transition-colors focus:border-primary/50"
      />
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-bold transition-all ring-1 whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground ring-primary shadow-sm shadow-primary/25"
          : "bg-card text-foreground/75 ring-border hover:ring-primary/40 hover:text-primary",
        className
      )}
    >
      {children}
    </button>
  );
}

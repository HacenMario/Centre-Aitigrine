"use client";
/**
 * ترقيم الصفحات الاحترافي — v3.5
 * ★ أزرار سابق/تالي + أرقام صفحات ذكية (تُطوي الصفحات البعيدة بـ …)
 * ★ يحترم اتجاه اللغة RTL/LTR تلقائياً + ملائم للجوّال
 * ★ يُستعمل في كل صفحة قائمة: الخدمات، التكوينات، الكتب، الإعلانات،
 *   الحسابات، المرضى، المواعيد، الاقتراحات
 */
import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

/** صفحات مرقّمة مع طيّ ذكي: 1 … 4 5 6 … 20 */
function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

export function usePaged<T>(items: T[], pageSize: number) {
  const page = useMemo(() => Math.max(1, Math.ceil(items.length / pageSize)), [items.length, pageSize]);
  return { pageCount: page };
}

export default function Pagination({
  page,
  pageCount,
  onPage,
  total,
  pageSize,
  className,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
  total?: number;
  pageSize?: number;
  className?: string;
}) {
  const { t, dir } = useApp();
  const rtl = dir === "rtl";
  if (pageCount <= 1) return null;
  const PrevIcon = rtl ? ChevronRight : ChevronLeft;
  const NextIcon = rtl ? ChevronLeft : ChevronRight;
  const pages = pageList(page, pageCount);
  const from = total !== undefined && pageSize ? (page - 1) * pageSize + 1 : null;
  const to = total !== undefined && pageSize ? Math.min(total, page * pageSize) : null;

  const btn =
    "flex h-9 min-w-9 items-center justify-center rounded-lg border text-sm font-bold transition-colors select-none " +
    "disabled:opacity-40 disabled:pointer-events-none px-2";

  return (
    <nav role="navigation" aria-label={t("pager.label")} className={cn("flex flex-wrap items-center justify-center gap-1.5 pt-2", className)}>
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t("pager.prev")}>
        <PrevIcon className="h-4 w-4" />
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="flex h-9 min-w-6 items-center justify-center text-sm font-bold text-muted-foreground">…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              btn,
              "min-w-9 tabular-nums",
              p === page
                ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25"
                : "bg-card text-foreground/80 hover:bg-primary/10 hover:text-primary"
            )}
          >
            {p}
          </button>
        )
      )}
      <button type="button" className={btn} disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label={t("pager.next")}>
        <NextIcon className="h-4 w-4" />
      </button>
      {total !== undefined && pageSize && (
        <span className="w-full text-center text-[11px] font-semibold text-muted-foreground sm:w-auto sm:ms-2">
          {t("pager.info", { from: String(from), to: String(to), total: String(total) })}
        </span>
      )}
    </nav>
  );
}

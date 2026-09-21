"use client";
/**
 * ساعات الحجز — اختيار بالنقر لا نصاً بفواصل
 * شبكة أوقات من إعدادات المركز؛ النقر يضيف/يزيل الوقت
 */
import { useMemo } from "react";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

export function buildTimeGrid(dayStart: string, dayEnd: string, slotMinutes: number): string[] {
  const [sh, sm] = dayStart.split(":").map(Number);
  const [eh, em] = dayEnd.split(":").map(Number);
  const start = (sh || 9) * 60 + (sm || 0);
  const end = (eh || 17) * 60 + (em || 0);
  const step = Math.max(15, slotMinutes || 60);
  const out: string[] = [];
  for (let m = start; m + step <= end + 0; m += step) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  if (!out.length) out.push(dayStart);
  return out;
}

export default function SlotGrid({
  selected,
  onToggle,
  disabledTimes = [],
  slotMinutes,
}: {
  selected: string[];
  onToggle: (time: string) => void;
  disabledTimes?: string[];
  slotMinutes?: number;
}) {
  const { settings } = useApp();
  const o = settings?.options;
  const grid = useMemo(
    () => buildTimeGrid(o?.dayStart || "09:00", o?.dayEnd || "17:00", slotMinutes ?? o?.slotMinutes ?? 60),
    [o?.dayStart, o?.dayEnd, slotMinutes, o?.slotMinutes]
  );

  return (
    <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
      {grid.map((time) => {
        const sel = selected.includes(time);
        const dis = disabledTimes.includes(time) && !sel;
        return (
          <button
            key={time}
            type="button"
            disabled={dis}
            onClick={() => onToggle(time)}
            aria-pressed={sel}
            className={cn(
              "rounded-xl px-1 py-2.5 text-sm font-semibold tabular-nums transition-all border select-none",
              "min-h-[44px] flex items-center justify-center",
              dis
                ? "bg-muted/50 text-muted-foreground/50 line-through cursor-not-allowed border-transparent"
                : sel
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25 scale-[1.03]"
                  : "bg-card hover:border-primary/50 hover:bg-primary/5 text-foreground border-border"
            )}
          >
            {time}
          </button>
        );
      })}
    </div>
  );
}

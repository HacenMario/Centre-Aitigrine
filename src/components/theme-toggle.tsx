"use client";
/**
 * زر الوضع الليلي/النهاري — يتبدل بين الشمس والقمر مع تجنب وميض الترطيب الأول
 */
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useApp();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const label = isDark ? t("theme.toLight") : t("theme.toDark");

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className="relative h-9 w-9 shrink-0 rounded-full border-primary/25 bg-gradient-to-br from-primary/10 to-accent/15 shadow-sm hover:from-primary/20 hover:to-accent/25 hover:shadow transition-all"
    >
      {/* أيقونتان متراكبتان بدوران ناعم — تمنع أي قفز عند الترطيب */}
      <Sun className={"h-5 w-5 text-primary absolute transition-all duration-300 " + (mounted && isDark ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100")} />
      <Moon className={"h-5 w-5 text-primary absolute transition-all duration-300 " + (mounted && isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0")} />
    </Button>
  );
}

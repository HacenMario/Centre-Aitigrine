"use client";
/**
 * مبدّل اللغة — نمط طمأنينة: زر كرة أرضية يفتح قائمة بكل لغة
 * علم اللغة + الاسم الكامل + مفتاح On/Off (التفعيل للإدارة فقط)
 */
import { useState, useTransition } from "react";
import { useApp, type Lang } from "@/lib/app-context";
import { LANG_FLAGS, LANG_NAMES } from "@/components/tri-input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type LangRow = { key: Lang; name: string; native: string; enabled: boolean };

export default function LanguageMenu() {
  const { lang, setLang, settings, refreshSettings, me, t } = useApp();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<Lang | null>(null);
  const isStaff = !!me && (me.role === "admin" || me.role === "assistant");

  const rows: LangRow[] = [
    { key: "ar", name: LANG_NAMES.ar, native: "Arabic", enabled: true },
    { key: "fr", name: LANG_NAMES.fr, native: "French", enabled: settings?.langFr !== false },
    { key: "en", name: LANG_NAMES.en, native: "English", enabled: settings?.langEn !== false },
    { key: "tr", name: LANG_NAMES.tr, native: "Turkish", enabled: settings?.langTr !== false },
    { key: "es", name: LANG_NAMES.es, native: "Spanish", enabled: settings?.langEs !== false },
  ];

  const toggle = async (r: LangRow, on: boolean) => {
    if (!isStaff || r.key === "ar") return;
    setBusy(r.key);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          r.key === "fr" ? { langFr: on } : r.key === "en" ? { langEn: on } : r.key === "tr" ? { langTr: on } : { langEs: on }
        ),
      });
      if (res.ok) {
        toast.success(`${LANG_FLAGS[r.key]} ${r.name}: ${on ? "On" : "Off"}`);
        startTransition(() => refreshSettings());
        /* إذا عُطّلت اللغة المعروضة حالياً واللغة ليست عربية → رجوع للعربية */
        if (!on && lang === r.key) setLang("ar");
      } else toast.error("✗");
    } catch {
      toast.error("✗");
    }
    setBusy(null);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={t("header.languages")}
          title={t("header.languages")}
          className="relative h-9 w-9 rounded-full border-primary/25 bg-gradient-to-br from-primary/10 to-accent/15 shadow-sm hover:from-primary/20 hover:to-accent/25 hover:shadow transition-all"
        >
          <Globe className="h-5 w-5 text-primary" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-2xl p-1.5">
        <DropdownMenuLabel className="text-start">
          <span className="block text-sm font-bold">🌐 {t("header.languages")}</span>
          <span className="mt-0.5 block text-[11px] font-normal leading-snug text-muted-foreground">
            {t("header.languagesHint")}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {rows.map((r) => {
          const selectable = r.enabled;
          const active = lang === r.key;
          return (
            <DropdownMenuItem
              key={r.key}
              disabled={!selectable || busy === r.key}
              onClick={() => selectable && setLang(r.key)}
              className={cn(
                "gap-2.5 rounded-xl px-2.5 py-2.5",
                !selectable && "opacity-45",
                active && "bg-primary/10"
              )}
            >
              {/* علم اللغة — نمط طمأنينة */}
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl leading-none shadow-sm">
                {LANG_FLAGS[r.key]}
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="text-sm font-bold">{r.name}</span>
                <span className="text-[11px] text-muted-foreground">{r.native}</span>
              </span>
              {/* مفتاح On/Off — للإدارة يفعّل/يعطّل اللغة، للزوار حالة فقط */}
              <span onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={r.enabled}
                  disabled={!isStaff || r.key === "ar" || busy === r.key}
                  onCheckedChange={(v) => toggle(r, v)}
                  aria-label={`${r.name} ${r.enabled ? "On" : "Off"}`}
                  className="scale-90"
                />
              </span>
              {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

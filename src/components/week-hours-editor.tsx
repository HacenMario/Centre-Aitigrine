"use client";
/**
 * محرر ساعات العمل الأسبوعية للأخصائي
 * لكل يوم: انقر على الوقت في الشبكة لإضافته، وانقر على الوسم لإزالته
 */
import { useState } from "react";
import { Clock } from "lucide-react";
import { useApp } from "@/lib/app-context";
import SlotGrid from "./slot-grid";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* أسماء الأيام حسب اللغة (خمس لغات ★ v3.12) */
const DAYS_MAP: Record<string, string[]> = {
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  tr: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
  es: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
};

export default function WeekHoursEditor({
  value,
  onChange,
}: {
  value: Record<string, string[]>;
  onChange: (v: Record<string, string[]>) => void;
}) {
  const { t, lang, dir } = useApp();
  const DAYS = DAYS_MAP[lang] || DAYS_MAP.ar;
  const [day, setDay] = useState("0");

  const toggle = (time: string) => {
    const cur = value[day] || [];
    const next = cur.includes(time) ? cur.filter((x) => x !== time) : [...cur, time].sort();
    onChange({ ...value, [day]: next });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
        <Clock className="h-4 w-4 shrink-0 text-primary" />
        {t("acc.clickToAdd")}
      </p>
      {/* الاتجاه يتبع لغة الواجهة: RTL للعربية و LTR للفرنسية/الإنجليزية */}
      <Tabs value={day} onValueChange={setDay} dir={dir}>
        <TabsList className="w-full h-auto flex-wrap justify-start gap-1 bg-muted/60">
          {DAYS.map((d, i) => (
            <TabsTrigger key={i} value={String(i)} className="gap-1.5 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {d}
              {(value[String(i)]?.length || 0) > 0 && (
                <Badge variant="secondary" className="h-4.5 px-1 text-[10px] tabular-nums">
                  {value[String(i)].length}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {DAYS.map((_, i) => (
          <TabsContent key={i} value={String(i)} className="mt-3 space-y-3">
            <SlotGrid selected={value[String(i)] || []} onToggle={toggle} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

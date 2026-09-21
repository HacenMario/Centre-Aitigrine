"use client";
/**
 * صفحات المحتوى: أسئلة شائعة / عن المركز / الخصوصية / الشروط
 * محتوى افتراضي احترافي ثلاثي اللغة + قابل للتحرير من الإدارة
 */
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { BrandSkeleton } from "@/components/brand-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CircleHelp, Info, ShieldCheck, FileText, type LucideIcon } from "lucide-react";
import type { Navigate, ViewKey } from "@/lib/nav";

type Item = { q?: string; a?: string; title?: string; text?: string };

const META: Record<string, { title: string; sub: string; icon: LucideIcon }> = {
  faq: { title: "fbt.faq", sub: "fbt.faqSub", icon: CircleHelp },
  about: { title: "fbt.about", sub: "fbt.aboutSub", icon: Info },
  privacy: { title: "fbt.privacy", sub: "fbt.privacySub", icon: ShieldCheck },
  terms: { title: "fbt.terms", sub: "fbt.termsSub", icon: FileText },
};

export default function InfoPage({ page, navigate }: { page: ViewKey; navigate: Navigate }) {
  const { t, lang } = useApp();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const meta = META[page] || META.about;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/pages?key=${page}&lang=${lang}`)
      .then((r) => r.json())
      .then((j) => setItems(j.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, lang]);

  const Icon = meta.icon;

  return (
    <div className="mx-auto max-w-3xl space-y-5 w-full">
      <div className="flex items-center gap-2">
        <BackButton onBack={() => navigate("home")} />
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black leading-snug">{t(meta.title)}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{t(meta.sub)}</p>
        </div>
      </div>

      <Card className="rounded-[1.75rem] border shadow-sm overflow-hidden">
        <div className="ait-hero-gradient px-6 py-7 flex items-center gap-4">
          <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Icon className="h-6.5 w-6.5" />
          </span>
          <div className="min-w-0">
            <p className="font-black text-lg leading-snug">{t(meta.title)}</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{t(meta.sub)}</p>
          </div>
        </div>
        <CardContent className="p-5 sm:p-8">
          {loading ? (
            <BrandSkeleton label={t("common.loading")} className="py-8" />
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">
              {t("info.comingSoon")}
            </p>
          ) : page === "faq" ? (
            <Accordion type="single" collapsible className="w-full">
              {items.map((it, i) => (
                <AccordionItem key={i} value={`q${i}`}>
                  <AccordionTrigger className="text-start font-bold leading-relaxed hover:text-primary hover:no-underline">
                    <span className="whitespace-normal">{it.q}</span>
                  </AccordionTrigger>
                  <AccordionContent className="leading-loose whitespace-pre-wrap text-foreground/85">
                    {it.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="space-y-7">
              {items.map((it, i) => (
                <section key={i} className="space-y-2">
                  {it.title && (
                    <h2 className="font-black text-lg text-primary flex items-start gap-2 leading-snug">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
                      <span>{it.title}</span>
                    </h2>
                  )}
                  <p className="leading-loose whitespace-pre-wrap text-foreground/85 ps-4 border-s-2 border-primary/15">
                    {it.text}
                  </p>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

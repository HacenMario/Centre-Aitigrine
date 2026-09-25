"use client";
/**
 * صفحة الأخصائيون — دليل الأخصائيين التابعين للمركز (نمط طمأنينة counselors-directory)
 * بطاقة كاملة لكل أخصائي: صورة، اسم، لقب مهني (مترجم)، التخصصات المرتبطة (مترجمة)،
 * سنوات الخبرة، لغات العمل، نبذة، متوسط التقييم + أزرار: حجز موعد + التقييمات
 */
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { FullAvatar } from "@/components/full-image";
import BackButton from "@/components/back-button";
import { CardsSkeleton } from "@/components/brand-skeleton";
import RatingsDialog, { StarsRow } from "@/components/ratings-dialog";
import Pagination from "@/components/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Stethoscope, Languages, UserRound, CalendarClock, Info, Star, Award,
} from "lucide-react";

type SpecSpecialty = { _id: string; ar: string; fr: string; en: string; builtin?: boolean };
type Spec = {
  _id: string;
  name: string;
  title: string;
  titleFr?: string;
  titleEn?: string;
  specialty: string;
  langs: string[];
  bio: string;
  bioFr?: string;
  bioEn?: string;
  yearsExperience: number;
  specialties: SpecSpecialty[];
  photoBase64: string;
  rating?: { avg: number; count: number };
};

const LANG_LABEL: Record<string, string> = {
  ar: "العربية",
  fr: "Français",
  en: "English",
};

const SPEC_PAGE_SIZE = 8;

export default function Specialists({ navigate }: { navigate?: (v: "appointments", id?: string) => void }) {
  const { t, lang, me } = useApp();
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingFor, setRatingFor] = useState<Spec | null>(null);
  /* ترقيم الصفحات الاحترافي */
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/specialists", { cache: "no-store" });
        const j = await r.json();
        /* الأكثر خبرة أولاً — ثم حسب التقييم (نمط طمأنينة) */
        const list: Spec[] = j.specialists || [];
        list.sort((a, b) => (b.rating?.avg || 0) - (a.rating?.avg || 0) || (b.yearsExperience || 0) - (a.yearsExperience || 0));
        setSpecs(list);
      } catch {}
      setLoading(false);
    })();
  }, []);

  /** اسم التخصص حسب اللغة الحالية */
  const specName = (s: SpecSpecialty) => {
    if (lang === "fr") return s.fr || s.ar;
    if (lang === "en") return s.en || s.ar;
    return s.ar;
  };
  /** اللقب المهني حسب اللغة */
  const specTitle = (sp: Spec) => {
    if (lang === "fr") return sp.titleFr || sp.title || "";
    if (lang === "en") return sp.titleEn || sp.title || "";
    return sp.title || "";
  };
  const specBio = (sp: Spec) => {
    if (lang === "fr") return sp.bioFr || sp.bio || "";
    if (lang === "en") return sp.bioEn || sp.bio || "";
    return sp.bio || "";
  };
  const legacyBadge = (s: string) => {
    if (s === "art_therapy") return t("specialty.art_therapy");
    if (s === "both") return t("specialty.both");
    return t("specialty.psychological");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 min-w-0">
        <BackButton onBack={() => navigate?.("home")} />
        <h1 className="break-words text-xl font-black sm:text-2xl">{t("spec.title")}</h1>
      </div>
      <p className="leading-relaxed text-muted-foreground">{t("spec.sub")}</p>

      {loading ? (
        <CardsSkeleton />
      ) : specs.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="space-y-3 py-14 text-center text-muted-foreground">
            <Stethoscope className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p>{t("spec.empty")}</p>
            {!me && (
              <Button variant="outline" size="sm" onClick={() => navigate?.("login", "admin")} className="gap-2">
                <Info className="h-4 w-4" />
                {t("spec.addHint")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="grid gap-4 sm:grid-cols-2">
          {specs.slice((page - 1) * SPEC_PAGE_SIZE, page * SPEC_PAGE_SIZE).map((sp, i) => (
            <Card
              key={sp._id}
              className="ait-card group overflow-hidden rounded-3xl border shadow-sm"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* v3.6: صورة أكبر تُظهر الأخصائي بشكل مناسب — عمودية على الجوال، صف على الشاشات الأكبر */}
              <div className="ait-hero-gradient flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:items-center sm:text-start">
                <span className="relative h-32 w-32 shrink-0 overflow-hidden rounded-[1.75rem] bg-background shadow-lg ring-2 ring-primary/25 sm:h-36 sm:w-36">
                  {sp.photoBase64 ? (
                    <FullAvatar src={sp.photoBase64} alt={sp.name} className="h-32 w-32 sm:h-36 sm:w-36" rounded="rounded-[1.75rem]" imgClassName="p-2" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-accent/20 text-primary">
                      <UserRound className="h-16 w-16" />
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <h2 className="text-lg font-black leading-snug sm:text-xl">{sp.name}</h2>
                  {specTitle(sp) && <p className="text-[13px] font-semibold text-primary">{specTitle(sp)}</p>}
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    {(sp.rating?.count || 0) > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] font-black text-amber-700 dark:text-amber-400">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span dir="ltr">{sp.rating!.avg.toFixed(1)}</span>
                        <span className="font-normal opacity-70">({sp.rating!.count})</span>
                      </span>
                    ) : null}
                    {(sp.yearsExperience || 0) > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                        <Award className="h-3.5 w-3.5" />
                        {sp.yearsExperience}+ {t("spec.years")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <CardContent className="space-y-3 p-5 pt-4">
                {/* التخصصات المرتبطة — مترجمة حسب لغة المستخدم */}
                {(sp.specialties?.length || 0) > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {sp.specialties.map((s) => (
                      <Badge key={s._id} variant="outline" className="border-primary/25 bg-primary/8 font-semibold text-primary">
                        <Stethoscope className="h-3 w-3" />
                        {specName(s)}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <Badge variant="outline" className="border-primary/30 bg-primary/8 font-bold text-primary">
                    <Stethoscope className="h-3.5 w-3.5" />
                    {legacyBadge(sp.specialty)}
                  </Badge>
                )}
                {specBio(sp) && <p className="text-sm leading-relaxed text-muted-foreground">{specBio(sp)}</p>}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 font-bold text-muted-foreground">
                    <Languages className="h-3.5 w-3.5" />
                    {(sp.langs || []).map((l) => LANG_LABEL[l] || l).join(" · ")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl font-bold"
                    onClick={() => setRatingFor(sp)}
                  >
                    <Star className="h-4 w-4" />
                    {t("rate.button")}
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-xl font-bold shadow-md shadow-primary/20"
                    onClick={() => navigate?.("appointments")}
                  >
                    <CalendarClock className="h-4 w-4" />
                    {t("spec.book")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Pagination page={page} pageCount={Math.max(1, Math.ceil(specs.length / SPEC_PAGE_SIZE))} onPage={setPage} total={specs.length} pageSize={SPEC_PAGE_SIZE} />
        </>
      )}

      {ratingFor && (
        <RatingsDialog
          specialistId={ratingFor._id}
          specialistName={ratingFor.name}
          open={!!ratingFor}
          onOpenChange={(v) => !v && setRatingFor(null)}
        />
      )}
    </div>
  );
}

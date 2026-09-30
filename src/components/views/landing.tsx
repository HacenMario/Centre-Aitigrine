"use client";
/**
 * الرئيسية v4 — الترتيب:
 * هيرو → عدادات حية → لمحة من داخل المركز → لماذا مركز آيت تقرين؟ → خدماتنا
 * → كيف تبدأ → فريق الأخصائيين (تخصصات + تقييمات + خبرة) → تكوينات → دعوة → تواصل
 */
import { useEffect, useState } from "react";
import { useApp, type DayHours } from "@/lib/app-context";
import MediaSlider from "@/components/media-slider";
import StatsBand from "@/components/stats-band";
import AdBanner from "@/components/ad-banner";
import { StarsRow } from "@/components/ratings-dialog";
import { pickTri, triName } from "@/components/tri-input";
import { CardsSkeleton } from "@/components/brand-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Phone, Mail, Clock, ArrowLeft, ArrowRight, Sparkles, GraduationCap,
  ShieldCheck, Palette, BadgeCheck, CalendarClock, UserRoundPlus, CalendarCheck2, HeartHandshake, MessagesSquare, UserRound, Award, Stethoscope, Star,
} from "lucide-react";
import { gmapsEmbed, gmapsLink } from "@/components/map-picker";
import FullImage, { FullAvatar } from "@/components/full-image";
import type { Navigate } from "@/lib/nav";

type Service = {
  _id: string; title: string; titleFr?: string; titleEn?: string;
  description: string; descriptionFr?: string; descriptionEn?: string;
  icon: string; category: string; price: number; durationMin: number; coverBase64?: string;
};
type Course = {
  _id: string; title: string; titleFr?: string; titleEn?: string;
  description: string; descriptionFr?: string; descriptionEn?: string;
  category: string; trainerName: string; price: number; coverBase64?: string;
  capacity: number; enrolledCount?: number;
  sessions: { date: string; start: string; end: string; title: string }[];
};
type SpecSpecialty = { _id: string; ar: string; fr: string; en: string };
type Specialist = {
  _id: string; name: string;
  title: string; titleFr?: string; titleEn?: string;
  specialty: string; langs: string[];
  bio: string; bioFr?: string; bioEn?: string;
  yearsExperience: number;
  specialties: SpecSpecialty[];
  photoBase64: string;
  rating?: { avg: number; count: number };
};

const FEATURES = [
  { icon: MessagesSquare, t: "landing.feat1Title", d: "landing.feat1Desc" },
  { icon: Palette, t: "landing.feat2Title", d: "landing.feat2Desc" },
  { icon: GraduationCap, t: "landing.feat3Title", d: "landing.feat3Desc" },
  { icon: CalendarClock, t: "landing.feat4Title", d: "landing.feat4Desc" },
];

const STEPS = [
  { icon: UserRoundPlus, t: "landing.step1Title", d: "landing.step1Desc" },
  { icon: CalendarCheck2, t: "landing.step2Title", d: "landing.step2Desc" },
  { icon: HeartHandshake, t: "landing.step3Title", d: "landing.step3Desc" },
];

export default function Landing({ navigate }: { navigate: Navigate }) {
  const { t, settings, lang } = useApp();
  const [services, setServices] = useState<Service[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sr, cr, spr] = await Promise.all([fetch("/api/services"), fetch("/api/courses"), fetch("/api/specialists")]);
        const sj = await sr.json();
        const cj = await cr.json();
        const spj = await spr.json();
        setServices((sj.services || []).slice(0, 6));
        setCourses((cj.courses || []).slice(0, 3));
        setSpecialists(spj.specialists || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const s = settings;
  const dir = lang === "ar" ? "rtl" : "ltr";
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;
  const lat = s?.lat || 36.7538;
  const lng = s?.lng || 3.0588;
  const heroSub = s ? pickTri(s as unknown as Record<string, unknown>, "aboutShort", lang) : "";
  const specTitle = (sp: Specialist) => pickTri(sp as unknown as Record<string, unknown>, "title", lang);
  const specBio = (sp: Specialist) => pickTri(sp as unknown as Record<string, unknown>, "bio", lang);
  const specName2 = (x: SpecSpecialty) => triName(x, lang);

  /* v3.5: أوقات العمل لكل يوم من الأسبوع — من الإعدادات الجديدة */
  const dayNames =
    lang === "ar"
      ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
      : lang === "fr"
        ? ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
        : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayHours = (s?.options?.dayHours || {}) as Record<string, DayHours>;
  const hoursOf = (d: number) => {
    const cur = dayHours[String(d)];
    if (cur?.closed) return null;
    return `${cur?.start || s?.options?.dayStart || "09:00"} — ${cur?.end || s?.options?.dayEnd || "17:00"}`;
  };

  return (
    <div className="space-y-12 pb-6 sm:space-y-16">
      {/* ── الشريط الإعلاني الدوّار (نمط طمأنينة) ── */}
      <AdBanner navigate={navigate} />

      {/* ── الهيرو ── */}
      <section className="ait-hero relative overflow-hidden rounded-[2rem] px-5 py-12 text-center sm:px-12 sm:py-16">
        <div className="absolute -top-28 -end-28 h-72 w-72 rounded-full bg-primary/15 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-28 -start-28 h-72 w-72 rounded-full bg-accent/20 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-2xl space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background/80 px-4 py-1.5 text-[13px] font-bold text-primary shadow-sm backdrop-blur">
            <Sparkles className="h-4 w-4" />
            {t("landing.heroBadge")}
          </span>
          <h1 className="text-[1.65rem] font-black leading-[1.5] text-foreground sm:text-4xl sm:leading-[1.45] lg:text-5xl lg:leading-[1.4]">
            {t("landing.heroTitle")}
          </h1>
          <p className="text-[15px] leading-loose text-muted-foreground sm:text-lg">
            {heroSub || t("landing.heroSub")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Button size="lg" onClick={() => navigate("appointments")} className="h-12 rounded-full px-7 text-base shadow-lg shadow-primary/25">
              {t("landing.ctaBook")}
              <Arrow className="h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("courses")} className="h-12 rounded-full bg-background/70 px-7 text-base backdrop-blur">
              {t("landing.ctaCourses")}
            </Button>
          </div>
          {/* شارات الثقة */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-3 text-xs font-bold text-muted-foreground sm:text-[13px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 shadow-sm">
              <BadgeCheck className="h-4 w-4 text-primary" /> {t("landing.trust1")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 shadow-sm">
              <ShieldCheck className="h-4 w-4 text-primary" /> {t("landing.trust2")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 shadow-sm">
              <Sparkles className="h-4 w-4 text-primary" /> {t("landing.trust3")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 shadow-sm">
              <Stethoscope className="h-4 w-4 text-primary" /> {t("landing.orthoBadge")}
            </span>
          </div>
        </div>
      </section>

      {/* ── عدادات حية (تتحدث تلقائياً من قاعدة البيانات) ── */}
      <StatsBand />

      {/* ── لمحة من داخل المركز (قبل «لماذا مركز آيت تقرين؟») ── */}
      <MediaSlider />

      {/* ── لماذا مركز آيت تقرين؟ ── */}
      <section className="space-y-6">
        <div className="mx-auto max-w-xl space-y-1.5 text-center">
          <h2 className="text-2xl font-black sm:text-3xl">{t("landing.featuresTitle")}</h2>
          <p className="text-muted-foreground">{t("landing.featuresSub")}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Card key={i} className="ait-card group rounded-3xl border shadow-sm">
              <CardContent className="space-y-3 p-5 text-center sm:text-start">
                <span className="mx-auto flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/20 text-primary shadow-sm transition-transform group-hover:scale-110 sm:mx-0">
                  <f.icon className="h-6.5 w-6.5" />
                </span>
                <h3 className="text-[15px] font-black leading-snug">{t(f.t)}</h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{t(f.d)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── الخدمات ── */}
      <section className="space-y-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black sm:text-3xl">{t("landing.ourServices")}</h2>
            <p className="mt-1 text-muted-foreground">{t("landing.ourServicesSub")}</p>
          </div>
          <Button variant="ghost" onClick={() => navigate("services")} className="shrink-0 gap-1.5 rounded-full">
            {t("landing.viewAll")}
            <Arrow className="h-4 w-4" />
          </Button>
        </div>
        {loading ? (
          <CardsSkeleton />
        ) : services.length === 0 ? (
          <Card className="rounded-3xl border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground">
              {t("landing.noServices")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((v, i) => (
              <Card
                key={v._id}
                className="ait-card group cursor-pointer rounded-3xl border shadow-sm"
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => navigate("services")}
              >
                <CardContent className="flex items-start gap-4 p-5">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl transition-transform group-hover:scale-110">
                    {v.icon || "✨"}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-base font-bold leading-snug">{pickTri(v as unknown as Record<string, unknown>, "title", lang)}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground break-words whitespace-pre-line">
                      {pickTri(v as unknown as Record<string, unknown>, "description", lang)}
                    </p>
                    <div className="flex items-center gap-2 pt-0.5">
                      {v.price > 0 && (
                        <p className="text-sm font-black text-primary">
                          {v.price.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-DZ")} {lang === "ar" ? "دج" : "DA"}
                        </p>
                      )}
                      {v.durationMin > 0 && <span className="text-xs text-muted-foreground">· {v.durationMin} min</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── كيف تبدأ ── */}
      <section className="space-y-6">
        <div className="mx-auto max-w-xl space-y-1.5 text-center">
          <h2 className="text-2xl font-black sm:text-3xl">{t("landing.stepsTitle")}</h2>
          <p className="text-muted-foreground">{t("landing.stepsSub")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((st, i) => (
            <div key={i} className="relative space-y-3 overflow-hidden rounded-3xl border bg-card p-5 text-center shadow-sm">
              <span className="absolute -top-3 -start-2 select-none text-[5.5rem] font-black leading-none text-primary/6" aria-hidden="true">
                {i + 1}
              </span>
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25">
                <st.icon className="h-6 w-6" />
              </span>
              <h3 className="font-black">{t(st.t)}</h3>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{t(st.d)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── فريق الأخصائيين — التخصصات + التقييم + الخبرة ── */}
      {specialists.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-3">
            <div className="mx-auto max-w-xl space-y-1.5 text-center">
              <h2 className="text-2xl font-black sm:text-3xl">{t("landing.teamTitle")}</h2>
              <p className="text-muted-foreground">{t("landing.teamSub")}</p>
            </div>
            <Button variant="ghost" onClick={() => navigate("specialists")} className="shrink-0 gap-1.5 rounded-full">
              {t("landing.viewAll")}
              <Arrow className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {specialists.slice(0, 6).map((sp) => (
              <Card key={sp._id} className="ait-card overflow-hidden rounded-3xl shadow-sm">
                <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
                  {/* v3.6: صورة أكبر لبطاقة الفريق — تُظهر الأخصائي بشكل مناسب مع تجاوب كامل */}
                  <span className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary/20 to-accent/20 text-primary ring-4 ring-primary/10 sm:h-32 sm:w-32">
                    {sp.photoBase64 ? (
                      <FullAvatar src={sp.photoBase64} alt={sp.name} className="h-28 w-28 sm:h-32 sm:w-32" imgClassName="p-1" />
                    ) : (
                      <UserRound className="h-14 w-14" />
                    )}
                  </span>
                  <div className="space-y-1.5">
                    <h3 className="font-black">{sp.name}</h3>
                    {specTitle(sp) && <p className="text-[13px] font-bold text-primary">{specTitle(sp)}</p>}
                    {/* التخصصات المرتبطة */}
                    {sp.specialties?.length > 0 ? (
                      <div className="flex flex-wrap justify-center gap-1">
                        {sp.specialties.slice(0, 3).map((x) => (
                          <Badge key={x._id} variant="outline" className="border-primary/25 bg-primary/8 px-2 py-0.5 text-[10.5px] font-semibold text-primary">
                            <Stethoscope className="h-2.5 w-2.5" />
                            {specName2(x)}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {/* التقييم + سنوات الخبرة */}
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
                      {(sp.rating?.count || 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-600 dark:text-amber-400">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span dir="ltr">{sp.rating!.avg.toFixed(1)}</span>
                          <span className="font-normal opacity-70">({sp.rating!.count})</span>
                        </span>
                      )}
                      {(sp.yearsExperience || 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                          <Award className="h-3 w-3" />
                          {sp.yearsExperience}+ {t("spec.years")}
                        </span>
                      )}
                    </div>
                    {specBio(sp) && <p className="text-xs leading-relaxed text-muted-foreground break-words whitespace-normal">{specBio(sp)}</p>}
                  </div>
                  {/* ★ v3.13: الحجز المباشر من البطاقة — يفتح نافذة الحجز والأخصائي محدد مسبقاً */}
                  <Button variant="outline" size="sm" onClick={() => navigate("appointments", `spec:${sp._id}`)} className="mt-auto gap-1.5 rounded-full">
                    <CalendarCheck2 className="h-4 w-4" />
                    {t("landing.teamBook")}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── التكوينات ── */}
      <section className="space-y-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-black sm:text-3xl">
              <GraduationCap className="h-7 w-7 text-primary" />
              {t("landing.ourCourses")}
            </h2>
            <p className="mt-1 text-muted-foreground">{t("landing.ourCoursesSub")}</p>
          </div>
          <Button variant="ghost" onClick={() => navigate("courses")} className="shrink-0 gap-1.5 rounded-full">
            {t("landing.viewAll")}
            <Arrow className="h-4 w-4" />
          </Button>
        </div>
        {loading ? (
          <CardsSkeleton />
        ) : courses.length === 0 ? (
          <Card className="rounded-3xl border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground">
              {t("landing.noCourses")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Card
                key={c._id}
                className="ait-card group cursor-pointer overflow-hidden rounded-3xl shadow-sm"
                onClick={() => navigate("courses")}
              >
                <div className="relative h-36">
                  {c.coverBase64 ? (
                    <FullImage src={c.coverBase64} alt={c.title} className="h-36 w-full" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/15 to-accent/15 text-4xl">🎓</span>
                  )}
                </div>
                <CardContent className="space-y-1.5 p-5">
                  <h3 className="font-bold leading-snug">{pickTri(c as unknown as Record<string, unknown>, "title", lang)}</h3>
                  <p className="text-sm text-muted-foreground break-words whitespace-pre-line">
                    {pickTri(c as unknown as Record<string, unknown>, "description", lang)}
                  </p>
                  <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                    {c.sessions?.length > 0 && (
                      <span className="font-semibold text-primary">
                        {c.sessions.length} {t("landing.sessions")}
                      </span>
                    )}
                    {c.trainerName && <span>{c.trainerName}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── دعوة للحجز ── */}
      <section className="ait-cta-band relative overflow-hidden rounded-[2rem] px-6 py-10 text-center text-primary-foreground sm:py-12">
        <div className="relative mx-auto max-w-xl space-y-4">
          <h2 className="text-xl font-black leading-relaxed sm:text-3xl">{t("landing.ctaBandTitle")}</h2>
          <p className="text-sm leading-loose opacity-90 sm:text-base">{t("landing.ctaBandSub")}</p>
          <Button size="lg" variant="secondary" onClick={() => navigate("appointments")}
            className="h-12 rounded-full bg-background px-8 text-base text-foreground shadow-xl hover:bg-background/90">
            {t("landing.ctaBandBtn")}
            <Arrow className="h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* ── تواصل وموقع (Google Maps) ── */}
      <section className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-3xl">
          <CardContent className="space-y-4 p-6">
            <h3 className="flex items-center gap-2 text-lg font-black">
              <Phone className="h-5 w-5 text-primary" />
              {t("landing.contactUs")}
            </h3>
            <div className="space-y-3 text-sm">
              {s?.phone && (
                <a href={`tel:${s.phone}`} className="flex items-center gap-3 transition-colors hover:text-primary">
                  <Phone className="h-4 w-4 shrink-0 text-primary" />
                  <span dir="ltr">{s.phone}</span>
                </a>
              )}
              {s?.email && (
                <a href={`mailto:${s.email}`} className="flex items-center gap-3 transition-colors hover:text-primary">
                  <Mail className="h-4 w-4 shrink-0 text-primary" />
                  <span dir="ltr" className="break-all">{s.email}</span>
                </a>
              )}
              {s?.address && (
                <a
                  href={s?.mapsUrl?.trim() || gmapsLink(lat, lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 text-muted-foreground transition-colors hover:text-primary"
                  title={t("landing.openMap")}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary transition-transform group-hover:scale-110" />
                  <span className="leading-relaxed underline decoration-primary/30 underline-offset-4 group-hover:decoration-primary">{pickTri(s as unknown as Record<string, unknown>, "address", lang)}</span>
                </a>
              )}
              {s?.options && (
                <p className="flex items-start gap-3 text-muted-foreground">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    {/* v3.6: ذكر اليوم الحالي قبل المواقيت — مثال: الإثنين 09:00 — 18:00 */}
                    <span className="font-bold text-foreground">{dayNames[new Date().getDay()]}</span>
                    {hoursOf(new Date().getDay()) ? (
                      <>
                        {" — "}
                        <span dir="ltr" className="tabular-nums">{hoursOf(new Date().getDay())}</span>
                      </>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400"> — {t("contact.closed")}</span>
                    )}
                    <span className="block text-[11px] leading-relaxed mt-0.5">{t("landing.hoursToday")}</span>
                  </span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden rounded-3xl p-0">
          <a
            href={s?.mapsUrl?.trim() || gmapsLink(lat, lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="group/map relative block h-full min-h-56"
          >
            <iframe
              title="Google Maps"
              src={gmapsEmbed(lat, lng, lang)}
              className="h-full min-h-56 w-full border-0 pointer-events-none"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <span className="absolute bottom-3 end-3 flex items-center gap-1 rounded-full bg-background/95 px-3 py-1.5 text-xs font-bold text-primary shadow transition-transform group-hover/map:scale-105">
              <MapPin className="h-3.5 w-3.5" />
              {t("landing.openMap")}
            </span>
          </a>
        </Card>
      </section>
    </div>
  );
}

"use client";
/**
 * الفوتر الاحترافي v6 — يتبع الثيم (فاتح في النهاري / داكن عميق في الليلي)
 * عمودان: العلامة + نبذة + الشبكات | روابط سريعة (صفحتين في السطر بفاصل عمودي)
 * ★ صُقلت عمود «تواصل معنا» بناء على طلب صريح — المعلومات موجودة في بطاقة الرئيسية وصفحة اتصل بنا
 */
import { useApp } from "@/lib/app-context";
import { SocialLinks } from "./social-icons";
import { ArrowUpRight } from "lucide-react";
import type { Navigate } from "@/lib/nav";
import { pickTri } from "@/components/tri-input";

export default function Footer({ navigate }: { navigate?: Navigate }) {
  const { t, settings, lang } = useApp();
  const s = settings;

  /* الصفحات — صفّان في كل سطر مع فاصل عمودي (طلب المستخدم) */
  const quickLinks: { key: Parameters<Navigate>[0]; label: string }[] = [
    { key: "home", label: t("nav.home") },
    { key: "specialists", label: t("nav.specialists") },
    { key: "services", label: t("nav.services") },
    { key: "courses", label: t("nav.courses") },
    { key: "ebooks", label: t("nav.ebooks") },
    { key: "ads", label: t("nav.ads") },
    { key: "feedback", label: t("nav.feedback") },
    { key: "faq", label: t("nav.faq") },
    { key: "about", label: t("nav.about") },
    { key: "privacy", label: t("nav.privacy") },
    { key: "terms", label: t("nav.terms") },
    { key: "contact", label: t("nav.contact") },
  ];

  const centerName =
    lang === "ar"
      ? s?.centerName || t("app.name")
      : pickTri(s as unknown as Record<string, unknown>, "centerName", lang) || t("app.name");
  const tagline = pickTri(s as unknown as Record<string, unknown>, "tagline", lang) || t("app.tagline");

  return (
    <footer className="ait-footer mt-auto w-full">
      {/* الشريط العلوي الملوّن */}
      <div className="ait-footer-top h-1.5 w-full" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1.3fr] lg:gap-14">
          {/* العلامة + نبذة + الشبكات */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {s?.logoBase64 ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={s.logoBase64} alt={centerName} className="h-12 w-12 rounded-2xl bg-background/60 object-contain p-1 ring-1 ring-border" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 font-black text-primary shadow-inner ring-1 ring-primary/25">
                  {centerName.charAt(0)}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-base font-black text-foreground break-words whitespace-normal leading-snug">{centerName}</p>
                <p className="text-[11px] font-semibold text-muted-foreground">{t("app.tagline")}</p>
              </div>
            </div>
            <p className="text-[13px] leading-loose text-muted-foreground">
              {tagline || s?.aboutShort || t("landing.heroSub")}
            </p>
            {s?.social && (
              <SocialLinks social={{ ...s.social, whatsapp: s.whatsapp }} size="h-9 w-9" />
            )}
          </div>

          {/* روابط سريعة — صفحتين في نفس السطر مع فاصل عمودي */}
          <div className="space-y-4">
            <p className="text-sm font-black uppercase tracking-wide text-foreground/90">
              {t("footer.quickLinks")}
            </p>
            <ul className="grid grid-cols-2 gap-x-0 gap-y-0.5">
              {quickLinks.map((l, i) => (
                <li key={l.key} className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => navigate?.(l.key)}
                    className="group flex flex-1 items-center gap-1 py-1.5 pe-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100 rtl:-scale-x-100" />
                    <span className="break-words whitespace-normal leading-snug">{l.label}</span>
                  </button>
                  {/* الفاصل العمودي بين العمودين — غير مرسوم بعد آخر عنصر فردي في السطر الأخير */}
                  {i % 2 === 0 && i < quickLinks.length - 1 && (
                    <span className="w-px bg-border/80" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

      {/* شريط الحقوق */}
      <div className="border-t border-border/70 bg-muted/40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-4 text-center sm:justify-between sm:px-6 sm:text-start">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {centerName} — {t("footer.rights")}
          </p>
          <p className="text-[11px] text-muted-foreground/80">{t("footer.madeWith")}</p>
        </div>
      </div>
    </footer>
  );
}

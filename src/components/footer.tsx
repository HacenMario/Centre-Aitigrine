"use client";
/**
 * ★ v3.22.0 — الفوتر المدمج بأسلوب التطبيقات (App Footer)
 * بدل فوتر المواقع الضخم بروابطه المتكررة (التنقل كله الآن في الشريط الجانبي
 * وشريط التبويبات ودرج المزيد): سطر أنيق واحد يضم العلامة + الشبكات + الحقوق
 * على الجوال: عمود مركزي مدمج — ويحترم مساحة شريط التبويبات السفلي (safe-area)
 */
import { useApp } from "@/lib/app-context";
import { SocialLinks } from "./social-icons";
import { pickTri } from "@/components/tri-input";
import type { Navigate } from "@/lib/nav";

export default function Footer({ navigate }: { navigate?: Navigate }) {
  void navigate; /* محفوظ للتوافق — التنقل انتقل لشريط التطبيق والشريط الجانبي */
  const { t, settings, lang } = useApp();
  const s = settings;

  const centerName =
    lang === "ar"
      ? s?.centerName || t("app.name")
      : pickTri(s as unknown as Record<string, unknown>, "centerName", lang) || t("app.name");

  return (
    <footer className="ait-footer mt-auto w-full pb-[4.75rem] lg:pb-0">
      {/* الشريط العلوي الملوّن — اللمسة الهوية نفسها بلا ثقل */}
      <div className="ait-footer-top h-1 w-full" aria-hidden="true" />

      <div className="mx-auto flex max-w-7xl flex-col items-center gap-2.5 px-4 py-4 sm:flex-row sm:justify-between sm:px-6 sm:py-3.5">
        {/* العلامة المختصرة */}
        <div className="flex items-center gap-2.5 min-w-0">
          {s?.logoBase64 ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={s.logoBase64} alt={centerName} className="h-8 w-8 rounded-xl bg-background/60 object-contain p-0.5 ring-1 ring-border" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 font-black text-primary ring-1 ring-primary/25">
              {centerName.charAt(0)}
            </span>
          )}
          <p className="truncate text-[13px] font-extrabold text-foreground">{centerName}</p>
        </div>

        {/* الشبكات الاجتماعية — إن وُجدت */}
        {s?.social && (
          <div className="order-first sm:order-none">
            <SocialLinks social={{ ...s.social, whatsapp: s.whatsapp }} size="h-8 w-8" />
          </div>
        )}

        {/* الحقوق */}
        <div className="flex flex-col items-center gap-0.5 sm:items-end">
          <p className="text-[11px] font-medium text-muted-foreground">
            © {new Date().getFullYear()} {centerName} — {t("footer.rights")}
          </p>
          <p className="text-[10px] text-muted-foreground/70">{t("footer.madeWith")}</p>
        </div>
      </div>
    </footer>
  );
}

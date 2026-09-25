"use client";
/**
 * نافذة رقم الهاتف الإلزامية لحسابات Google (v3.10.0) — طلب صاحب المركز
 * «رقم الهاتف في هذه الطريقة نص يضعه النظام تلقائياً لكن يجب أن يكون حقيقياً يخص
 *  العميل لضمان التواصل معه — نافذة منبثقة تظهر مباشرة بعد تسجيل الدخول بـ Google
 *  فقط وللمرة الأولى فقط تُلزم العميل على إدخال رقم هاتفه ثم زر حفظ، ويُحفظ
 *  في ملفه مكان الرقم الافتراضي ويبقى دائماً تابعاً لنفس العميل»
 *
 * - تظهر فقط للعميل الذي هاتفه ما يزال الصيغة الداخلية g-<sub> (أول مرة)
 *   — بعد الحفظ يصبح الرقم حقيقياً فلا تعود النافذة أبداً لنفس الحساب.
 * - إلزامية فعلاً: بلا زر إغلاق وبلا نقر خارج وبلا Esc — لا يمكن تجاوزها.
 * - تحقق فوري: 9-15 رقماً مع تطبيع جزائري (+213/00213 → 0) — والخادم يفحص التفرد.
 * - متجاوبة تماماً: لا تتجاوز إطار الشاشة على الحاسوب والجوال.
 */
import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

/** هل الهاتف ما يزال الصيغة الداخلية لحساب Google (g-<sub>)؟ */
export function isPlaceholderPhone(phone?: string | null): boolean {
  return /^g-[A-Za-z0-9_-]{6,}$/.test(String(phone || ""));
}

export default function GooglePhoneDialog() {
  const { t, me, setMe, ready } = useApp();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const mustProvide = !!ready && me?.role === "client" && isPlaceholderPhone(me.phone);
  if (!mustProvide) return null;

  const digits = value.replace(/[\s.\-()]/g, "");
  const valid = /^\+?\d{9,15}$/.test(digits);

  const save = async () => {
    if (!valid) {
      setErr(t("gauth.phoneInvalid"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.user) {
        setMe(j.user);
        toast.success(t("gauth.phoneSaved"), { duration: 6000 });
      } else {
        setErr(j?.error || t("common.error"));
      }
    } catch {
      setErr(t("err.conn"));
    }
    setBusy(false);
  };

  return (
    /* z-[700] فوق كل شيء — إلزامية: لا إغلاق بالنقر خارجها ولا Esc ولا زر × */
    <div
      className="fixed inset-0 z-[700] flex items-center justify-center bg-foreground/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={t("gauth.phoneTitle")}
      onKeyDown={(e) => e.key === "Escape" && e.preventDefault()}
    >
      <div className="w-full max-w-sm rounded-3xl border bg-card shadow-2xl overflow-hidden">
        {/* رأس ملون */}
        <div className="bg-gradient-to-r from-primary to-primary/85 p-5 text-primary-foreground">
          <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
            <Phone className="h-5.5 w-5.5" />
          </span>
          <p className="text-base font-black leading-snug">{t("gauth.phoneTitle")}</p>
          <p className="mt-1 text-xs opacity-90 leading-relaxed">{t("gauth.phoneSub")}</p>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span className="break-words">{t("gauth.phonePrivacy")}</span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="gp-phone" className="text-sm font-bold">{t("gauth.phoneLabel")} *</label>
            <Input
              id="gp-phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              autoComplete="tel"
              autoFocus
              value={value}
              onChange={(e) => { setValue(e.target.value); setErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder={t("gauth.phonePlaceholder")}
              className="h-12 text-center text-lg tracking-wider font-bold"
              maxLength={20}
            />
            {err ? (
              <p className="text-xs font-semibold text-destructive break-words">{err}</p>
            ) : (
              value && valid && <p className="text-xs font-semibold text-emerald-600">✓ {t("gauth.phoneLooksGood")}</p>
            )}
          </div>

          <Button onClick={save} disabled={busy || !valid} className="h-12 w-full rounded-xl gap-2 text-base font-bold">
            {busy ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Phone className="h-4.5 w-4.5" />}
            {busy ? t("common.saving") : t("gauth.phoneSave")}
          </Button>
        </div>
      </div>
    </div>
  );
}

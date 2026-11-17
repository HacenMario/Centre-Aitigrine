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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Phone, ShieldCheck, Loader2, Droplet } from "lucide-react";
import { toast } from "sonner";
import { BLOOD_TYPES } from "@/lib/blood";

/** هل الهاتف ما يزال الصيغة الداخلية لحساب Google (g-<sub>)؟ */
export function isPlaceholderPhone(phone?: string | null): boolean {
  return /^g-[A-Za-z0-9_-]{6,}$/.test(String(phone || ""));
}

export default function GooglePhoneDialog() {
  const { t, me, setMe, ready } = useApp();
  const [value, setValue] = useState("");
  const [bloodType, setBloodType] = useState(""); /* ★ v3.19: إلزامية في إكمال حساب Google */
  const [age, setAge] = useState(""); /* ★ v3.24: سن العميل (اختياري) */
  const [gender, setGender] = useState(""); /* ★ v3.24: جنس العميل (اختياري) */
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const mustProvide = !!ready && me?.role === "client" && isPlaceholderPhone(me.phone);
  if (!mustProvide) return null;

  const digits = value.replace(/[\s.\-()]/g, "");
  const valid = /^\+?\d{9,15}$/.test(digits);
  /* ★ v3.19: لا حفظ دون زمرة دم صحيحة — إكمال الحساب يتطلب الاثنين */
  const bloodOk = BLOOD_TYPES.includes(bloodType as (typeof BLOOD_TYPES)[number]);

  const save = async () => {
    if (!valid) {
      setErr(t("gauth.phoneInvalid"));
      return;
    }
    if (!bloodOk) {
      setErr(t("blood.required"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits, bloodType, age: age === "" ? null : Number(age), gender: gender || null }),
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

          {/* ★ v3.19: زمرة الدم — إلزامية لإكمال حساب عميل Google (مصدرها نفس قاعدة التسجيل الذاتي) */}
          {/* ★ v3.24: سن وجنس العميل — اختياريان في إكمال حساب Google */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="gp-age" className="flex items-center gap-1.5 text-sm font-bold">
                {t("client.age")}
              </label>
              <Input id="gp-age" type="number" min={0} max={120} value={age}
                onChange={(e) => setAge(e.target.value)} className="h-12 tabular-nums" inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="gp-gender" className="flex items-center gap-1.5 text-sm font-bold">
                {t("client.gender")}
              </label>
              <Select value={gender || "none"} onValueChange={setGender}>
                <SelectTrigger id="gp-gender" className="h-12" aria-label={t("client.gender")}>
                  <SelectValue placeholder={t("client.genderSelect")} />
                </SelectTrigger>
                <SelectContent className="z-[710]" position="popper">
                  <SelectItem value="none">{t("client.genderSelect")}</SelectItem>
                  <SelectItem value="male">{t("client.male")}</SelectItem>
                  <SelectItem value="female">{t("client.female")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="gp-blood" className="flex items-center gap-1.5 text-sm font-bold">
              <Droplet className="h-3.5 w-3.5 text-primary" />
              {t("blood.title")} *
            </label>
            <Select value={bloodType || "none"} onValueChange={(v) => { setBloodType(v === "none" ? "" : v); setErr(""); }}>
              <SelectTrigger id="gp-blood" className="h-12" aria-label={t("blood.title")}>
                <SelectValue placeholder={t("blood.select")} />
              </SelectTrigger>
              {/* ★ v3.19.1: z-[710] — بوابة Select تُرسَم في نهاية body بـ z-50 افتراضياً
                  فكانت تسقط خلف النافذة z-[700]؛ رفعها فوقها يُبقي القائمة ظاهرة دائماً */}
              <SelectContent className="z-[710]" position="popper">
                <SelectItem value="none" disabled>{t("blood.select")}</SelectItem>
                {BLOOD_TYPES.map((bt) => (
                  <SelectItem key={bt} value={bt} dir="ltr" className="font-bold">{bt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={save} disabled={busy || !valid || !bloodOk} className="h-12 w-full rounded-xl gap-2 text-base font-bold">
            {busy ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Phone className="h-4.5 w-4.5" />}
            {busy ? t("common.saving") : t("gauth.phoneSave")}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";
/**
 * حقول إدخال نصوص ثلاثية اللغة (عربي / فرنسي / إنجليزي) — نمط موحّد للمنصة كلها
 * ★ لكل لغة مكانها الخاص: ثلاثة حقول مع أعلام اللغات تظهر دائماً معاً
 *   (طلب المستخدم: «حقول إدخال النصوص في كامل المنصة لا يوجد بها مكان خاص بكل لغة»)
 * الإرسال يُلوّح الحقول المترجمة تلقائياً (titleFr, titleEn, ...)
 */
import { useApp, type Lang } from "@/lib/app-context";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const LANG_FLAGS: Record<Lang, string> = { ar: "🇩🇿", fr: "🇫🇷", en: "🇬🇧" };
export const LANG_TAB: Record<Lang, string> = { ar: "ع", fr: "FR", en: "EN" };
export const LANG_NAMES: Record<Lang, string> = { ar: "العربية", fr: "Français", en: "English" };

export type Tri = { ar: string; fr: string; en: string };

/** يبني كائناً ثلاثياً من كائن مسطح (base + suffixes) */
export function triFrom(obj: Record<string, unknown> | undefined | null, base: string): Tri {
  if (!obj) return { ar: "", fr: "", en: "" };
  return {
    ar: String(obj[base] ?? ""),
    fr: String(obj[`${base}Fr`] ?? ""),
    en: String(obj[`${base}En`] ?? ""),
  };
}

/** يفرد الكائن الثلاثي إلى حقول مسطحة: { title, titleFr, titleEn } */
export function flattenTri(base: string, tri: Tri): Record<string, string> {
  return { [base]: tri.ar, [`${base}Fr`]: tri.fr, [`${base}En`]: tri.en };
}

/** يقرأ القيمة المترجمة المناسبة للغة الحالية مع سقوط تلقائي إلى العربية */
export function pickTri(
  obj: Record<string, unknown> | undefined | null,
  base: string,
  lang: string
): string {
  if (!obj) return "";
  const l = (lang === "fr" || lang === "en" ? lang : "ar") as "ar" | "fr" | "en";
  const suffix = l === "ar" ? "" : l === "fr" ? "Fr" : "En";
  const v = String(obj[`${base}${suffix}`] ?? "").trim();
  if (v) return v;
  return String(obj[base] ?? "").trim();
}

/** حقل نصي ثلاثي اللغة */
export function TriInput({
  label, value, onChange, placeholder, required, id,
}: {
  label?: React.ReactNode;
  value: Tri;
  onChange: (v: Tri) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
}) {
  return (
    <TriField
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      id={id}
      kind="input"
    />
  );
}

/** منطقة نص ثلاثية اللغة */
export function TriTextarea({
  label, value, onChange, placeholder, rows = 3, id,
}: {
  label?: React.ReactNode;
  value: Tri;
  onChange: (v: Tri) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
}) {
  return (
    <TriField
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      id={id}
      kind="textarea"
    />
  );
}

function TriField({
  label, value, onChange, placeholder, required, id, rows = 3, kind,
}: {
  label?: React.ReactNode;
  value: Tri;
  onChange: (v: Tri) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
  rows?: number;
  kind: "input" | "textarea";
}) {
  return (
    <div className="space-y-1.5">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <div className="ait-tri space-y-2 rounded-xl border bg-card/40 p-2.5">
        {(["ar", "fr", "en"] as Lang[]).map((l) => (
          <div key={l} className="flex items-start gap-2">
            <span
              className="mt-1.5 flex w-11 shrink-0 items-center justify-center gap-1 rounded-md bg-muted/70 py-1 text-[11px] font-black text-muted-foreground"
              title={LANG_NAMES[l]}
            >
              <span aria-hidden="true">{LANG_FLAGS[l]}</span>
              <span className={l === "ar" ? "" : "tracking-wide"}>{LANG_TAB[l]}</span>
            </span>
            {kind === "input" ? (
              <Input
                id={l === "ar" ? id : undefined}
                dir={l === "ar" ? "rtl" : "ltr"}
                value={value[l]}
                required={required && l === "ar"}
                onChange={(e) => onChange({ ...value, [l]: e.target.value })}
                placeholder={l === "ar" ? placeholder : l === "fr" ? "Français…" : "English…"}
                className="h-10"
              />
            ) : (
              <Textarea
                dir={l === "ar" ? "rtl" : "ltr"}
                rows={rows}
                value={value[l]}
                onChange={(e) => onChange({ ...value, [l]: e.target.value })}
                placeholder={l === "ar" ? placeholder : l === "fr" ? "Français…" : "English…"}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

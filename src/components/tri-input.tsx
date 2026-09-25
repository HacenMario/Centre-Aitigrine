"use client";
/**
 * حقول إدخال نصوص متعددة اللغات — نمط موحّد للمنصة كلها
 * ★ v3.10: خمس لغات كاملة (ع/FR/EN/TR/ES) في كل حقول الإعدادات — طلب صاحب المركز
 *   «إضافة الحقول الخاصة باللغة التركية والإسبانية في كل الحقول مثل اللغات الثلاثة»
 * - الخصائص التي تُخزَّن بخمس لغات (الإعدادات، التخصصات، الاقتباسات): افتراضياً 5 لغات
 * - الخصائص المخزنة ثلاثياً (خدمات/تكوينات/كتب/مقالات — كما هي بلا مساس): مرّر langs={TRI3}
 * الإرسال يفلطح الحقول المترجمة تلقائياً (titleFr, titleEn, titleTr, titleEs, ...)
 */
import { useApp, type Lang } from "@/lib/app-context";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const LANG_FLAGS: Record<Lang, string> = { ar: "🇩🇿", fr: "🇫🇷", en: "🇬🇧", tr: "🇹🇷", es: "🇪🇸" };
export const LANG_TAB: Record<Lang, string> = { ar: "ع", fr: "FR", en: "EN", tr: "TR", es: "ES" };
export const LANG_NAMES: Record<Lang, string> = { ar: "العربية", fr: "Français", en: "English", tr: "Türkçe", es: "Español" };
export const LANG_PLACEHOLDER: Record<Lang, string> = { ar: "…", fr: "Français…", en: "English…", tr: "Türkçe…", es: "Español…" };

/** الخمس لغات الكاملة — الافتراضي للحقول المخزنة خماسياً */
export const TRI5: Lang[] = ["ar", "fr", "en", "tr", "es"];
/** الثلاثية الكلاسيكية — للحقول المخزنة ثلاثياً فقط (خدمات/تكوينات/كتب/مقالات كما هي) */
export const TRI3: Lang[] = ["ar", "fr", "en"];

export type Tri = { ar: string; fr: string; en: string; tr?: string; es?: string };

/** يبني كائناً متعدد اللغات من كائن مسطح (base + suffixes) — يقرأ Tr/Es أيضاً */
export function triFrom(obj: Record<string, unknown> | undefined | null, base: string): Tri {
  if (!obj) return { ar: "", fr: "", en: "" };
  return {
    ar: String(obj[base] ?? ""),
    fr: String(obj[`${base}Fr`] ?? ""),
    en: String(obj[`${base}En`] ?? ""),
    tr: String(obj[`${base}Tr`] ?? ""),
    es: String(obj[`${base}Es`] ?? ""),
  };
}

/** يفرد الكائن إلى حقول مسطحة: { title, titleFr, titleEn, titleTr, titleEs } */
export function flattenTri(base: string, tri: Tri): Record<string, string> {
  return {
    [base]: tri.ar,
    [`${base}Fr`]: tri.fr || "",
    [`${base}En`]: tri.en || "",
    [`${base}Tr`]: tri.tr || "",
    [`${base}Es`]: tri.es || "",
  };
}

/** يقرأ القيمة المترجمة المناسبة للغة الحالية مع سقوط تلقائي: تركي/إسباني → فرنسي → إنجليزي → عربي */
export function pickTri(
  obj: Record<string, unknown> | undefined | null,
  base: string,
  lang: string
): string {
  if (!obj) return "";
  const chain: { l: "ar" | "fr" | "en" | "tr" | "es"; suffix: string }[] =
    lang === "fr" ? [{ l: "fr", suffix: "Fr" }, { l: "en", suffix: "En" }, { l: "ar", suffix: "" }]
    : lang === "en" ? [{ l: "en", suffix: "En" }, { l: "fr", suffix: "Fr" }, { l: "ar", suffix: "" }]
    : lang === "tr" ? [{ l: "tr", suffix: "Tr" }, { l: "fr", suffix: "Fr" }, { l: "en", suffix: "En" }, { l: "ar", suffix: "" }]
    : lang === "es" ? [{ l: "es", suffix: "Es" }, { l: "fr", suffix: "Fr" }, { l: "en", suffix: "En" }, { l: "ar", suffix: "" }]
    : [{ l: "ar", suffix: "" }];
  for (const { suffix } of chain) {
    const v = String(obj[`${base}${suffix}`] ?? "").trim();
    if (v) return v;
  }
  return String(obj[base] ?? "").trim();
}

/** locale كامل لتنسيق التواريخ حسب اللغة الحالية */
export function localeOf(lang: string): string {
  return lang === "ar" ? "ar-DZ" : lang === "fr" ? "fr-FR" : lang === "tr" ? "tr-TR" : lang === "es" ? "es-ES" : "en-GB";
}

/** اسم من كائن { ar, fr, en, tr?, es? } بلغة الواجهة مع سقوط تلقائي ذكي */
export function triName(
  x: { ar?: string; fr?: string; en?: string; tr?: string; es?: string } | null | undefined,
  lang: string
): string {
  if (!x) return "";
  const v = (s?: string) => (s || "").trim();
  if (lang === "tr") return v(x.tr) || v(x.fr) || v(x.en) || v(x.ar);
  if (lang === "es") return v(x.es) || v(x.fr) || v(x.en) || v(x.ar);
  if (lang === "fr") return v(x.fr) || v(x.en) || v(x.ar);
  if (lang === "en") return v(x.en) || v(x.fr) || v(x.ar);
  return v(x.ar) || v(x.fr) || v(x.en);
}

/** حقل نصي متعدد اللغات (خمس لغات افتراضياً — TRI3 للحقول الثلاثية القديمة) */
export function TriInput({
  label, value, onChange, placeholder, required, id, langs = TRI5,
}: {
  label?: React.ReactNode;
  value: Tri;
  onChange: (v: Tri) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
  langs?: Lang[];
}) {
  return (
    <TriField
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      id={id}
      langs={langs}
      kind="input"
    />
  );
}

/** منطقة نص متعددة اللغات (خمس لغات افتراضياً) */
export function TriTextarea({
  label, value, onChange, placeholder, rows = 3, id, langs = TRI5,
}: {
  label?: React.ReactNode;
  value: Tri;
  onChange: (v: Tri) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
  langs?: Lang[];
}) {
  return (
    <TriField
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      id={id}
      langs={langs}
      kind="textarea"
    />
  );
}

function TriField({
  label, value, onChange, placeholder, required, id, rows = 3, kind, langs = TRI5,
}: {
  label?: React.ReactNode;
  value: Tri;
  onChange: (v: Tri) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
  rows?: number;
  kind: "input" | "textarea";
  langs?: Lang[];
}) {
  return (
    <div className="space-y-1.5">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <div className="ait-tri space-y-2 rounded-xl border bg-card/40 p-2.5">
        {langs.map((l) => (
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
                value={value[l] ?? ""}
                required={required && l === "ar"}
                onChange={(e) => onChange({ ...value, [l]: e.target.value })}
                placeholder={l === "ar" ? placeholder : LANG_PLACEHOLDER[l]}
                className="h-10"
              />
            ) : (
              <Textarea
                dir={l === "ar" ? "rtl" : "ltr"}
                rows={rows}
                value={value[l] ?? ""}
                onChange={(e) => onChange({ ...value, [l]: e.target.value })}
                placeholder={l === "ar" ? placeholder : LANG_PLACEHOLDER[l]}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

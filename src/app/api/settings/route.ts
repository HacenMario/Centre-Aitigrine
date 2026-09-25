/**
 * إعدادات المركز
 * GET: للجميع (بدون مفاتيح VAPID السرية) — PUT: الإدارة فقط
 */
import { NextRequest } from "next/server";
import { ok, handle } from "@/lib/api-helpers";
import { Settings } from "@/lib/models";
import { requireUser } from "@/lib/auth";
import { ensureVapidKeys } from "@/lib/push";
import { logAudit } from "@/lib/audit";

/** v3.5: تطبيع التصنيفات متعددة اللغات — النصوص القديمة تصبح { ar } — ★ v3.10: خمس لغات */
type TriCat = { ar: string; fr: string; en: string; tr?: string; es?: string };
function normCats(v: unknown): TriCat[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((c) => {
      if (typeof c === "string") return { ar: c, fr: "", en: "" };
      const o = (c ?? {}) as Record<string, unknown>;
      /* ★ v3.10: تركي/إسباني مع التصنيفات أيضاً */
      return {
        ar: String(o.ar ?? "").trim(),
        fr: String(o.fr ?? "").trim(),
        en: String(o.en ?? "").trim(),
        tr: String(o.tr ?? "").trim(),
        es: String(o.es ?? "").trim(),
      };
    })
    .filter((c) => c.ar);
}
/** تطبيع أوقات الأسبوع — { "0": {start,end,closed}, … } */
function normDayHours(v: unknown): Record<string, { start: string; end: string; closed: boolean }> {
  const out: Record<string, { start: string; end: string; closed: boolean }> = {};
  if (!v || typeof v !== "object") return out;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (!/^[0-6]$/.test(k)) continue;
    const o = (val ?? {}) as Record<string, unknown>;
    const start = String(o.start ?? "").trim();
    const end = String(o.end ?? "").trim();
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) continue;
    out[k] = { start, end: end < start ? start : end, closed: !!o.closed };
  }
  return out;
}

function publicSettings(s: NonNullable<typeof s>) {
  const { vapidPrivate, ...rest } = (s as { vapidPrivate?: string }).vapidPrivate
    ? { ...s.toObject(), vapidPrivate: undefined }
    : s.toObject();
  void vapidPrivate;
  return rest;
}

export async function GET() {
  return handle(async () => {
    await ensureVapidKeys(); // توليد المفاتيح عند أول تشغيل
    let s = await Settings.findOne({ key: "center" });
    if (!s) s = await Settings.create({ key: "center" });
    const pub = publicSettings(s) as Record<string, unknown>;
    /* تطبيع التصنيفات القديمة (نصوص) إلى كائنات ثلاثية اللغة */
    const opts = (pub.options ?? {}) as Record<string, unknown>;
    pub.options = {
      ...opts,
      serviceCategories: normCats(opts.serviceCategories),
      courseCategories: normCats(opts.courseCategories),
      dayHours: normDayHours(opts.dayHours),
    };
    return ok({ settings: pub });
  });
}

export async function PUT(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser(["admin"]);
    let s = await Settings.findOne({ key: "center" });
    if (!s) s = await Settings.create({ key: "center" });
    const b = await req.json().catch(() => ({}));

    const strFields = [
      "centerName",
      "centerNameFr",
      "centerNameEn",
      /* ★ v3.10: تركي/إسباني — كل حقول الواجهة بخمس لغات */
      "centerNameTr",
      "centerNameEs",
      "tagline",
      "taglineFr",
      "taglineEn",
      "taglineTr",
      "taglineEs",
      "aboutShort",
      "aboutShortFr",
      "aboutShortEn",
      "aboutShortTr",
      "aboutShortEs",
      "phone",
      "whatsapp",
      "email",
      "address",
      "addressFr",
      "addressEn",
      "addressTr",
      "addressEs",
      "mapsUrl",
    ] as const;
    for (const f of strFields) if (b[f] !== undefined) s[f] = String(b[f]);
    if (typeof b.lat === "number") s.lat = b.lat;
    if (typeof b.lng === "number") s.lng = b.lng;
    if (typeof b.logoBase64 === "string") s.logoBase64 = b.logoBase64;
    if (typeof b.langFr === "boolean") s.langFr = b.langFr;
    if (typeof b.langEn === "boolean") s.langEn = b.langEn;
    if (typeof b.langTr === "boolean") s.langTr = b.langTr;
    if (typeof b.langEs === "boolean") s.langEs = b.langEs;
    if (b.options) {
      const o = b.options;
      s.options = {
        specialties: Array.isArray(o.specialties) ? o.specialties.map(String) : s.options?.specialties ?? [],
        serviceCategories: Array.isArray(o.serviceCategories) ? (normCats(o.serviceCategories) as never) : s.options?.serviceCategories ?? [],
        courseCategories: Array.isArray(o.courseCategories) ? (normCats(o.courseCategories) as never) : s.options?.courseCategories ?? [],
        slotMinutes: Number(o.slotMinutes) || 60,
        dayStart: String(o.dayStart || "09:00"),
        dayEnd: String(o.dayEnd || "17:00"),
        dayHours: (normDayHours(o.dayHours) as never) ?? s.options?.dayHours ?? {},
      };
    }
    if (b.social) {
      s.social = {
        facebook: String(b.social.facebook || ""),
        instagram: String(b.social.instagram || ""),
        tiktok: String(b.social.tiktok || ""),
        youtube: String(b.social.youtube || ""),
        telegram: String(b.social.telegram || ""),
      };
    }
    if (Array.isArray(b.sliderMedia)) {
      s.sliderMedia = b.sliderMedia
        .filter(
          (m: { type?: string; url?: string; data?: string }) =>
            (m?.type === "image" || m?.type === "video") && (m?.url || m?.data)
        )
        .slice(0, 20)
        .map((m: { type: string; url?: string; data?: string; title?: string }) => ({
          type: m.type as "image" | "video",
          url: String(m.url || ""),
          data: String(m.data || ""),
          title: String(m.title || ""),
        }));
    }
    await s.save();
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "settings.update", "إعدادات المركز", "حفظ الإعدادات");
    return ok({ settings: publicSettings(s) });
  });
}

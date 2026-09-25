/**
 * التخصصات — قائمة دائمة + إضافات الإدارة (خمس لغات)
 * GET: للجميع — POST/PATCH/DELETE: الإدارة
 * ★ v3.10 بطلب صاحب المركز: التعديل والحذف متاحان للجميع بما فيها الافتراضية —
 *   حذف الافتراضية يُسجَّل في الإعدادات (deletedBuiltinSpecialties) فلا تُعاد زرعتها عند الإقلاع
 *   (الرمز الثابت code يحمي الأسماء المعدلة من الاستبدال عند الترقية)
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Specialty, Settings, User } from "@/lib/models";
import { requireUser } from "@/lib/auth";

const CODES: Record<string, string> = {
  "علم النفس الإكلينيكي": "clinical_psychology",
  "الأرطفونية": "orthophony",
  "العلاج النفسي": "psychotherapy",
  "العلاج السلوكي المعرفي": "cbt",
  "الطفولة والمراهقة": "child_adolescent",
  "الاستشارات الأسرية والزوجية": "family_couples",
  "صعوبات التعلم": "learning_disorders",
  "اضطرابات النطق واللغة": "speech_language",
  "التطوير المهاري والتربوي": "skills_development",
  "الاستشارات النفسية عن بُعد": "remote_counseling",
};

export async function GET() {
  return handle(async () => {
    const rows = await Specialty.find({ active: { $ne: false } })
      .sort({ builtin: -1, order: 1, createdAt: 1 })
      .lean<
        {
          _id: unknown;
          name: { ar?: string; fr?: string; en?: string; tr?: string; es?: string };
          builtin?: boolean;
          order?: number;
        }[]
      >();
    return ok({
      specialties: rows.map((s) => ({
        _id: String(s._id),
        ar: s.name?.ar || "",
        fr: s.name?.fr || "",
        en: s.name?.en || "",
        tr: s.name?.tr || "",
        es: s.name?.es || "",
        builtin: !!s.builtin,
        order: s.order ?? 0,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin"]);
    const b = await req.json().catch(() => ({}));
    const ar = String(b.ar || "").trim();
    const fr = String(b.fr || "").trim();
    const en = String(b.en || "").trim();
    const tr = String(b.tr || "").trim();
    const es = String(b.es || "").trim();
    if (!ar) return fail(400, "الاسم بالعربية مطلوب");
    const dup = await Specialty.findOne({ "name.ar": ar }).lean();
    if (dup) return fail(409, "هذا التخصص موجود مسبقاً");
    const last = await Specialty.findOne().sort({ order: -1 }).lean<{ order?: number } | null>();
    const doc = await Specialty.create({
      name: { ar, fr, en, tr, es },
      builtin: false,
      order: (last?.order ?? 0) + 1,
      active: true,
    });
    return ok({ specialty: { _id: String(doc._id), ar, fr, en, tr, es, builtin: false, order: doc.order } });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin"]);
    const b = await req.json().catch(() => ({}));
    const id = String(b._id || "");
    if (!id) return fail(400, "المعرّف مطلوب");
    const doc = await Specialty.findById(id);
    if (!doc) return fail(404, "التخصص غير موجود");
    /* ★ v3.10: الافتراضية قابلة للتعديل مثل غيرها (الرمز الثابت لا يتغير أبداً) */
    const ar = String(b.ar ?? doc.name?.ar ?? "").trim();
    if (!ar) return fail(400, "الاسم بالعربية مطلوب");
    doc.name = {
      ar,
      fr: String(b.fr ?? doc.name?.fr ?? "").trim(),
      en: String(b.en ?? doc.name?.en ?? "").trim(),
      tr: String(b.tr ?? doc.name?.tr ?? "").trim(),
      es: String(b.es ?? doc.name?.es ?? "").trim(),
    };
    await doc.save();
    return ok({
      specialty: {
        _id: String(doc._id),
        ar: doc.name.ar,
        fr: doc.name.fr,
        en: doc.name.en,
        tr: doc.name.tr,
        es: doc.name.es,
        builtin: !!doc.builtin,
      },
    });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin"]);
    const { searchParams } = new URL(req.url);
    const id = String(searchParams.get("id") || "");
    if (!id) return fail(400, "المعرّف مطلوب");
    const doc = await Specialty.findById(id);
    if (!doc) return fail(404, "التخصص غير موجود");
    /* ★ v3.10: حذف الافتراضية مسموح — نسجّل رمزها لكي لا تُعاد زرعتها عند الإقلاع */
    if (doc.builtin) {
      const code = doc.code || CODES[String(doc.name?.ar || "")] || `ar:${String(doc.name?.ar || "").trim()}`;
      let st = await Settings.findOne({ key: "center" });
      if (!st) st = await Settings.create({ key: "center" });
      const list: string[] = Array.isArray(st.options?.deletedBuiltinSpecialties)
        ? [...(st.options!.deletedBuiltinSpecialties as unknown as string[])]
        : [];
      if (!list.includes(code)) list.push(code);
      st.options = { ...(st.options as unknown as Record<string, unknown>), deletedBuiltinSpecialties: list } as never;
      await st.save();
    }
    /* فكّ الارتباط عن الأخصائيين أولاً */
    await User.updateMany({ specialties: id }, { $pull: { specialties: id } });
    await doc.deleteOne();
    return ok();
  });
}

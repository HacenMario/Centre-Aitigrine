/**
 * التخصصات — قائمة دائمة + إضافات الإدارة (ثلاثية اللغة)
 * GET: للجميع — POST/PATCH/DELETE: الإدارة
 * الافتراضية (builtin) لا تُحذف ولا تُعدّل أسماؤها
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Specialty, User } from "@/lib/models";
import { requireUser } from "@/lib/auth";

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
    if (doc.builtin) return fail(403, "التخصصات الافتراضية ثابتة — لا يمكن تعديلها");
    const ar = String(b.ar ?? doc.name.ar).trim();
    if (!ar) return fail(400, "الاسم بالعربية مطلوب");
    doc.name = { ar, fr: String(b.fr ?? doc.name.fr).trim(), en: String(b.en ?? doc.name.en).trim() };
    await doc.save();
    return ok();
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
    if (doc.builtin) return fail(403, "التخصصات الافتراضية دائمة — لا يمكن حذفها");
    /* فكّ الارتباط عن الأخصائيين أولاً */
    await User.updateMany({ specialties: id }, { $pull: { specialties: id } });
    await doc.deleteOne();
    return ok();
  });
}

/** تعديل/حذف/تفعيل حساب — الإدارة فقط (المساعد يفعّل/يعطّل فقط) */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Specialty, User } from "@/lib/models";
import { hashPassword, requireUser, toSafeUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await requireUser(["admin", "assistant"]);
    const { id } = await ctx.params;
    const target = await User.findById(id).lean<{ active?: boolean } | null>();
    if (!target) return fail(404, "الحساب غير موجود");
    const b = await req.json().catch(() => ({}));

    /* المساعد: يغيّر التفعيل فقط */
    if (me.role === "assistant") {
      if (typeof b.active === "boolean") {
        const u = await User.findByIdAndUpdate(id, { $set: { active: b.active } }, { new: true }).lean();
        return ok({ user: u ? toSafeUser(u) : null });
      }
      return fail(403, "المساعد يغيّر التفعيل فقط");
    }

    /* الإدارة: تعديل شامل — findOneAndUpdate (u.save لا يحفظ تعيين Map بشكل موثوق) */
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, string> = {};
    if (b.name !== undefined) $set.name = String(b.name).trim();
    if (b.phone !== undefined) $set.phone = String(b.phone).trim();
    if (b.password) $set.passwordHash = hashPassword(String(b.password));
    if (b.role && ["admin", "assistant", "specialist", "client"].includes(b.role)) $set.role = b.role;
    if (b.specialty !== undefined) $set.specialty = b.specialty;
    if (Array.isArray(b.langs)) $set.langs = b.langs.map(String);
    if (b.title !== undefined) $set.title = String(b.title);
    if (b.titleFr !== undefined) $set.titleFr = String(b.titleFr);
    if (b.titleEn !== undefined) $set.titleEn = String(b.titleEn);
    if (b.bio !== undefined) $set.bio = String(b.bio);
    if (b.bioFr !== undefined) $set.bioFr = String(b.bioFr);
    if (b.bioEn !== undefined) $set.bioEn = String(b.bioEn);
    if (b.yearsExperience !== undefined)
      $set.yearsExperience = Math.max(0, Math.min(70, Math.round(Number(b.yearsExperience) || 0)));
    if (b.specialties !== undefined) {
      /* مراجع تخصصات — نتحقق من وجودها ثم نجمع */
      const ids = Array.isArray(b.specialties) ? b.specialties.map(String).filter(Boolean) : [];
      const valid = await Specialty.find({ _id: { $in: ids } }).select("_id").lean<{ _id: unknown }[]>();
      $set.specialties = valid.map((s) => String(s._id));
    }
    if (typeof b.photoBase64 === "string" && b.photoBase64) $set.photoBase64 = b.photoBase64;
    else if (b.photoBase64 === "") $unset.photoBase64 = "";
    if (b.weeklyHours !== undefined) $set.weeklyHours = b.weeklyHours;
    if (b.assignedSpecialistId !== undefined) $set.assignedSpecialistId = b.assignedSpecialistId || null;
    if (typeof b.active === "boolean") $set.active = b.active;

    if (!Object.keys($set).length && !Object.keys($unset).length)
      return ok({ user: toSafeUser(await User.findById(id).lean()) });

    const update: Record<string, unknown> = Object.keys($unset).length ? { $set, $unset } : { $set };
    const u = await User.findByIdAndUpdate(id, update, { new: true }).lean();
    return ok({ user: u ? toSafeUser(u) : null });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await requireUser(["admin"]);
    const { id } = await ctx.params;
    if (String(me._id) === id) return fail(400, "لا يمكنك حذف حسابك");
    const u = await User.findByIdAndDelete(id);
    if (!u) return fail(404, "الحساب غير موجود");
    return ok();
  });
}

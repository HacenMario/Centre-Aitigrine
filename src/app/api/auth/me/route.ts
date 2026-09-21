/** GET: بياناتي — PATCH: تعديل الملف الشخصي وتغيير كلمة المرور */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { User } from "@/lib/models";
import { hashPassword, requireUser, toSafeUser, verifyPassword } from "@/lib/auth";

export async function GET() {
  return handle(async () => {
    const u = await requireUser();
    return ok({ user: toSafeUser(u) });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { oldPass, newPass, name, bio, title, langs, photoBase64 } = body;

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, string> = {};

    if (oldPass !== undefined || newPass !== undefined) {
      if (!oldPass || !newPass) return fail(400, "أدخل كلمة المرور الحالية والجديدة");
      if (String(newPass).length < 6) return fail(400, "كلمة المرور الجديدة قصيرة (6 أحرف على الأقل)");
      if (!verifyPassword(String(oldPass), me.passwordHash)) return fail(400, "كلمة المرور الحالية غير صحيحة");
      $set.passwordHash = hashPassword(String(newPass));
    }
    if (name) $set.name = String(name).trim();
    if (bio !== undefined) $set.bio = String(bio);
    if (title !== undefined) $set.title = String(title);
    if (Array.isArray(langs)) $set.langs = langs.map(String);
    if (typeof photoBase64 === "string" && photoBase64) $set.photoBase64 = photoBase64;
    else if (photoBase64 === "") $unset.photoBase64 = "";

    if (!Object.keys($set).length && !Object.keys($unset).length)
      return ok({ user: toSafeUser(me) });

    const u = await User.findOneAndUpdate(
      { _id: me._id },
      Object.keys($unset).length ? { $set, $unset } : { $set },
      { new: true }
    ).lean();
    return ok({ user: u ? toSafeUser(u) : toSafeUser(me) });
  });
}

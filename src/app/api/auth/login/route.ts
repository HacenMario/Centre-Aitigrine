/**
 * تسجيل الدخول الموحّد + إنشاء حساب الإدارة الأول (نمط طمأنينة: { ok, user, token })
 * POST { phone, password, name? }
 * إذا لم يوجد أي admin ووُرسل name → يُنشأ حساب الإدارة (تشغيل أول)
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { User } from "@/lib/models";
import { hashPassword, issueToken, toSafeUser, verifyPassword } from "@/lib/auth";
import { ensureVapidKeys } from "@/lib/push";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();

    if (!phone || !password) return fail(400, "يرجى إدخال رقم الهاتف وكلمة المرور");

    /* ── تشغيل أول: لا يوجد أي حساب إدارة ── */
    const anyAdmin = await User.findOne({ role: "admin" }).lean();
    if (!anyAdmin) {
      if (!name) return ok({ needBootstrap: true });
      const admin = await User.create({
        name,
        phone,
        passwordHash: hashPassword(password),
        role: "admin",
        langs: ["ar"],
      });
      ensureVapidKeys().catch(() => {});
      return ok({ user: toSafeUser(admin), token: issueToken(String(admin._id)), bootstrapped: true });
    }

    const user = await User.findOne({ phone }).lean<
      import("@/lib/models").UserDoc | null
    >();
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return fail(401, "رقم الهاتف أو كلمة المرور غير صحيحة");
    }
    if (user.active === false) return fail(403, "حسابك معطّل — تواصل مع الإدارة");

    return ok({ user: toSafeUser(user), token: issueToken(String(user._id)) });
  });
}

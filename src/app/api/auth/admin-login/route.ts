/**
 * بوابة الإدارة — الدخول ببيانات الحساب المحددة مسبقاً في ملف .env
 * POST { phone, password }
 * .env: ADMIN_PHONE / ADMIN_PASSWORD / ADMIN_NAME (اختياري)
 * عند أول دخول ناجح يُنشأ حساب الإدارة في قاعدة البيانات تلقائياً (كلمة المرور تُخزَّن مشفّرة)
 */
import crypto from "crypto";
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { User } from "@/lib/models";
import { createSession, destroySession, hashPassword, toSafeUser } from "@/lib/auth";
import { ensureVapidKeys } from "@/lib/push";
import { logAudit } from "@/lib/audit";

function safeEqual(a: string, b: string): boolean {
  const ba = crypto.createHash("sha256").update(String(a)).digest();
  const bb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ba, bb);
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    if (!phone || !password) return fail(400, "يرجى إدخال رقم الهاتف وكلمة المرور");

    const envPhone = String(process.env.ADMIN_PHONE || "").trim();
    const envPass = String(process.env.ADMIN_PASSWORD || "");
    if (!envPhone || !envPass) {
      return fail(500, "بيانات الإدارة غير مضبوطة — أضف ADMIN_PHONE و ADMIN_PASSWORD في ملف .env ثم أعد تشغيل الموقع");
    }

    if (!safeEqual(phone, envPhone) || !safeEqual(password, envPass)) {
      await logAudit(null, "auth.adminLoginFail", `هاتف: ${phone}`, "بوابة الإدارة — بيانات خاطئة");
      return fail(401, "بيانات الدخول غير صحيحة — تحقّق من ملف .env");
    }

    /* البحث عن حساب الإدارة أو إنشاؤه تلقائياً من بيانات .env */
    let user = await User.findOne({ phone: envPhone });
    if (!user) {
      user = await User.create({
        name: String(process.env.ADMIN_NAME || "إدارة المركز").trim() || "إدارة المركز",
        phone: envPhone,
        passwordHash: hashPassword(envPass),
        role: "admin",
        langs: ["ar"],
      });
      ensureVapidKeys().catch(() => {});
    } else {
      if (user.role !== "admin" && user.role !== "assistant") {
        return fail(409, "هذا الرقم مستعمل بحساب آخر — غيّر ADMIN_PHONE في .env");
      }
      /* مزامنة كلمة المرور مع .env عند تغيّرها */
      const bcrypt = (await import("bcryptjs")).default;
      if (!bcrypt.compareSync(envPass, user.passwordHash)) {
        user.passwordHash = hashPassword(envPass);
        await user.save();
      }
      if (user.active === false) return fail(403, "حساب الإدارة معطّل — فعّله من قاعدة البيانات");
    }

    await destroySession().catch(() => {});
    const token = await createSession(String(user._id));
    await logAudit({ _id: user._id, name: user.name, role: user.role }, "auth.login", `هاتف: ${envPhone}`, "دخول بوابة الإدارة", String(user._id));
    return ok({ user: toSafeUser(user), token });
  });
}

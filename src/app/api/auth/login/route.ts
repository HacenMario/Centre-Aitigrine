/**
 * تسجيل الدخول الموحّد + إنشاء حساب الإدارة الأول (نمط طمأنينة: { ok, user, token })
 * POST { phone, password, name? }
 * إذا لم يوجد أي admin ووُرسل name → يُنشأ حساب الإدارة (تشغيل أول)
 * ★ v3.8: حماية متقدمة — حجب محاولات الدخول المتكررة (5 فشلات → حجب 15 دقيقة)
 *   + سجل تدقيق لكل دخول ناجح أو فاشل أو محجوب أو تشغيل أول
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { User } from "@/lib/models";
import { hashPassword, issueToken, toSafeUser, verifyPassword } from "@/lib/auth";
import { ensureVapidKeys } from "@/lib/push";
import { clientIp, clearLoginFails, loginBlockRemaining, recordLoginFail } from "@/lib/security";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const ip = clientIp(req);

    if (!phone || !password) return fail(400, "يرجى إدخال رقم الهاتف وكلمة المرور");

    /* ── حماية متقدمة: حجب المحاولات المتكررة ── */
    const blockedFor = loginBlockRemaining(phone, ip);
    if (blockedFor > 0) {
      await logAudit(null, "auth.blocked", `هاتف: ${phone}`, `حجب ${blockedFor}s`, ip);
      return fail(
        429,
        `محاولات كثيرة خاطئة — حُجب الدخول مؤقتاً، أعد المحاولة بعد ${Math.ceil(blockedFor / 60)} دقيقة`
      );
    }

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
      await logAudit({ _id: admin._id, name: admin.name, role: "admin" }, "auth.bootstrap", `هاتف: ${phone}`, "إنشاء حساب الإدارة الأول", String(admin._id));
      return ok({ user: toSafeUser(admin), token: issueToken(String(admin._id)), bootstrapped: true });
    }

    const user = await User.findOne({ phone }).lean<
      import("@/lib/models").UserDoc | null
    >();
    if (!user || !verifyPassword(password, user.passwordHash)) {
      const launched = recordLoginFail(phone, ip);
      await logAudit(null, "auth.loginFail", `هاتف: ${phone}`, launched ? "أُطلق الحجب (5 فشلات)" : "فشل دخول", ip);
      return fail(401, launched ? "محاولات كثيرة خاطئة — حُجب الدخول 15 دقيقة" : "رقم الهاتف أو كلمة المرور غير صحيحة");
    }
    if (user.active === false) {
      await logAudit(null, "auth.loginDisabled", `هاتف: ${phone}`, "محاولة دخول لحساب معطل", ip);
      return fail(403, "حسابك معطّل — تواصل مع الإدارة");
    }

    clearLoginFails(phone, ip);
    await logAudit({ _id: user._id, name: user.name, role: user.role }, "auth.login", `هاتف: ${phone}`, "دخول ناجح", String(user._id));
    return ok({ user: toSafeUser(user), token: issueToken(String(user._id)) });
  });
}

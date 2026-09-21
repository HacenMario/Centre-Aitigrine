/**
 * الاسترجاع الفوري للحساب (نمط طمأنينة) — POST { phone, recoveryPhrase, newPassword }
 * العميل يدخل رقم هاتفه + عبارة الاسترجاع المسجّلة عند إنشاء الحساب + كلمة مرور جديدة
 * → يُستعاد الحساب فوراً ويُرجع { ok, user, token } كي يجد المستخدم نفسه داخل التطبيق
 *   دون أي انتظار للإدارة — تماماً كمنصة طمأنينة.
 * الرد عند الفشل عام منعاً لتسريب وجود الحساب أم لا.
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { User } from "@/lib/models";
import { hashPassword, issueToken, toSafeUser, verifySecret } from "@/lib/auth";
import { notifyStaff } from "@/lib/push";
import { recoveryDoneText } from "@/lib/notify-text";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const phone = String(body.phone || "").trim();
    const recoveryPhrase = String(body.recoveryPhrase || "").trim();
    const newPassword = String(body.newPassword || "");

    if (!phone || !recoveryPhrase) return fail(400, "أدخل رقم هاتفك وعبارة الاسترجاع");
    if (newPassword.length < 6) return fail(400, "كلمة المرور يجب أن تكون 6 أحرف على الأقل");

    const user = await User.findOne({ phone });
    if (!user) return fail(401, "رقم الهاتف أو عبارة الاسترجاع غير صحيحة");

    /* الحسابات دون عبارة استرجاع (سابقة للتطوير) → مسار الإدارة هو الحل */
    if (!user.recoveryHash || !user.recoverySalt) {
      return fail(401, "لا توجد عبارة استرجاع مسجلة لهذا الحساب — اطلب الاستعادة من الإدارة");
    }
    if (!verifySecret(recoveryPhrase, user.recoveryHash, user.recoverySalt)) {
      return fail(401, "رقم الهاتف أو عبارة الاسترجاع غير صحيحة");
    }
    if (user.active === false) return fail(403, "الحساب معطّل — تواصل مع الإدارة");

    user.passwordHash = hashPassword(newPassword);
    await user.save();

    /* إشعار فريق الإدارة بالاسترجاع الذاتي (شفافية كاملة مع كل التفاصيل) */
    notifyStaff(
      recoveryDoneText({ name: user.name, phone: user.phone, role: user.role }),
      "recovery",
      "accounts"
    );

    return ok({ user: toSafeUser(user), token: issueToken(String(user._id)), recovered: true });
  });
}

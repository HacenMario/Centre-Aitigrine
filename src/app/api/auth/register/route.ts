/**
 * إنشاء حساب عميل ذاتياً — POST { name, phone, password, recoveryPhrase } → { ok, user, token }
 * عبارة الاسترجاع إلزامية (نمط طمأنينة): يستعيد بها العميل حسابه فورياً دون انتظار الإدارة
 * حسابات الطاقم (إدارة/مساعد/أخصائي) تُنشأ من الإدارة حصراً
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { User } from "@/lib/models";
import { hashPassword, hashSecret, issueToken, toSafeUser } from "@/lib/auth";
import { normalizeBloodType } from "@/lib/blood";
import { notifyStaff, notifyUser } from "@/lib/push";
import { welcomeText, newClientText } from "@/lib/notify-text";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const recoveryPhrase = String(body.recoveryPhrase || "").trim();

    /* ★ v3.19: زمرة الدم إلزامية عند إنشاء حساب عميل — تحقق صارم قبل أي شيء آخر */
    let bloodType: string | null;
    try {
      bloodType = normalizeBloodType(body.bloodType);
    } catch {
      return fail(400, "زمرة الدم غير صحيحة — اختر إحدى الفصائل الثماني");
    }
    if (!bloodType) return fail(400, "زمرة الدم إلزامية عند إنشاء الحساب");

    /* ★ v3.24: سن وجنس العميل — اختياريان، يعطيان الأخصائي نظرة مسبقة حول العميل */
    const ageRaw = Number(body.age);
    const age =
      body.age !== undefined && body.age !== null && body.age !== "" && Number.isFinite(ageRaw)
        ? Math.max(0, Math.min(120, Math.round(ageRaw)))
        : null;
    const gender = body.gender === "male" || body.gender === "female" ? body.gender : null;

    if (name.length < 3) return fail(400, "يرجى إدخال الاسم الكامل");
    if (!/^[0-9+\s-]{8,15}$/.test(phone)) return fail(400, "رقم الهاتف غير صحيح");
    if (password.length < 6) return fail(400, "كلمة المرور يجب أن تكون 6 أحرف على الأقل");
    if (recoveryPhrase.length < 6) return fail(400, "عبارة الاسترجاع يجب أن تكون 6 أحرف على الأقل — ستحتاجها لاستعادة حسابك");

    const exists = await User.findOne({ phone }).lean();
    if (exists) return fail(409, "هذا الرقم مسجّل مسبقاً — جرّب تسجيل الدخول");

    const rec = hashSecret(recoveryPhrase);
    const user = await User.create({
      name,
      phone,
      passwordHash: hashPassword(password),
      recoveryHash: rec.hash,
      recoverySalt: rec.salt,
      role: "client",
      langs: ["ar"],
      bloodType, /* ★ v3.19 */
      age, /* ★ v3.24: سن العميل (اختياري) */
      gender, /* ★ v3.24: جنس العميل (اختياري) */
      active: true,
    });

    /* إشعار ترحيبي للعميل + إشعار فريق الإدارة بانضمام عميل جديد */
    notifyUser(String(user._id), welcomeText({ name: user.name }), "welcome", "home");
    notifyStaff(newClientText({ name: user.name, phone: user.phone }), "account", "accounts");

    return ok({ user: toSafeUser(user), token: issueToken(String(user._id)), registered: true });
  });
}

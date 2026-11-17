/**
 * مفاتيح المرور Passkeys (★ v3.24) — مسار موحد WebAuthn
 * GET    → قائمة مفاتيحي المسجلة (يتطلب توكن)
 * POST   { action: "register-options" }            → خيارات تسجيل مفتاح جديد (يتطلب توكن)
 * POST   { action: "register", response }          → تحقق وحفظ المفتاح (يتطلب توكن)
 * POST   { action: "login-options", phone? }       → خيارات دخول (عام — بمفاتيح الحساب أو أي مفتاح بالجهاز)
 * POST   { action: "login", response }             → تحقق الدخول → { user, token } (نفس شكل دخول كلمة المرور)
 * DELETE { credId }                                → حذف مفتاح من حسابي (يتطلب توكن)
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { User, PasskeyCredential, type PasskeyCredentialDoc } from "@/lib/models";
import { currentUser, issueToken, toSafeUser } from "@/lib/auth";
import {
  registrationOptionsFor, verifyRegistration,
  authenticationOptionsFor, verifyAuthentication,
} from "@/lib/passkey";
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/server";

export const dynamic = "force-dynamic";

/** قائمة مفاتيحي */
export async function GET() {
  return handle(async () => {
    const me = await currentUser();
    if (!me) return fail(401, "انتهت الجلسة — سجّل الدخول من جديد");
    const creds = await PasskeyCredential.find({ userId: me._id }).sort({ createdAt: -1 }).lean<PasskeyCredentialDoc[]>();
    const passkeys = creds.map((c) => ({
      credId: c.credId,
      deviceType: c.deviceType || "singleDevice",
      backedUp: !!c.backedUp,
      label: c.label || "",
      createdAt: c.createdAt,
    }));
    return ok({ passkeys });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "");

    /* ── تسجيل مفتاح جديد — للمسجلين فقط ── */
    if (action === "register-options") {
      const me = await currentUser();
      if (!me) return fail(401, "انتهت الجلسة — سجّل الدخول من جديد");
      const options = await registrationOptionsFor(String(me._id), String(me.phone || me.name));
      return ok({ options });
    }
    if (action === "register") {
      const me = await currentUser();
      if (!me) return fail(401, "انتهت الجلسة — سجّل الدخول من جديد");
      const v = await verifyRegistration(b.response as RegistrationResponseJSON, String(me._id));
      /* ★ v3.24.1: رسالة حسب السبب — انتهاء الصلاحية غير فشل التحقق */
      if (!v.ok || !v.cred) {
        if (v.reason === "challenge")
          return fail(400, "انتهت صلاحية محاولة التفعيل أو تكررت — أعد المحاولة من جديد");
        return fail(400, "تعذر التحقق من استجابة جهازك — تأكد أنك على نفس الموقع ثم أعد المحاولة");
      }
      await PasskeyCredential.findOneAndUpdate(
        { credId: v.cred.credId },
        { ...v.cred, userId: me._id, label: String(b.label || "").slice(0, 80) },
        { upsert: true, new: true }
      );
      return ok({ ok: true });
    }

    /* ── الدخول بمفتاح المرور — عام ── */
    if (action === "login-options") {
      const phone = String(b.phone || "").trim();
      if (phone) {
        const u = await User.findOne({ phone }).lean<{ _id: unknown; active?: boolean } | null>();
        if (!u || u.active === false) return fail(404, "لا حساب بهذا الرقم أو الحساب موقوف");
        const creds = await PasskeyCredential.find({ userId: u._id }).lean<PasskeyCredentialDoc[]>();
        if (!creds.length) return fail(404, "لا مفاتيح مرور مسجلة لهذا الحساب");
        const options = await authenticationOptionsFor(String(u._id), creds.map((c) => c.credId));
        return ok({ options });
      }
      /* دخول بمفتاح مُكتشف من الجهاز (resident key) — بلا تحديد حساب */
      const options = await authenticationOptionsFor("", []);
      return ok({ options });
    }
    if (action === "login") {
      const v = await verifyAuthentication(b.response as AuthenticationResponseJSON);
      if (!v.ok || !v.credId) {
        if (v.reason === "challenge")
          return fail(400, "انتهت صلاحية محاولة الدخول — أعد المحاولة من جديد");
        return fail(400, "تعذر التحقق من المفتاح — أعد المحاولة");
      }
      const cred = await PasskeyCredential.findOne({ credId: v.credId }).lean<PasskeyCredentialDoc | null>();
      if (!cred) return fail(400, "المفتاح غير معروف");
      const u = await User.findById(cred.userId).lean<
        Parameters<typeof toSafeUser>[0] | null
      >();
      if (!u || u.active === false) return fail(403, "الحساب غير متاح");
      /* تحديث العداد (حماية إعادة التشغيل) */
      await PasskeyCredential.updateOne({ credId: v.credId }, { counter: Math.max(0, Number(v.newCounter) || 0) });
      return ok({ user: toSafeUser(u), token: issueToken(String(u._id)) });
    }

    return fail(400, "إجراء غير معروف");
  });
}

/** حذف مفتاح من حسابي */
export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const me = await currentUser();
    if (!me) return fail(401, "انتهت الجلسة — سجّل الدخول من جديد");
    const credId = req.nextUrl.searchParams.get("credId") || "";
    if (!credId) return fail(400, "معرّف المفتاح مطلوب");
    await PasskeyCredential.deleteOne({ credId, userId: me._id });
    return ok();
  });
}

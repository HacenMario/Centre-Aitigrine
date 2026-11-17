/**
 * مفاتيح المرور Passkeys (★ v3.24) — WebAuthn عبر @simplewebauthn
 * الدخول بلا كلمة مرور: بصمة الإصبع / ملامح الوجه / رمز قفل الشاشة
 *
 * — rpID وorigin يُشتقان من ترويسات الطلب نفسها فيعمل الموقع تلقائياً على
 *   centreaitigrine.com وفي المعاينات وعلى localhost بلا أي إعداد يدوي
 * — التحديات لمرة واحدة تُحفظ في MongoDB (صلاحية 5 دقائق) لأن دوال Vercel بلا ذاكرة مشتركة
 * — المفتاح العام فقط يُخزَّن — لا أسرار حساسة
 */
import { headers } from "next/headers";
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { PasskeyCredential, WebauthnChallenge, type PasskeyCredentialDoc } from "./models";

const RP_NAME = "مركز آيت تقرين";
const CHALLENGE_TTL_MS = 5 * 60_000;

/** rpID + origin من ترويسات الطلب — يعمل على أي دومين تلقائياً */
export async function webauthnRP(): Promise<{ rpID: string; origin: string }> {
  const h = await headers();
  const host = String(h.get("x-forwarded-host") || h.get("host") || "localhost:3000").split(",")[0].trim();
  const proto = String(h.get("x-forwarded-proto") || "").split(",")[0].trim()
    || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return { rpID: host.split(":")[0], origin: `${proto}://${host}` };
}

/** حفظ تحدي لمرة واحدة — يمسح المنتهية تلقائياً */
export async function saveChallenge(challenge: string, purpose: "register" | "auth", userId = ""): Promise<void> {
  try {
    await WebauthnChallenge.deleteMany({ expiresAt: { $lt: new Date() } });
    await WebauthnChallenge.create({
      challenge,
      purpose,
      userId,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    });
  } catch (e) {
    /* التحدي الوحيد المكرر نادر — نعيد المحاولة بحذف القديم نفسه */
    try {
      await WebauthnChallenge.findOneAndUpdate(
        { challenge },
        { challenge, purpose, userId, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
        { upsert: true }
      );
    } catch {
      throw e;
    }
  }
}

/** استهلاك التحدي (مرة واحدة) والتحقق من الغرض */
export async function takeChallenge(challenge: string, purpose: "register" | "auth"): Promise<string | null> {
  const c = await WebauthnChallenge.findOneAndDelete({
    challenge: String(challenge || ""),
    purpose,
    expiresAt: { $gt: new Date() },
  }).lean<{ userId?: string } | null>();
  return c ? String(c.userId || "") : null;
}

/* مفتاح عام Uint8Array → base64url للتخزين */
function b64url(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}
function fromB64url(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(String(s), "base64url"));
}

/** خيارات تسجيل مفتاح جديد لمستخدم — مع استثناء مفاتيحه القائمة */
export async function registrationOptionsFor(userId: string, userName: string): Promise<Record<string, unknown>> {
  const { rpID } = await webauthnRP();
  const existing = await PasskeyCredential.find({ userId }).lean<PasskeyCredentialDoc[]>();
  const opts = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new TextEncoder().encode(userId),
    userName,
    userDisplayName: userName,
    attestationType: "none",
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    excludeCredentials: existing.map((c) => ({ id: c.credId, transports: (c.transports || []) as never })),
  });
  await saveChallenge(opts.challenge, "register", userId);
  return opts as unknown as Record<string, unknown>;
}

/** التحقق من تسجيل مفتاح جديد — يعود ببيانات المفتاح للحفظ */
export async function verifyRegistration(
  response: RegistrationResponseJSON,
  userId: string
): Promise<{ ok: boolean; cred?: { credId: string; publicKey: string; counter: number; deviceType: string; backedUp: boolean; transports: string[] } }> {
  const { origin, rpID } = await webauthnRP();
  const expectedChallenge = await takeChallenge(response?.response?.challenge || "", "register");
  if (!expectedChallenge) return { ok: false };
  try {
    const v = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
    if (!v.verified || !v.registrationInfo?.credential) return { ok: false };
    const c = v.registrationInfo.credential;
    return {
      ok: true,
      cred: {
        credId: c.id,
        publicKey: b64url(c.publicKey),
        counter: c.counter || 0,
        deviceType: String(v.registrationInfo.credentialDeviceType || "singleDevice"),
        backedUp: !!v.registrationInfo.credentialBackedUp,
        transports: (c.transports || []) as string[],
      },
    };
  } catch {
    return { ok: false };
  }
}

/** خيارات دخول — بـ phone: مفاتيح الحساب تحديداً؛ بلا: أي مفتاح محفوظ بجهاز المستخدم */
export async function authenticationOptionsFor(userId: string, credIds: string[]): Promise<Record<string, unknown>> {
  const { rpID } = await webauthnRP();
  const opts = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: credIds.map((id) => ({ id, transports: [] as never[] })),
  });
  await saveChallenge(opts.challenge, "auth", userId);
  return opts as unknown as Record<string, unknown>;
}

/** التحقق من محاولة دخول — يعود بمعرّف مفتاح المطابق لتحميل المستخدم */
export async function verifyAuthentication(
  response: AuthenticationResponseJSON
): Promise<{ ok: boolean; credId?: string; newCounter?: number }> {
  const { origin, rpID } = await webauthnRP();
  const expectedChallenge = await takeChallenge(response?.response?.challenge || "", "auth");
  if (!expectedChallenge) return { ok: false };
  const credId = String(response?.id || "");
  const cred = await PasskeyCredential.findOne({ credId }).lean<PasskeyCredentialDoc | null>();
  if (!cred) return { ok: false };
  try {
    const v = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: cred.credId,
        publicKey: fromB64url(cred.publicKey),
        counter: Number(cred.counter) || 0,
        transports: (cred.transports || []) as never,
      },
    });
    if (!v.verified) return { ok: false };
    return { ok: true, credId, newCounter: v.authenticationInfo.newCounter };
  } catch {
    return { ok: false };
  }
}

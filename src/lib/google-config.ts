/**
 * تكوين Google المشترك (v3.9.0) — توكن التوقيع + state الموقّع + دوال الإعداد
 * ★ v3.9.0: state موقّع HMAC نُقل إلى هنا (مكتبة مشتركة) بدل الاستيراد الديناميكي
 *   من مسار مجاور — الاستيراد الديناميكي بين مسارات API يفشل في بناء الإنتاج
 *   وكان يُسقط callback إلى gauth=error دائماً.
 */
import crypto from "crypto";

export function tokenSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.ADMIN_PASSCODE ||
    process.env.VAPID_SUBJECT ||
    "ait-tegrine-center-secret"
  );
}

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** state موقّع HMAC مع صلاحية 10 دقائق — يمنع تزوير الطلب */
export function makeState(): string {
  const payload = Buffer.from(JSON.stringify({ t: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", tokenSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyState(state: string): boolean {
  try {
    if (!state?.includes(".")) return false;
    const [payload, sig] = state.split(".");
    const expected = crypto.createHmac("sha256", tokenSecret()).update(payload).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { t?: number };
    return !!(parsed.t && Date.now() - parsed.t < 10 * 60_000);
  } catch {
    return false;
  }
}

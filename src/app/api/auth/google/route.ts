/**
 * دخول عبر Google OAuth 2.0 (v3.8) — بجانب الدخول التقليدي بالهاتف (لا يُستبدل)
 * GET /api/auth/google          → تحويل 302 إلى موافقة Google (إن كان مُعداً)
 * GET /api/auth/google?config=1 → { configured, clientId? } — الواجهة تفحص بهذا
 *
 * ★ الإعداد: أضف في .env:
 *   GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
 *   GOOGLE_CLIENT_SECRET=xxx
 *   و في Google Cloud Console → Authorized redirect URIs:
 *   https://<your-domain>/api/auth/google/callback
 * بدون الإعداد يظهر الزر معطلاً برسالة واضحة للإدارة — كل شيء آخر يعمل كالمعتاد.
 */
import { NextRequest, NextResponse } from "next/server";
import { ok, handle } from "@/lib/api-helpers";
import crypto from "crypto";
import { tokenSecret } from "@/lib/google-config";

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

export async function GET(req: NextRequest) {
  return handle(async () => {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";

    /* فحص الإعداد للواجهة */
    if (req.nextUrl.searchParams.get("config")) {
      return ok({ configured: !!clientId, clientId: clientId ? clientId.slice(0, 12) + "…" : "" });
    }

    if (!clientId) {
      return NextResponse.json(
        { error: "دخول Google غير مُعد على الخادم — أضف GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET في ملف البيئة" },
        { status: 501 }
      );
    }

    const origin = process.env.PUBLIC_BASE_URL || req.nextUrl.origin;
    const redirectUri = `${origin}/api/auth/google/callback`;
    const state = makeState();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    return NextResponse.redirect(url.toString());
  });
}

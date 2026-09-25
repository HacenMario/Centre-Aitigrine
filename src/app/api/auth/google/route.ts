/**
 * دخول عبر Google OAuth 2.0 (v3.9) — بجانب الدخول التقليدي بالهاتف (لا يُستبدل)
 * GET /api/auth/google          → تحويل 302 إلى موافقة Google (إن كان مُعداً)
 * GET /api/auth/google?config=1 → { configured, clientId? } — الواجهة تفحص بهذا
 *
 * ★ الإعداد (خطوتان):
 *   1) أضف في .env:
 *      GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
 *      GOOGLE_CLIENT_SECRET=xxx
 *   2) في Google Cloud Console → APIs & Services → Credentials → OAuth Client →
 *      «Authorized redirect URIs» أضف نفس الرابط الظاهر في تبويب الأدوات
 *      (النمط: https://<your-domain>/api/auth/google/callback)
 *   ★ خطأ redirect_uri_mismatch يعني أن الرابط في Google Console لا يطابق
 *     الرابط المستعمل فعلياً — الرابط الدقيق يظهر للإدارة في تبويب «الأدوات».
 * بدون الإعداد يظهر الزر معطلاً برسالة واضحة للإدارة — كل شيء آخر يعمل كالمعتاد.
 */
import { NextRequest, NextResponse } from "next/server";
import { ok, handle } from "@/lib/api-helpers";
import { makeState } from "@/lib/google-config";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";

    /* فحص الإعداد للواجهة + redirectUri الدقيق (عام وليس سراً — يشتق من العنوان) */
    if (req.nextUrl.searchParams.get("config")) {
      /* العنوان الفعلي: نفضّل PUBLIC_BASE_URL ثم ترويسة الطلب (يعمل خلف البروكسي/النشر) */
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
      const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
      const base = process.env.PUBLIC_BASE_URL || `${proto}://${host}`;
      const redirectUri = `${base.replace(/\/+$/, "")}/api/auth/google/callback`;
      return ok({
        configured: !!clientId,
        clientId: clientId ? clientId.slice(0, 12) + "…" : "",
        redirectUri,
      });
    }

    if (!clientId) {
      return NextResponse.json(
        { error: "دخول Google غير مُعد على الخادم — أضف GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET في ملف البيئة" },
        { status: 501 }
      );
    }

    /* نفس منطق العنوان أعلاه: env أولاً ثم ترويسات الطلب (يصلح mismatch خلف البروكسي) */
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
    const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const origin = (process.env.PUBLIC_BASE_URL || `${proto}://${host}`).replace(/\/+$/, "");
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

/**
 * Google OAuth callback (v3.8)
 * GET /api/auth/google/callback?code&state
 * 1) يتحقق من state الموقّع
 * 2) يستبدل code بـ access_token ثم يجلب البروفايل (sub/email/name)
 * 3) يجد مستخدماً بـ googleId أو أنشئ عميلاً جديداً (الهاتف صيغة داخلية g-<sub>)
 * 4) يصدر توكن التطبيق نفسه (HMAC) ويعيد التوجيه إلى /?gtoken=<token>
 *    الواجهة تلتقطه عند الإقلاع وتدخل الجلسة كالمعتاد
 */
import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { User } from "@/lib/models";
import { issueToken } from "@/lib/auth";
import { GOOGLE_TOKEN_URL, GOOGLE_USERINFO_URL } from "@/lib/google-config";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

type Ctx = { params: Promise<{}> };

export async function GET(req: NextRequest, _ctx?: Ctx) {
  const base = process.env.PUBLIC_BASE_URL || req.nextUrl.origin;
  const finish = (msgKey: string) =>
    NextResponse.redirect(`${base}/?gauth=${encodeURIComponent(msgKey)}`);

  try {
    const code = req.nextUrl.searchParams.get("code") || "";
    const state = req.nextUrl.searchParams.get("state") || "";
    const err = req.nextUrl.searchParams.get("error");
    if (err) return finish("denied");
    if (!code || !state) return finish("invalid");

    /* تحقق state */
    const { verifyState } = await import("./route");
    if (!verifyState(state)) return finish("invalid");

    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    if (!clientId || !clientSecret) return finish("notconfigured");

    /* استبدال الكود */
    const origin = base;
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return finish("tokenfail");
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) return finish("tokenfail");

    /* البروفايل */
    const profRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profRes.ok) return finish("proffail");
    const prof = (await profRes.json()) as { sub?: string; email?: string; name?: string };
    if (!prof.sub) return finish("proffail");

    /* إيجاد المستخدم أو إنشاؤه (دور عميل) */
    let user = await User.findOne({ googleId: prof.sub });
    if (!user && prof.email) user = await User.findOne({ googleEmail: prof.email });
    if (!user) {
      user = await User.create({
        name: prof.name || prof.email?.split("@")[0] || "مستخدم Google",
        phone: `g-${prof.sub}`, // صيغة داخلية فريدة — الحساب يُدار بالبريد
        passwordHash: cryptoRandom(),
        role: "client",
        langs: ["ar"],
        googleId: prof.sub,
        googleEmail: prof.email || "",
      });
      await logAudit({ _id: user._id, name: user.name, role: user.role }, "auth.googleCreate", `بريد: ${prof.email}`, "حساب جديد عبر Google", String(user._id));
    }
    if (user.active === false) return finish("disabled");
    if (!user.googleId) {
      user.googleId = prof.sub;
      user.googleEmail = prof.email || user.googleEmail || "";
      await user.save();
    }
    await logAudit({ _id: user._id, name: user.name, role: user.role }, "auth.google", `بريد: ${prof.email}`, "دخول ناجح عبر Google", String(user._id));

    const token = issueToken(String(user._id));
    return NextResponse.redirect(`${base}/?gtoken=${encodeURIComponent(token)}`);
  } catch (e) {
    console.error("google callback:", (e as Error)?.message);
    return finish("error");
  }
}

function cryptoRandom(): string {
  return require("crypto").randomBytes(24).toString("hex");
}

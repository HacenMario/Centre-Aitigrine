import { NextResponse } from "next/server";
import { HttpError } from "./auth";
import { connectDB } from "./mongo";

/**
 * ★ v3.17: كاش حافة قصير لمسارات GET العامة التي لا تختلف باختلاف المستخدم
 * - s-maxage=60: Vercel Edge تخدم الزوار المتكررين من الـ CDN بلا استدعاء الدالة
 *   (يقلص Fast Origin Transfer جوهرياً مع الزيارات المتكررة والروبوتات)
 * - stale-while-revalidate=300: تُخدم نسخة حيّة فوراً مع تجديد خلفي — لا انتظار
 * - max-age=0: المتصفح لا يخزّن — كل فتح يتحقق من الحافة فتبقى البيانات حديثة
 * - تعديل الإدارة يظهر خلال ≤60 ثانية كحد أقصى في الواجهة العامة (سلوك CDN قياسي)
 * ⛔ لا يُطبق على المسارات المتغيرة حسب المستخدم (courses/testimonials/ads/ratings…)
 */
export const PUBLIC_EDGE_CACHE =
  "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

/** استجابة موحدة */
export function ok(data: unknown = { ok: true }) {
  return NextResponse.json(data);
}
export function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** غلاف موحد لمسارات API: اتصال DB + ترجمة الأخطاء */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    await connectDB();
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    const msg = (e as Error)?.message || "خطأ غير متوقع";
    console.error("API error:", msg);
    if (msg.includes("ECONNREFUSED") || msg.includes("MONGODB") || msg.includes("timed out")) {
      return fail(503, "تعذر الاتصال بقاعدة البيانات — تحقق من تشغيل MongoDB");
    }
    return fail(500, msg);
  }
}

export function bad(message: string) {
  throw new HttpError(400, message);
}

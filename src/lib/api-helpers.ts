import { NextResponse } from "next/server";
import { HttpError } from "./auth";
import { connectDB } from "./mongo";

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

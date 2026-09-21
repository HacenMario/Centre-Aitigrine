/**
 * مركز أيت تقرين — تهيئات الخادم عند الإقلاع
 * (الاتصال بقاعدة البيانات + توليد مفاتيح VAPID + القوائم المرجعية الدائمة + مجدول التذكيرات)
 * ★ لا بذر بيانات تجريبية — قاعدة نظيفة عند أول تشغيل
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { connectDB } = await import("@/lib/mongo");
    await connectDB();
    const { ensureVapidKeys } = await import("@/lib/push");
    await ensureVapidKeys();
    /* التخصصات الافتراضية الدائمة (قائمة مرجعية — ليست بيانات تجريبية) */
    const { ensureBuiltinSpecialties } = await import("@/lib/seed");
    await ensureBuiltinSpecialties();
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  } catch (e) {
    console.error("⚠️ instrumentation:", (e as Error).message);
  }
}

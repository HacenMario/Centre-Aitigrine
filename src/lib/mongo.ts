/**
 * مركز أيت تقرين — اتصال MongoDB (mongoose)
 * MONGODB_URI في .env — الافتراضي: mongodb://127.0.0.1:27017/ait_tegrine
 */
import mongoose from "mongoose";
import { Appointment } from "@/lib/models";

export const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ait_tegrine";

const g = globalThis as unknown as { _aitMongo?: Promise<typeof mongoose> };

/* ★ v3.21.3: مزامنة فهارس المواعيد — إصلاح خطأ E11000 عند تأكيد الحجز
 * ١) إسقاط الفهرس القديم الشامل date_1_time_1_specialistId_1 (كان فريداً بغضّ
 *    النظر عن الحالة → الموعد المكتمل/الملغى يحجب فتحته للأبد والفاتح الجديد
 *    يُقتل بخطأ DB خام رغم أن الواجهة تعرض الفتحة متاحة)
 * ٢) بناء uniq_active_slot الجزئي (الحالات النشطة فقط pending/confirmed)
 * تنفيذ محصّن: يجرَّب مرة عند أول اتصال ولا يُعطِّل الإقلاع أبداً —
 * وعلى نسخ MongoDB أقدم من 6.3 يبقى فحص التصادم التطبيقي خط الدفاع (وهو قائم). */
async function syncAppointmentIndexes(m: typeof mongoose): Promise<void> {
  try {
    const dropped = await Appointment.syncIndexes();
    if (Array.isArray(dropped) && dropped.length)
      console.log("🧹 فهارس مواعيد قديمة أُسقطت:", dropped.join(", "));
    const names = (await Appointment.listIndexes()).map((i) => i.name);
    if (names.includes("uniq_active_slot"))
      console.log("🛡️ فهرس الفتحات النشطة جاهز (uniq_active_slot)");
  } catch (e) {
    console.error("⚠️ مزامنة فهارس المواعيد (غير معطِّلة):", (e as Error)?.message);
  }
}

export function connectDB(): Promise<typeof mongoose> {
  if (!g._aitMongo) {
    mongoose.set("strictQuery", true);
    g._aitMongo = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 6000,
        autoIndex: true,
      })
      .then(async (m) => {
        console.log("🗄️  MongoDB متصل بنجاح");
        await syncAppointmentIndexes(m);
        return m;
      })
      .catch((e) => {
        g._aitMongo = undefined;
        console.error("❌ فشل الاتصال بـ MongoDB — تحقق من MONGODB_URI:", e.message);
        throw e;
      });
  }
  return g._aitMongo;
}

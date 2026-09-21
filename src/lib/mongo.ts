/**
 * مركز أيت تقرين — اتصال MongoDB (mongoose)
 * MONGODB_URI في .env — الافتراضي: mongodb://127.0.0.1:27017/ait_tegrine
 */
import mongoose from "mongoose";

export const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ait_tegrine";

const g = globalThis as unknown as { _aitMongo?: Promise<typeof mongoose> };

export function connectDB(): Promise<typeof mongoose> {
  if (!g._aitMongo) {
    mongoose.set("strictQuery", true);
    g._aitMongo = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 6000,
        autoIndex: true,
      })
      .then((m) => {
        console.log("🗄️  MongoDB متصل بنجاح");
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

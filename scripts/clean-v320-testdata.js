/**
 * تنظيف بيانات اختبار v3.20 العالقة — حسابا العميلتين الثابتتين + طلباتهما
 * (سكربت test-v320.sh لا ينظف بعده؛ إعادة تشغيله تتطلب قاعدة نظيفة لهذين الرقمين)
 */
const mongoose = require("mongoose");

const MONGO = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aitigrine";
const PHONES = ["0550000221", "0550000222"];

(async () => {
  await mongoose.connect(MONGO);
  const db = mongoose.connection.db;

  const users = await db.collection("users").find({ phone: { $in: PHONES } }).toArray();
  const ids = users.map((u) => u._id);
  console.log("test users found:", users.map((u) => u.phone).join(", ") || "none");

  if (ids.length) {
    const ords = await db.collection("ebookorders").deleteMany({ clientId: { $in: ids } });
    console.log("ebook orders deleted:", ords.deletedCount);
    const nots = await db.collection("notifications").deleteMany({ userId: { $in: ids } });
    console.log("notifications deleted:", nots.deletedCount);
    const ans = await db.collection("ebookanswers").deleteMany({ clientId: { $in: ids } });
    console.log("ebook answers deleted:", ans.deletedCount);
    const us = await db.collection("users").deleteMany({ _id: { $in: ids } });
    console.log("users deleted:", us.deletedCount);
  }

  /* طلبات اختبار قديمة بلا مستخدم (احتياط) */
  const left = await db.collection("ebookorders").deleteMany({});
  console.log("stray ebook orders deleted:", left.deletedCount);

  await mongoose.disconnect();
  console.log("CLEAN DONE");
})().catch((e) => {
  console.error("CLEAN FAILED:", e.message);
  process.exit(1);
});

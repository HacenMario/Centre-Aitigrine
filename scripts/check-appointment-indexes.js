/** التحقق المباشر من فهارس مجموعة appointments */
const mongoose = require("mongoose");
(async () => {
  await mongoose.connect("mongodb://127.0.0.1:27017/aitigrine");
  const col = mongoose.connection.collection("appointments");
  const ix = await col.listIndexes().toArray();
  console.log("الفهارس الفعلية على appointments:");
  ix.forEach((i) => console.log("  -", i.name, i.unique ? "(unique)" : "", i.partialFilterExpression ? "partial=" + JSON.stringify(i.partialFilterExpression) : ""));
  const docs = await col.find({}).toArray();
  console.log("عدد المواعيد:", docs.length, "الحالات:", docs.map((d) => d.status).join(","));
  const legacy = ix.find((i) => i.name === "date_1_time_1_specialistId_1");
  console.log(legacy ? "❌ الفهرس القديم ما زال موجوداً!" : "✅ الفهرس القديم الشامل أُسقط");
  const active = ix.find((i) => i.name === "uniq_active_slot");
  console.log(active ? "✅ uniq_active_slot موجود وجاهز" : "❌ uniq_active_slot مفقود!");
  await mongoose.disconnect();
  process.exit(legacy ? 1 : active ? 0 : 2);
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });

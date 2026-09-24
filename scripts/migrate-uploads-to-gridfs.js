/**
 * ترحيل وسائط uploads/ القديمة إلى GridFS — لمرة واحدة (v3.7.1)
 * ═══════════════════════════════════════════════════════════════
 * لماذا؟ الملفات القديمة كانت تُحفظ على القرص بجانب الكود، وبيئات
 * الاستضافة السحابية (Serverless) للقراءة فقط ولا تحتفظ بها.
 * بعد الترقية تُحفظ الوسائط في MongoDB (GridFS) — هذا السكربت ينقل
 * الملفات الموجودة مسبقاً حتى تبقى روابطها /api/media/... تعمل.
 *
 * التشغيل (من مجلد المشروع، مع تشغيل MongoDB):
 *   MONGODB_URI="mongodb://127.0.0.1:27017/ait_tegrine" node scripts/migrate-uploads-to-gridfs.js
 *
 * آمن للتكرار (idempotent): يتخطى أي ملف موجود مسبقاً في GridFS.
 */
const fs = require("fs");
const path = require("path");
const { MongoClient, GridFSBucket } = require("mongodb");

const URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ait_tegrine";
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const BUCKET = "media";

const MIME_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

function human(n) {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + "MB";
  if (n >= 1024) return (n / 1024).toFixed(0) + "KB";
  return n + "B";
}

(async () => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log("لا يوجد مجلد uploads/ — لا شيء للترحيل ✅");
    process.exit(0);
  }
  const names = fs.readdirSync(UPLOADS_DIR).filter((f) =>
    /^[A-Za-z0-9._-]+$/.test(f)
  );

  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 6000 });
  await client.connect();
  const db = client.db();
  const bucket = new GridFSBucket(db, { bucketName: BUCKET });

  const existing = new Set(
    (await db.collection(`${BUCKET}.files`).find({}, { projection: { filename: 1 } }).toArray())
      .map((d) => d.filename)
  );

  let migrated = 0, skipped = 0, failed = 0, unsupported = 0;

  for (const name of names) {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    const mime = MIME_BY_EXT[ext];
    if (!mime) { unsupported++; continue; }
    if (existing.has(name)) {
      console.log(`⏭️  موجود مسبقاً — تخطي: ${name} (${human(fs.statSync(path.join(UPLOADS_DIR, name)).size)})`);
      skipped++;
      continue;
    }
    try {
      const buf = fs.readFileSync(path.join(UPLOADS_DIR, name));
      await new Promise((resolve, reject) => {
        const up = bucket.openUploadStream(name, { contentType: mime });
        up.on("finish", resolve);
        up.on("error", reject);
        up.end(buf);
      });
      console.log(`✅ ترحيل: ${name} (${human(buf.length)}) → GridFS`);
      migrated++;
    } catch (e) {
      console.error(`❌ فشل: ${name} — ${e.message}`);
      failed++;
    }
  }

  const total = await db.collection(`${BUCKET}.files`).countDocuments();
  console.log("─".repeat(50));
  console.log(`النتيجة: ترحيل ${migrated} — تخطي ${skipped} — غير مدعوم ${unsupported} — فشل ${failed}`);
  console.log(`إجمالي الوسائط في GridFS الآن: ${total} ملف (قاعدة: ${db.databaseName})`);
  if (migrated > 0) {
    console.log("💡 ملاحظة: يمكن الآن حذف ملفات uploads/ من القرص بأمان بعد التأكد من عمل المعرض.");
  }
  await client.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("فشل الاتصال بقاعدة البيانات — تحقق من MONGODB_URI:", e.message);
  process.exit(1);
});

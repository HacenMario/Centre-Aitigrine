/**
 * مخزن وسائط المركز — GridFS في MongoDB (v3.7.1)
 * ★ سبب التغيير: بيئات الاستضافة السحابية (Serverless/Lambda) تجعل مجلد التطبيق
 *   للقراءة فقط — كان رفع الصور/الفيديو يفشل بالخطأ:
 *   "EROFS: read-only file system, open '/var/task/uploads/…'"
 * ★ الحل: حفظ الملفات داخل MongoDB عبر GridFS —
 *   - تعمل في أي بيئة (محلية أو سحابية) بلا مجلدات كتابة
 *   - الملفات دائمة تُحفظ مع قاعدة البيانات (لا تضيع مع إعادة النشر)
 *   - تدعم الملفات الأكبر من 16MB عبر التقسيم التلقائي لقطع 255KB
 *   - الروابط تبقى كما هي /api/media/<name> — لا تغيير في الواجهة ولا في البيانات
 * الملفات القديمة المرفوعة على القرص (بيئة محلية سابقة) تُقرأ كخطة بديلة تلقائياً.
 */
import { GridFSBucket } from "mongodb";
import { connectDB } from "./mongo";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

const BUCKET_NAME = "media";

/** حاوية GridFS لوسائط المركز (كائن خفيف — يُنشأ عند كل طلب على الاتصال المشترك) */
export async function mediaBucket(): Promise<GridFSBucket> {
  const conn = await connectDB();
  const db = conn.connection?.db;
  if (!db) throw new Error("قاعدة البيانات غير مهيأة — تعذر الوصول إلى GridFS");
  return new GridFSBucket(db, { bucketName: BUCKET_NAME });
}

/** حفظ ملف في GridFS */
export async function putMedia(name: string, buf: Buffer, contentType: string): Promise<void> {
  const bucket = await mediaBucket();
  /* ★ v3.10: حذف أي نسخ سابقة بنفس الاسم أولاً — كان GridFS يراكم تكرارات
     والقراءة (limit:1) قد تعيد النسخة القديمة! */
  try {
    const old = await bucket.find({ filename: name }, { limit: 20 }).toArray();
    for (const f of old) {
      try { await bucket.delete(f._id); } catch {}
    }
  } catch {}
  await new Promise<void>((resolve, reject) => {
    const up = bucket.openUploadStream(name, { contentType });
    up.on("finish", () => resolve());
    up.on("error", reject);
    up.end(buf);
  });
}

/** معلومات ملف في GridFS — حجمه بالبايت، أو null إن لم يوجد */
export async function mediaMeta(
  name: string
): Promise<{ size: number; contentType: string } | null> {
  const bucket = await mediaBucket();
  const files = await bucket
    .find({ filename: name }, { limit: 1 })
    .toArray();
  if (!files.length) return null;
  return { size: files[0].length, contentType: files[0].contentType || "" };
}

/** فتح ملف من GridFS كتدفق — يدعم مجالاً اختيارياً (نمط HTTP الشامل start..end) */
export async function openMedia(
  name: string,
  startInclusive?: number,
  endInclusive?: number
): Promise<ReadableStream> {
  const bucket = await mediaBucket();
  /* نهاية GridFS حصرية (exclusive) — نحوّلها من نمط HTTP الشامل */
  const opts: { start: number; end?: number } = { start: startInclusive ?? 0 };
  if (typeof endInclusive === "number") opts.end = endInclusive + 1;
  const node = bucket.openDownloadStreamByName(name, opts);
  /* تجاهل انقطاع العميل — يمنع أعطال unhandled error */
  node.on("error", () => node.destroy());
  return Readable.toWeb(node) as unknown as ReadableStream;
}

/* ─────────────── v3.18: إدارة الوسائط المخزنة ─────────────── */

export type MediaFileRow = {
  name: string;
  size: number;
  contentType: string;
  date: string; // ISO
};

/** قائمة كل ملفات GridFS مرتبة من الأكبر — تبويب «الوسائط المخزنة» */
export async function listMedia(): Promise<MediaFileRow[]> {
  const bucket = await mediaBucket();
  const files = await bucket.find({}).sort({ length: -1 }).toArray();
  return files.map((f) => ({
    name: f.filename,
    size: f.length || 0,
    contentType: f.contentType || "",
    date: f.uploadDate ? new Date(f.uploadDate).toISOString() : "",
  }));
}

/**
 * حذف ملف من GridFS باسمه — v3.18
 * bucket.delete الرسمي ينظف media.files + كل قطعه في media.chunks معاً بلا بقايا.
 * يعيد البايتات المحررة، أو null إن لم يوجد الملف.
 * ⛔ الاستدعاء مسؤولية المسار: يجب فحص scanMediaUsage أولاً ورفض الملفات المستخدمة.
 */
export async function deleteMediaByName(name: string): Promise<number | null> {
  const bucket = await mediaBucket();
  const files = await bucket.find({ filename: name }).toArray();
  if (!files.length) return null;
  let freed = 0;
  for (const f of files) {
    freed += f.length || 0;
    await bucket.delete(f._id);
  }
  return freed;
}

/* ───────── خطة بديلة: الملفات القديمة على القرص (توافق رجعي فقط) ───────── */

export function diskMediaStat(name: string): fs.Stats | null {
  try {
    return fs.statSync(path.join(process.cwd(), "uploads", name));
  } catch {
    return null;
  }
}

export function openDiskMedia(
  name: string,
  startInclusive?: number,
  endInclusive?: number
): ReadableStream {
  const full = path.join(process.cwd(), "uploads", name);
  const node = fs.createReadStream(full, {
    start: startInclusive ?? 0,
    ...(typeof endInclusive === "number" ? { end: endInclusive } : {}),
  });
  node.on("error", () => node.destroy());
  return Readable.toWeb(node) as unknown as ReadableStream;
}

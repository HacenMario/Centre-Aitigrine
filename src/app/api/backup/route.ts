/**
 * نسخ احتياطي بضغطة واحدة (v3.20.1 — إعادة بناء جذرياية) — للإدارة فقط
 *
 * ★ سبب إعادة البناء: النسخة القديمة (v3.8) كانت تبث ZIP مباشرة في استجابة HTTP.
 *   على الاستضافة السحابية (Vercel Serverless) يُقطع البث عند حد حجم الاستجابة
 *   (~4.5MB) أو عند مهلة الدالة — ومع قاعدة بيانات حقيقية (عشرات الميغاوات مع الوسائط)
 *   كان التنزيل يفشل دائماً في منتصف البث فيرى المستخدم رسالة
 *   «تعذر الاتصال بالخادم — تحقق من اتصالك» رغم سلامة الشبكة تماماً.
 *
 * ★ الحل — دورة من مرحلتين تمر بأي حدود سيرفلِس:
 *   POST /api/backup                 → يبني ZIP كاملاً داخل GridFS في حاوية منفصلة
 *                                      "backups" (غير عامة أبداً — لا يخدمها /api/media)
 *                                      ببناء ثابت الذاكرة (مؤشرات batches بدل toArray الضخمة)
 *                                      ويعيد JSON: { fileId, name, size, parts }
 *   GET  /api/backup?file=<id>&part=N → يعيد الجزء N بترميز base64 (≤2.5MB لكل استجابة)
 *                                      العميل يلحم الأجزاء في ملف ZIP واحد ويحفظه محلياً
 *                                      — سلوك الزر أمام المستخدم كما هو تماماً.
 *
 * محتويات النسخة: backup/database/<collection>.json (مصفوفات JSON كاملة)
 *               + backup/media/* (ملفات GridFS الأصلية) + backup/media/index.json
 *               + backup/README.txt (تقرير النسخة)
 * نظافة تلقائية: تُحفظ آخر نسختين فقط في القاعدة وتُحذف الأقدم.
 */
import { NextResponse } from "next/server";
import { fail, handle, ok } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { mediaBucket } from "@/lib/media-store";
import { ZipArchive } from "archiver";
import { GridFSBucket, ObjectId, type Db } from "mongodb";
import { PassThrough } from "stream";

export const runtime = "nodejs";
export const maxDuration = 300;

const BACKUP_BUCKET = "backups";
/** حجم جزء التنزيل بالبايت (2.5MB) — base64 ≈ 3.35MB داخل JSON — هامش مريح دون حدود الاستجابة */
const PART_BYTES = 2.5 * 1024 * 1024;
/** عدد النسخ المحفوظة في القاعدة قبل الحذف التلقائي */
const KEEP_BACKUPS = 2;

function dbOf(conn: unknown): Db | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((conn as any)?.connection?.db as Db) || null;
}

async function backupBucket(db: Db): Promise<GridFSBucket> {
  return new GridFSBucket(db, { bucketName: BACKUP_BUCKET });
}

/** قراءة مجال بايتات من GridFS إلى Buffer (start ضمني، end حصري) */
function readRange(bucket: GridFSBucket, id: ObjectId, start: number, end: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const node = bucket.openDownloadStream(id, { start, end });
    const chunks: Buffer[] = [];
    node.on("data", (c: Buffer) => chunks.push(c));
    node.on("end", () => resolve(Buffer.concat(chunks)));
    node.on("error", (e) => reject(e));
  });
}

/** كتابة مجموعة كاملة كمصفوفة JSON داخل مدخل ZIP — بذاكرة ثابتة عبر دفعات مؤشر */
type MinimalCursor = { batchSize: (n: number) => AsyncIterable<unknown> };
type MinimalCollection = { find: (q: object) => MinimalCursor };
function writeCollection(col: MinimalCollection, out: PassThrough): Promise<void> {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        out.write("[");
        let first = true;
        const cursor = col.find({}).batchSize(500);
        for await (const doc of cursor) {
          out.write((first ? "" : ",") + JSON.stringify(doc));
          first = false;
        }
        out.write("]");
        out.end();
        resolve();
      } catch (e) {
        out.destroy();
        reject(e);
      }
    })();
  });
}

/* ═══════════ المرحلة 1: بناء النسخة داخل GridFS ═══════════ */
export async function POST() {
  return handle(async () => {
    const me = await requireUser(["admin"]);
    const conn = await import("@/lib/mongo").then((m) => m.connectDB());
    const db = dbOf(conn);
    if (!db) return fail(503, "قاعدة البيانات غير متاحة");
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "backup.create", "نسخة احتياطية", "إنشاء نسخة احتياطية كاملة داخل القاعدة");

    const now = new Date();
    const stamp = now.toISOString().slice(0, 16).replace("T", "-");
    const filename = `aitigrine-backup-${stamp}.zip`;
    const bucket = await backupBucket(db);

    const archive = new ZipArchive({ zlib: { level: 6 } });
    /* معالج أخطاء إلزامي — يمنع انهيار unhandled error ويُفشل البناء برسالة واضحة */
    let buildError: Error | null = null;
    archive.on("error", (e: Error) => { buildError = e; });

    const up = bucket.openUploadStream(filename, {
      contentType: "application/zip",
      metadata: { createdBy: String(me._id), createdAt: now.toISOString(), app: "aitigrine", version: "3.20.1" },
    });
    const finished = new Promise<void>((resolve, reject) => {
      up.on("finish", () => resolve());
      up.on("error", reject);
    });
    archive.pipe(up);

    /* 1) كل مجموعات قاعدة البيانات → مصفوفة JSON لكل مجموعة (بمؤشرات دفعات — ذاكرة ثابتة) */
    const collections = await db.collections();
    const writes: Promise<void>[] = [];
    for (const col of collections) {
      const name = col.collectionName;
      /* تخطَّ مجموعات GridFS الخام — الوسائط تُصدَّر بالقسم 2، ونسخ backups السابقة لا تدخل في النسخة */
      if (name.endsWith(".chunks") || name.endsWith(".files")) continue;
      const out = new PassThrough();
      archive.append(out, { name: `backup/database/${name}.json` });
      writes.push(
        writeCollection(col as unknown as MinimalCollection, out).catch((e) => {
          buildError = buildError || (e as Error);
        })
      );
    }
    await Promise.all(writes);
    if (buildError) {
      try { archive.abort(); } catch {}
      try { up.destroy(); } catch {}
      return fail(500, "فشل تصدير مجموعات قاعدة البيانات — " + String((buildError as Error)?.message || buildError));
    }

    /* 2) وسائط GridFS → الملفات الأصلية كما هي + فهرس */
    try {
      const mBucket = await mediaBucket();
      const files = await mBucket.find({}).toArray();
      for (const f of files) {
        const node = mBucket.openDownloadStreamByName(f.filename);
        node.on("error", () => node.destroy());
        archive.append(node, { name: `backup/media/${f.filename}` });
      }
      archive.append(
        JSON.stringify(files.map((f) => ({ filename: f.filename, size: f.length, contentType: f.contentType, uploadedAt: f.uploadDate })), null, 2),
        { name: "backup/media/index.json" }
      );
    } catch (e) {
      archive.append(String((e as Error)?.message || e), { name: "backup/media/ERROR.txt" });
    }

    /* 3) تقرير النسخة */
    archive.append(
      JSON.stringify(
        {
          center: "Centre Aitigrine",
          version: "3.20.1",
          createdAt: now.toISOString(),
          note: "نسخة احتياطية كاملة: قاعدة البيانات (JSON) + الوسائط (الملفات الأصلية)",
        },
        null,
        2
      ),
      { name: "backup/README.txt" }
    );

    await archive.finalize();
    if (buildError) {
      try { up.destroy(); } catch {}
      return fail(500, "فشل ضغط النسخة الاحتياطية — " + String((buildError as Error)?.message || buildError));
    }
    await finished;

    const fileId = String(up.id);
    const meta = await bucket.find({ _id: up.id }, { limit: 1 }).toArray();
    const size = meta.length ? meta[0].length : 0;
    const parts = Math.max(1, Math.ceil(size / PART_BYTES));

    /* 4) نظافة: حذف النسخ الأقدم من آخر نسختين */
    try {
      const all = await bucket.find({ filename: /^aitigrine-backup-/ }).sort({ uploadDate: -1 }).toArray();
      for (const old of all.slice(KEEP_BACKUPS)) {
        try { await bucket.delete(old._id); } catch {}
      }
    } catch {}

    return ok({ ok: true, fileId, name: filename, size, parts });
  });
}

/* ═══════════ المرحلة 2: تنزيل جزء base64 ═══════════ */
export async function GET(req: Request) {
  return handle(async () => {
    const me = await requireUser(["admin"]);
    const url = new URL(req.url);
    const fileId = String(url.searchParams.get("file") || "").trim();
    const part = parseInt(url.searchParams.get("part") || "1", 10);
    if (!/^[a-f\d]{24}$/i.test(fileId)) return fail(400, "معرف النسخة غير صالح");
    const conn = await import("@/lib/mongo").then((m) => m.connectDB());
    const db = dbOf(conn);
    if (!db) return fail(503, "قاعدة البيانات غير متاحة");
    const bucket = await backupBucket(db);
    const files = await bucket.find({ _id: new ObjectId(fileId) }, { limit: 1 }).toArray();
    if (!files.length) return fail(404, "النسخة غير موجودة — أنشئ نسخة جديدة ثم نزّلها");
    const size = files[0].length || 0;
    const parts = Math.max(1, Math.ceil(size / PART_BYTES));
    if (!Number.isFinite(part) || part < 1 || part > parts) return fail(400, `رقم الجزء خارج النطاق (1-${parts})`);
    const start = (part - 1) * PART_BYTES;
    const end = Math.min(part * PART_BYTES, size);
    const buf = await readRange(bucket, new ObjectId(fileId), start, end);
    if (part === 1) {
      await logAudit({ _id: me._id, name: me.name, role: me.role }, "backup.download", "نسخة احتياطية", `تنزيل ${files[0].filename}`);
    }
    return ok({ ok: true, part, parts, size, name: files[0].filename, data: buf.toString("base64") });
  });
}

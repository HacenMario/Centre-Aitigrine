/**
 * نسخ احتياطي بضغطة واحدة (v3.30.0 — محتوى بلا نقصان مطابق لمنهجية mongodump) — للإدارة فقط
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
 * ★ v3.30.0 — إصلاح النقصان الجذري: النسخ القديمة صدّرت المجموعات بـ JSON.stringify
 *   العادي ففقدت أنواع BSON (ObjectId والتواريخ صارت نصوصاً — نفس علة استيراد JSON
 *   التي قطعت ربط أسماء المواعيد فظهرت «—»)، واستبعدت كل مجموعات GridFS الخام،
 *   وأخطاء قراءة الوسائط كانت تُبتلع بصمت. الآن:
 *   - backup/database/<المجموعة>.ejson — كل مجموعة بمصفوفة EJSON صارمة (relaxed:false)
 *     تحفظ ObjectId والتواريخ وBinData بأنواعها الممتدة كما هي حرفياً — بلا أي فقد
 *   - تشمل كل المجموعات بما فيها media.files وmedia.chunks (وسائط GridFS كاملة) —
 *     تُستبعد فقط backups.* (نسخ سابقة ذاتية التضخم تحوي بعضها البعض) وsystem.*
 *   - backup/media/* الملفات الأصلية للاستخراج المباشر + backup/media/index.json
 *   - backup/manifest.json — أعداد مستندات كل مجموعة للتحقق من الاكتمال مقابل Atlas
 *   - فشل قراءة أي ملف وسيط = فشل صريح للنسخة كلها (لا صمت ولا نقصان)
 *   - الاستعادة: scripts/restore-full-backup.mjs داخل المشروع (بلا تبعيات إضافية)
 *
 * نظافة تلقائية: تُحفظ آخر نسختين فقط في القاعدة وتُحذف الأقدم.
 */
import { NextResponse } from "next/server";
import { fail, handle, ok } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { mediaBucket } from "@/lib/media-store";
import { ZipArchive } from "archiver";
/* EJSON من bson مباشرة — mongodb v7 لم يعد يعيد تصديره */
import { EJSON } from "bson";
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
  return ((conn as { connection?: { db?: Db } })?.connection?.db as Db) || null;
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

/** كتابة مجموعة كاملة كمصفوفة EJSON صارمة داخل مدخل ZIP — بذاكرة ثابتة عبر دفعات مؤشر، وتعيد عدد المستندات للتحقق */
type MinimalCursor = { batchSize: (n: number) => AsyncIterable<unknown> };
type MinimalCollection = { find: (q: object) => MinimalCursor };
function writeCollection(col: MinimalCollection, out: PassThrough): Promise<number> {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        out.write("[");
        let first = true;
        let count = 0;
        const cursor = col.find({}).batchSize(500);
        for await (const doc of cursor) {
          /* EJSON صارم (relaxed:false) — ObjectId والتواريخ وBinData تبقى بأنواعها الممتدة، لا نصوصاً */
          out.write((first ? "" : ",") + EJSON.stringify(doc, { relaxed: false }));
          first = false;
          count++;
        }
        out.write("]");
        out.end();
        resolve(count);
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
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "backup.create", "نسخة احتياطية", "إنشاء نسخة احتياطية كاملة بجميع الأنواع والوسائط");

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
      metadata: { createdBy: String(me._id), createdAt: now.toISOString(), app: "aitigrine", version: "3.30.0", format: "full-lossless" },
    });
    const finished = new Promise<void>((resolve, reject) => {
      up.on("finish", () => resolve());
      up.on("error", reject);
    });
    archive.pipe(up);

    /* 1) كل مجموعات قاعدة البيانات → مصفوفة EJSON لكل مجموعة (بمؤشرات دفعات — ذاكرة ثابتة)
       تشمل media.files وmedia.chunks — نسخة بلا نقصان مطابقة لمنهجية mongodump.
       تُستبعد فقط backups.* (نسخ سابقة ذاتية التضخم تحوي بعضها البعض) وsystem.* الداخلية */
    const collections = await db.collections();
    const manifestCollections: { name: string; docs: number }[] = [];
    const writes: Promise<void>[] = [];
    for (const col of collections) {
      const name = col.collectionName;
      if (name.startsWith("backups.") || name.startsWith("system.")) continue;
      const out = new PassThrough();
      archive.append(out, { name: `backup/database/${name}.ejson` });
      writes.push(
        writeCollection(col as unknown as MinimalCollection, out)
          .then((docs) => { manifestCollections.push({ name, docs }); })
          .catch((e) => {
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

    /* 2) وسائط GridFS → الملفات الأصلية كما هي + فهرس — فشل أي ملف = فشل النسخة كلها (لا صمت بلا نقصان) */
    let mediaCount = 0;
    let mediaBytes = 0;
    try {
      const mBucket = await mediaBucket();
      const files = await mBucket.find({}).toArray();
      mediaCount = files.length;
      mediaBytes = files.reduce((s, f) => s + (f.length || 0), 0);
      for (const f of files) {
        const node = mBucket.openDownloadStreamByName(f.filename);
        node.on("error", (e: Error) => { buildError = buildError || e; });
        archive.append(node, { name: `backup/media/${f.filename}` });
      }
      archive.append(
        JSON.stringify(files.map((f) => ({ filename: f.filename, size: f.length, contentType: f.contentType, uploadedAt: f.uploadDate })), null, 2),
        { name: "backup/media/index.json" }
      );
    } catch (e) {
      buildError = buildError || (e as Error);
    }

    /* 3) بيان النسخة (للتحقق الآلي من الاكتمال) + تقرير مقروء */
    archive.append(
      JSON.stringify(
        {
          format: "aitigrine-full-backup-2",
          center: "Centre Aitigrine",
          version: "3.30.0",
          createdAt: now.toISOString(),
          database: db.databaseName,
          collections: manifestCollections.sort((a, b) => a.name.localeCompare(b.name)),
          media: { files: mediaCount, bytes: mediaBytes },
          typesPreserved: true,
        },
        null,
        2
      ),
      { name: "backup/manifest.json" }
    );
    archive.append(
      [
        "نسخة احتياطية كاملة — مركز آيت تقرين النفسي",
        `التاريخ: ${now.toISOString()}`,
        "",
        "المحتويات:",
        "- backup/database/<المجموعة>.ejson — كل مجموعة بمصفوفة EJSON صارمة تحفظ أنواع BSON",
        "  (ObjectId والتواريخ والبيانات الثنائية) كما هي حرفياً — بلا أي فقد،",
        "  وتشمل وسائط GridFS كاملة (media.files وmedia.chunks).",
        "- backup/media/ — الملفات الأصلية للاستخراج المباشر + index.json.",
        "- backup/manifest.json — أعداد مستندات كل مجموعة: قارنها بأعداد Atlas للتحقق من الاكتمال.",
        "",
        "الاستعادة: داخل مجلد المشروع نفّذ",
        "  MONGODB_URI=\"<رابط القاعدة الهدف>\" node scripts/restore-full-backup.mjs <مجلد backup المستخرج> --drop",
        "أو استخدم أرشيف mongodump المعتاد (ملف bat) عند الترحيل بين العناقيد.",
        "",
        "ملاحظة أمان: هذا الملف يحوي كل بيانات المركز والمستخدمين — احفظه في مكان آمن فقط.",
      ].join("\n"),
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

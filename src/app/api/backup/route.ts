/**
 * نسخ احتياطي بضغطة واحدة (v3.8) — للإدارة فقط
 * GET /api/backup → ZIP يحوي:
 *   backup/database/<collection>.json  — كل مجموعات قاعدة البيانات كاملة
 *   backup/media/<file>                — كل وسائط المركز من GridFS
 * ★ يبني ZIP تدفقياً (stream) — لا يحمّل كل شيء في الذاكرة
 */
import { NextResponse } from "next/server";
import { fail, handle } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { mediaBucket } from "@/lib/media-store";
import { Readable } from "stream";
import { ZipArchive } from "archiver";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  return handle(async () => {
    const me = await requireUser(["admin"]);
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "backup.create", "نسخة احتياطية", "تنزيل نسخة احتياطية كاملة");

    const conn = await import("@/lib/mongo").then((m) => m.connectDB());
    const db = conn.connection?.db;
    if (!db) return fail(503, "قاعدة البيانات غير متاحة");

    const archive = new ZipArchive({ zlib: { level: 6 } });

    /* 1) كل مجموعات قاعدة البيانات → ملف JSON لكل مجموعة */
    const collections = await db.collections();
    for (const col of collections) {
      const name = col.collectionName;
      /* تخطَّ مجموعات GridFS الخام — الوسائط تُصدَّر بالقسم 2 */
      if (name.endsWith(".chunks") || name.endsWith(".files")) continue;
      const docs = await col.find({}).toArray();
      archive.append(JSON.stringify(docs, null, 1), { name: `backup/database/${name}.json` });
    }

    /* 2) وسائط GridFS → ملفات كما هي */
    try {
      const bucket = await mediaBucket();
      const files = await bucket.find({}).toArray();
      for (const f of files) {
        const node = bucket.openDownloadStreamByName(f.filename);
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
          version: "3.8.0",
          createdAt: new Date().toISOString(),
          note: "نسخة احتياطية كاملة: قاعدة البيانات (JSON) + الوسائط (الملفات الأصلية)",
        },
        null,
        2
      ),
      { name: "backup/README.txt" }
    );

    const done = archive.finalize(); // يغلق بعد كتابة كل المدخلات
    void done;

    const web = Readable.toWeb(archive) as unknown as ReadableStream;
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(web, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="aitigrine-backup-${stamp}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  });
}

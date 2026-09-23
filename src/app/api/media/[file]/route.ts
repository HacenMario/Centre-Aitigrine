/**
 * بث وسائط المركز — GET /api/media/<name> — v3.7.1
 * ★ v3.7.1: البث من GridFS في MongoDB بدل القرص (بيئات الاستضافة للقراءة فقط).
 *   الملفات القديمة على القرص تُقرأ كخطة بديلة تلقائياً — الروابط بلا تغيير.
 * يدعم Content-Type الصحيح + Range requests (تمرير داخل الفيديو على الجوال)
 * عام للجميع (المعرض في الرئيسية للزوار)
 */
import { NextRequest } from "next/server";
import { fail } from "@/lib/api-helpers";
import { mediaMeta, openMedia, diskMediaStat, openDiskMedia } from "@/lib/media-store";

export const runtime = "nodejs";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  /* منع اجتياز المسارات — اسم ملف بسيط فقط */
  if (!/^[A-Za-z0-9._-]+$/.test(file)) return fail(400, "اسم ملف غير صالح");
  const ext = file.split(".").pop()?.toLowerCase() || "";
  const mime = MIME_BY_EXT[ext];
  if (!mime) return fail(415, "صيغة غير مدعومة");

  const commonHeaders: Record<string, string> = {
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  /* تحديد المصدر: GridFS أولاً ثم القرص (توافق الملفات القديمة) */
  let size = -1;
  let source: "gridfs" | "disk" | null = null;
  try {
    const meta = await mediaMeta(file);
    if (meta) {
      size = meta.size;
      source = "gridfs";
    }
  } catch {
    /* قاعدة البيانات غير متاحة — نتابع إلى خطة القرص */
  }
  if (!source) {
    const stat = diskMediaStat(file);
    if (stat) {
      size = stat.size;
      source = "disk";
    }
  }
  if (source === null || size < 0) return fail(404, "الملف غير موجود");

  const range = req.headers.get("range");

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (isNaN(start) || start < 0) start = 0;
    if (isNaN(end) || end >= size) end = size - 1;
    if (start > end) start = 0;
    const body =
      source === "gridfs"
        ? await openMedia(file, start, end)
        : openDiskMedia(file, start, end);
    return new Response(body, {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  const body = source === "gridfs" ? await openMedia(file) : openDiskMedia(file);
  return new Response(body, {
    status: 200,
    headers: { ...commonHeaders, "Content-Length": String(size) },
  });
}

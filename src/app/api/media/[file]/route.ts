/**
 * بث وسائط المركز — GET /api/media/<name>
 * يدعم Content-Type الصحيح + Range requests (تمرير داخل الفيديو على الجوال)
 * عام للجميع (المعرض في الرئيسية للزوار)
 */
import { NextRequest } from "next/server";
import { fail } from "@/lib/api-helpers";
import fs from "fs";
import path from "path";

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

  const full = path.join(process.cwd(), "uploads", file);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(full);
  } catch {
    return fail(404, "الملف غير موجود");
  }

  const range = req.headers.get("range");
  const commonHeaders: Record<string, string> = {
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    if (isNaN(start) || start < 0) start = 0;
    if (isNaN(end) || end >= stat.size) end = stat.size - 1;
    if (start > end) start = 0;
    const stream = fs.createReadStream(full, { start, end });
    return new Response(stream as unknown as ReadableStream, {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  const stream = fs.createReadStream(full);
  return new Response(stream as unknown as ReadableStream, {
    status: 200,
    headers: { ...commonHeaders, "Content-Length": String(stat.size) },
  });
}

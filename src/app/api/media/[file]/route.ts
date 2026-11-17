/**
 * بث وسائط المركز — GET /api/media/<name> — v3.7.1
 * ★ v3.7.1: البث من GridFS في MongoDB بدل القرص (بيئات الاستضافة للقراءة فقط).
 *   الملفات القديمة على القرص تُقرأ كخطة بديلة تلقائياً — الروابط بلا تغيير.
 * يدعم Content-Type الصحيح + Range requests (تمرير داخل الفيديو على الجوال)
 * عام للجميع (المعرض في الرئيسية للزوار)
 * ★ v3.17: أسماء الملفات فريدة أبداً لا تُستبدل بمحتوى مختلف (timestamp + random)
 *   ⇒ تخزين حافة كامل: s-maxage يجعل Vercel Edge تخزّن الملف بعد أول طلب في المنطقة
 *   وتخدمه بعدها من الـ CDN بلا استدعاء الدالة ولا قراءة GridFS —
 *   هذا هو الإصلاح الجذري لاستهلاك Fast Origin Transfer على Vercel
 *   (max-age وحده يخزّن في متصفح الزائر فقط ولا يفيد الزوار الجدد ولا الروبوتات)
 */
import { NextRequest, NextResponse } from "next/server";
import { fail, ok, handle } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth";
import { mediaMeta, openMedia, diskMediaStat, openDiskMedia, deleteMediaByName } from "@/lib/media-store";
import { scanMediaUsage, type MediaUsageKind } from "@/lib/media-usage";
import { logAudit, auditTarget } from "@/lib/audit";

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
  pdf: "application/pdf", // ★ v3.25: كتب القارئ الداخلي
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
    /* ★ v3.17: s-maxage = تخزين حافة Vercel (أسماء فريدة ⇒ آمن 100%) + SWR يحجب الاندفاعات */
    "Cache-Control":
      "public, max-age=31536000, immutable, s-maxage=31536000, stale-while-revalidate=86400",
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

/**
 * DELETE /api/media/<name> — حذف آمن لملف وسائط — v3.18
 * صلاحيات: الإدارة والمساعد
 * ⛔ الحماية: فحص استخدام إلزامي قبل الحذف — الملف المستخدم (سلايدر/إعلان/
 *   تكوين/فاتورة/…) يُرفض بـ 409 مع قائمة مواضع استخدامه ولا يُمسّ إطلاقاً.
 *   تعذر الفحص = لا حذف (503 محافظ).
 * التنظيف عبر آلية GridFS الرسمية bucket.delete: media.files + media.chunks معاً.
 */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  return handle(async () => {
    const me = await requireUser(["admin", "assistant"]);
    const { file } = await ctx.params;
    /* نفس قاعدة GET: اسم ملف بسيط فقط — منع اجتياز المسارات */
    if (!/^[A-Za-z0-9._-]+$/.test(file)) return fail(400, "اسم ملف غير صالح");

    let usage: MediaUsageKind[];
    try {
      usage = (await scanMediaUsage([file])).get(file) || [];
    } catch (e) {
      console.error("media usage scan failed (delete):", (e as Error)?.message);
      return fail(503, "تعذر فحص استخدام الملف — لن يُحذف شيء الآن، أعد المحاولة");
    }
    if (usage.length) {
      return NextResponse.json({ error: "MEDIA_IN_USE", usage }, { status: 409 });
    }

    const freed = await deleteMediaByName(file);
    if (freed === null) return fail(404, "الملف غير موجود");

    await logAudit(me, "media.delete", auditTarget("media", file), `freed=${freed}`);
    return ok({ ok: true, freed });
  });
}

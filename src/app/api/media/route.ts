/**
 * رفع وسائط المركز (صور وفيديو) — v3.7.1
 * ★ v3.7.1: الحفظ في MongoDB عبر GridFS بدل القرص — بيئات الاستضافة السحابية
 *   (Serverless/Lambda) تجعل مجلد التطبيق للقراءة فقط وكان الرفع يفشل بخطأ EROFS.
 *   (النظام الأقدم كان يخزن base64 في مستند الإعدادات — حد MongoDB 16MB كان يفشل
 *    حفظ أي فيديو؛ ثم انتقلنا للقرص؛ الآن GridFS = يعمل في كل البيئات وبدون حدود)
 * POST /api/media  (FormData: file) → { ok, url: "/api/media/<name>" }
 * صلاحيات: الإدارة والمساعد فقط
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth";
import { putMedia } from "@/lib/media-store";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_SIZE = 200 * 1024 * 1024; // 200MB حد أعلى للفيديو الطويل
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin", "assistant"]);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") return fail(400, "لم يُرفق أي ملف");
    const f = file as File;

    if (f.size > MAX_SIZE) return fail(413, "الملف أكبر من الحد المسموح (200MB)");
    const mime = f.type || "application/octet-stream";
    const ext = EXT_BY_MIME[mime];
    if (!ext) return fail(415, "صيغة غير مدعومة — الصور (JPG/PNG/WebP) والفيديو (MP4/WebM/MOV) فقط");

    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const buf = Buffer.from(await f.arrayBuffer());
    await putMedia(name, buf, mime);
    return ok({ url: `/api/media/${name}`, type: mime.startsWith("video") ? "video" : "image", size: f.size });
  });
}

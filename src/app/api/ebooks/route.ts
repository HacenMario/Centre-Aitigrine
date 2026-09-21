/**
 * الكتب الإلكترونية
 * GET: للجميع — العميل يرى العنوان والنبذة والغلاف فقط (+المحتوى عند الفتح)
 * POST: الإدارة فقط تضيف
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Ebook } from "@/lib/models";
import { currentUser, isStaff, requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await currentUser();
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "1" && me && isStaff(me.role);
    const q = all ? {} : { active: true };
    const ebooks = await Ebook.find(q).sort({ createdAt: -1 }).lean();
    return ok({ ebooks });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin", "assistant"]);
    const b = await req.json().catch(() => ({}));
    const title = String(b.title || "").trim();
    if (!title) return fail(400, "عنوان الكتاب مطلوب");
    const e = await Ebook.create({
      title,
      titleFr: String(b.titleFr || ""),
      titleEn: String(b.titleEn || ""),
      summary: String(b.summary || ""),
      summaryFr: String(b.summaryFr || ""),
      summaryEn: String(b.summaryEn || ""),
      author: String(b.author || ""),
      coverBase64: String(b.coverBase64 || ""),
      blocks: Array.isArray(b.blocks)
        ? b.blocks
            .filter((x: { type?: string }) => x?.type === "text" || x?.type === "answer")
            .map((x: { type: string; text?: string; lines?: number }) => ({
              type: x.type,
              text: String(x.text || ""),
              lines: Math.max(1, Number(x.lines) || 1),
            }))
        : [],
      active: b.active !== false,
    });
    return ok({ ebook: e.toObject() });
  });
}

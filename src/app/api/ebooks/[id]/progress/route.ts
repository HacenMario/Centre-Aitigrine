/**
 * تقدم قراءة كتاب إلكتروني — ★ v3.25
 * GET: آخر صفحة وصل إليها المستخدم + صفحة العلامة الحمراء على هذا الكتاب
 * PUT: حفظ {lastPage, bookmark} — مستند واحد لكل مستخدم/كتاب (upsert)
 * الزوار غير المسجلين لا يصلون هنا — الواجهة تحفظ تقدمهم محلياً في المتصفح
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth";
import { EbookProgress } from "@/lib/models";

type Ctx = { params: Promise<{ id: string }> };

const MAX_PAGE = 9999;
const clampPage = (v: unknown): number => {
  const n = Math.round(Number(v) || 0);
  return n >= 1 && n <= MAX_PAGE ? n : 0;
};

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const row = await EbookProgress.findOne({ ebookId: id, userId: me._id })
      .lean<{ lastPage?: number; bookmark?: number } | null>();
    return ok({ lastPage: Math.max(1, Math.round(row?.lastPage || 1)), bookmark: Math.max(0, Math.round(row?.bookmark || 0)) });
  });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const b = await req.json().catch(() => ({}));
    const lastPage = clampPage(b.lastPage);
    if (!lastPage) return fail(400, "رقم الصفحة غير صالح");
    const bookmark = clampPage(b.bookmark); /* 0 = بلا علامة */
    const row = await EbookProgress.findOneAndUpdate(
      { ebookId: id, userId: me._id },
      { $set: { lastPage, bookmark } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return ok({ lastPage: row.lastPage, bookmark: row.bookmark });
  });
}

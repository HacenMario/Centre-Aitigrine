/**
 * مقال واحد (v3.6.0)
 * GET: القراءة عامة للجميع — المقال المفعّل يقرأه الزوار والمستخدمون،
 *      والمعطّل يراه فريق الإدارة وصاحبه الأخصائي فقط
 * PATCH: الإدارة تعدّل أي مقال — الأخصائي يعدّل مقالاته هو فقط
 * DELETE: الأدمين يحذف أي مقال — الأخصائي يحذف مقاله هو فقط
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Article } from "@/lib/models";
import { currentUser, isStaff, requireUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const a = await Article.findById(id).lean();
    if (!a) return fail(404, "المقال غير موجود");

    if (a.active === false) {
      const me = await currentUser();
      const owner = me && String(a.authorId || "") === String(me._id);
      if (!me || (!isStaff(me.role) && !owner)) return fail(404, "المقال غير موجود");
    }
    return ok({ article: a });
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await requireUser(["admin", "assistant", "specialist"]);
    const { id } = await ctx.params;
    const a = await Article.findById(id);
    if (!a) return fail(404, "المقال غير موجود");
    /* الأخصائي: مقالاته هو فقط */
    if (me.role === "specialist" && String(a.authorId || "") !== String(me._id))
      return fail(403, "لا تملك صلاحية تعديل هذا المقال");

    const b = await req.json().catch(() => ({}));
    if (b.title !== undefined) {
      const t = String(b.title).trim();
      if (!t) return fail(400, "عنوان المقال مطلوب");
      a.title = t;
    }
    if (b.titleFr !== undefined) a.titleFr = String(b.titleFr).trim();
    if (b.titleEn !== undefined) a.titleEn = String(b.titleEn).trim();
    if (b.summary !== undefined) a.summary = String(b.summary).trim();
    if (b.summaryFr !== undefined) a.summaryFr = String(b.summaryFr).trim();
    if (b.summaryEn !== undefined) a.summaryEn = String(b.summaryEn).trim();
    if (b.content !== undefined) {
      const c = String(b.content).trim();
      if (!c) return fail(400, "نص المقال مطلوب");
      a.content = c;
    }
    if (b.contentFr !== undefined) a.contentFr = String(b.contentFr);
    if (b.contentEn !== undefined) a.contentEn = String(b.contentEn);
    if (b.category !== undefined && ["psychology", "orthophony", "general"].includes(String(b.category)))
      a.category = String(b.category);
    if (typeof b.coverBase64 === "string") a.coverBase64 = b.coverBase64;
    if (typeof b.active === "boolean") a.active = b.active;
    await a.save();
    return ok({ article: a.toObject() });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await requireUser(["admin", "assistant", "specialist"]);
    const { id } = await ctx.params;
    const a = await Article.findById(id);
    if (!a) return fail(404, "المقال غير موجود");
    /* المساعد لا يحذف (نمط الكتب الإلكترونية) — الأخصائي يحذف مقاله هو فقط */
    if (me.role === "assistant") return fail(403, "لا تملك صلاحية حذف المقالات");
    if (me.role === "specialist" && String(a.authorId || "") !== String(me._id))
      return fail(403, "لا تملك صلاحية حذف هذا المقال");
    await Article.findByIdAndDelete(id);
    return ok();
  });
}

/** تعديل/تفعيل/حذف خدمة — الإدارة */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Service } from "@/lib/models";
import { requireUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser(["admin", "assistant"]);
    const { id } = await ctx.params;
    const s = await Service.findById(id);
    if (!s) return fail(404, "الخدمة غير موجودة");
    const b = await req.json().catch(() => ({}));
    if (b.title !== undefined) s.title = String(b.title).trim();
    if (b.titleFr !== undefined) s.titleFr = String(b.titleFr);
    if (b.titleEn !== undefined) s.titleEn = String(b.titleEn);
    if (b.description !== undefined) s.description = String(b.description);
    if (b.descriptionFr !== undefined) s.descriptionFr = String(b.descriptionFr);
    if (b.descriptionEn !== undefined) s.descriptionEn = String(b.descriptionEn);
    if (b.icon !== undefined) s.icon = String(b.icon).slice(0, 8) || "✨";
    if (b.category !== undefined) s.category = String(b.category);
    if (b.price !== undefined) s.price = Number(b.price) || 0;
    if (b.durationMin !== undefined) s.durationMin = Number(b.durationMin) || 60;
    if (typeof b.coverBase64 === "string") s.coverBase64 = b.coverBase64;
    if (typeof b.active === "boolean") s.active = b.active;
    if (b.order !== undefined) s.order = Number(b.order) || 0;
    await s.save();
    return ok({ service: s.toObject() });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser(["admin"]);
    const { id } = await ctx.params;
    await Service.findByIdAndDelete(id);
    return ok();
  });
}

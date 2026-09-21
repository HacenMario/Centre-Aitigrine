/** تحديث حالة اقتراح/بلاغ أو حذفه — الإدارة/المساعد */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Feedback } from "@/lib/models";
import { requireUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser(["admin", "assistant"]);
    const { id } = await ctx.params;
    const f = await Feedback.findById(id);
    if (!f) return fail(404, "الرسالة غير موجودة");
    const b = await req.json().catch(() => ({}));
    if (b.status && ["new", "read", "resolved"].includes(b.status)) f.status = b.status;
    if (b.reply !== undefined) f.reply = String(b.reply).slice(0, 2000);
    await f.save();
    return ok({ feedback: f.toObject() });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser(["admin"]);
    const { id } = await ctx.params;
    await Feedback.findByIdAndDelete(id);
    return ok();
  });
}

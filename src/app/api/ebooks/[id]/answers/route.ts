/**
 * إجابات العميل على أسطر الكتاب الإلكتروني
 * GET: إجاباتي — POST: حفظ إجاباتي (العميل)
 * الإجابات تظهر للإدارة وللأخصائي المعالج فقط (تُدار من مسار الكتاب)
 */
import { mapToObj } from "@/lib/map";
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Ebook, EbookAnswer, User } from "@/lib/models";
import { currentUser, requireUser } from "@/lib/auth";
import { notifyUser } from "@/lib/push";
import { ebookAnswersText } from "@/lib/notify-text";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await requireUser();
    const { id } = await ctx.params;
    const row = await EbookAnswer.findOne({ ebookId: id, clientId: me._id }).lean<{
      answers: Map<string, string>;
    } | null>();
    return ok({ answers: row ? (mapToObj(row.answers) as Record<string, string>) : {} });
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await requireUser(["client"]);
    const { id } = await ctx.params;
    const e = await Ebook.findById(id).lean();
    if (!e || e.active === false) return fail(404, "الكتاب غير موجود");
    const b = await req.json().catch(() => ({}));
    if (!b.answers || typeof b.answers !== "object") return fail(400, "لا إجابات");
    /* تنظيف: مفاتيح رقمية ونصوص فقط */
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(b.answers as Record<string, unknown>)) {
      if (/^\d+$/.test(k) && typeof v === "string") clean[k] = v.slice(0, 2000);
    }
    await EbookAnswer.findOneAndUpdate(
      { ebookId: id, clientId: me._id },
      { $set: { answers: clean, updatedBy: me._id } },
      { upsert: true, new: true }
    );
    /* إشعار الأخصائي المعالج (إن وُجد) بتحديث الإجابات */
    if (me.assignedSpecialistId) {
      const spec = await User.findById(me.assignedSpecialistId).select("_id").lean();
      if (spec) notifyUser(String(spec._id), ebookAnswersText({ clientName: me.name, bookTitle: e.title || "" }), "ebook", "patients");
    }
    return ok({ saved: true });
  });
}

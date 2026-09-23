/**
 * كتاب إلكتروني واحد
 * GET: المحتوى كامل للقارئ داخل الموقع (لا تحميل) — الإدارة ترى دائماً،
 *      والعميل المفعّل يقرأ داخل الموقع، والإجابات تُخفى عنه.
 * PATCH: الإدارة — DELETE: الإدارة
 */
import { mapToObj } from "@/lib/map";
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Ebook, EbookAnswer, User } from "@/lib/models";
import { currentUser, isStaff, requireUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await currentUser();
    if (!me) return fail(401, "سجّل الدخول للقراءة");
    const { id } = await ctx.params;
    const e = await Ebook.findById(id).lean();
    if (!e || (e.active === false && !isStaff(me.role)))
      return fail(404, "الكتاب غير موجود");

    /* للعميل: المحتوى للقراءة داخل الموقع فقط — بلا إجابات الآخرين */
    let answersVisible = false;
    let answersList: { clientId: string; clientName: string; answers: Record<string, string> }[] = [];
    if (isStaff(me.role)) {
      answersVisible = true;
      const rows = await EbookAnswer.find({ ebookId: id }).lean<
        { clientId: unknown; answers: Map<string, string> }[]
      >();
      const ids = rows.map((r) => r.clientId);
      const clients = await User.find({ _id: { $in: ids } })
        .select("name")
        .lean<{ _id: unknown; name: string }[]>();
      const nameMap = new Map(clients.map((c) => [String(c._id), c.name]));
      answersList = rows.map((r) => ({
        clientId: String(r.clientId),
        clientName: nameMap.get(String(r.clientId)) || "—",
        answers: mapToObj(r.answers) as Record<string, string>,
      }));
    } else if (me.role === "specialist") {
      /* الأخصائي المعالج: يرى إجابات عملائه المعيّنين له فقط */
      const clients = await User.find({
        assignedSpecialistId: me._id,
        role: "client",
      })
        .select("_id name")
        .lean<{ _id: unknown; name: string }[]>();
      const clientMap = new Map(clients.map((c) => [String(c._id), c.name]));
      const rows = await EbookAnswer.find({
        ebookId: id,
        clientId: { $in: clients.map((c) => c._id) },
      }).lean<{ clientId: unknown; answers: Map<string, string> }[]>();
      if (rows.length) {
        answersVisible = true;
        answersList = rows.map((r) => ({
          clientId: String(r.clientId),
          clientName: clientMap.get(String(r.clientId)) || "—",
          answers: mapToObj(r.answers) as Record<string, string>,
        }));
      }
    }

    return ok({ ebook: e, answersVisible, answersList });
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser(["admin", "assistant"]);
    const { id } = await ctx.params;
    const e = await Ebook.findById(id);
    if (!e) return fail(404, "الكتاب غير موجود");
    const b = await req.json().catch(() => ({}));
    if (b.title !== undefined) e.title = String(b.title).trim();
    if (b.titleFr !== undefined) e.titleFr = String(b.titleFr);
    if (b.titleEn !== undefined) e.titleEn = String(b.titleEn);
    if (b.titleTr !== undefined) e.titleTr = String(b.titleTr);
    if (b.titleEs !== undefined) e.titleEs = String(b.titleEs);
    if (b.summary !== undefined) e.summary = String(b.summary);
    if (b.summaryFr !== undefined) e.summaryFr = String(b.summaryFr);
    if (b.summaryTr !== undefined) e.summaryTr = String(b.summaryTr);
    if (b.summaryEs !== undefined) e.summaryEs = String(b.summaryEs);
    if (b.summaryEn !== undefined) e.summaryEn = String(b.summaryEn);
    if (b.author !== undefined) e.author = String(b.author);
    if (typeof b.coverBase64 === "string") e.coverBase64 = b.coverBase64;
    if (Array.isArray(b.blocks))
      e.blocks = b.blocks
        .filter((x: { type?: string }) => x?.type === "text" || x?.type === "answer")
        .map((x: { type: string; text?: string; lines?: number }) => ({
          type: x.type,
          text: String(x.text || ""),
          lines: Math.max(1, Number(x.lines) || 1),
        }));
    if (typeof b.active === "boolean") e.active = b.active;
    await e.save();
    return ok({ ebook: e.toObject() });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser(["admin"]);
    const { id } = await ctx.params;
    await Ebook.findByIdAndDelete(id);
    await EbookAnswer.deleteMany({ ebookId: id });
    return ok();
  });
}

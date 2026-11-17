/**
 * كتاب إلكتروني واحد
 * GET: المحتوى كامل للقارئ داخل الموقع (لا تحميل) — الإدارة ترى دائماً،
 *      ★ v3.20: الكتاب المدفوع يُفتح فقط لمن دفعت (طلب بحالة paid) —
 *      غير المستحق يرى العنوان والغلاف والنبذة والسعر وحالة طلبه فقط (بلا محتوى ولا رابط Drive)
 * PATCH: الإدارة والمساعد — DELETE: الإدارة
 */
import { mapToObj } from "@/lib/map";
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Ebook, EbookAnswer, EbookOrder, EbookProgress, User } from "@/lib/models";
import { currentUser, isStaff, requireUser } from "@/lib/auth";

/** تطبيع رابط Drive — يُقبل http/https فقط وطول معقول */
function normDrive(v: unknown): string {
  const s = String(v || "").trim();
  if (!s) return "";
  if (!/^https?:\/\/\S+$/i.test(s) || s.length > 2048) return "";
  return s;
}

/** ★ v3.25: تطبيع رابط PDF المرفوع — مسار الوسائط الداخلي حصراً */
function normPdfUrl(v: unknown): string {
  const s = String(v || "").trim();
  return /^\/api\/media\/[A-Za-z0-9._-]+\.pdf$/.test(s) ? s : "";
}

/** ★ v3.25: اتجاه القارئ — rtl افتراضياً */
function normDirection(v: unknown): "rtl" | "ltr" {
  return v === "ltr" ? "ltr" : "rtl";
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await currentUser();
    const { id } = await ctx.params;
    const e = await Ebook.findById(id).lean<Record<string, unknown> | null>();
    if (!e || (e.active === false && (!me || !isStaff(me.role))))
      return fail(404, "الكتاب غير موجود");

    /* ★ v3.20: حق الوصول — الإدارة والمساعد دائماً، والمجاني للجميع (حتى الزائر — ★ v3.25)،
       والمدفوع لمن دفع حصراً */
    const staff = !!me && isStaff(me.role);
    const price = Math.max(0, Number(e.price) || 0);
    /* ★ v3.25: الكتاب المدفوع يتطلب حساباً — الزائر يُدعى لتسجيل الدخول بدل الرفض الصامت */
    if (!me && price > 0) return fail(401, "سجّل الدخول واطلب شراء الكتاب للقراءة");
    let myOrder: string | null = null;
    if (me && me.role === "client") {
      const o = await EbookOrder.findOne({ ebookId: id, clientId: me._id })
        .sort({ createdAt: -1 })
        .lean<{ status: string } | null>();
      myOrder = o?.status || null;
    }
    const unlocked = staff || price === 0 || myOrder === "paid";

    /* للعميل: المحتوى للقراءة داخل الموقع فقط — بلا إجابات الآخرين */
    let answersVisible = false;
    let answersList: { clientId: string; clientName: string; answers: Record<string, string> }[] = [];
    if (staff) {
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
    } else if (me.role === "specialist" || me.role === "trainer") {
      /* الأخصائي/المكوّن المعالج: يرى إجابات عملائه المعيّنين له فقط — ★ v3.11 */
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

    /* ★ v3.20: غير المستحق لا يرى المحتوى ولا رابط Drive — فقط التعريف وحالة طلبه */
    const driveHas = !!e.driveLink;
    const base = { ...e, price, driveHas, myOrder };
    /* ★ v3.25: غير المستحق لا يرى المحتوى ولا رابط Drive ولا رابط PDF المدمج */
    const ebook = unlocked ? base : { ...base, blocks: [], driveLink: "", pdfUrl: "" };
    return ok({ ebook, answersVisible, answersList, unlocked });
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
    if (b.summary !== undefined) e.summary = String(b.summary);
    if (b.summaryFr !== undefined) e.summaryFr = String(b.summaryFr);
    if (b.summaryEn !== undefined) e.summaryEn = String(b.summaryEn);
    if (b.author !== undefined) e.author = String(b.author);
    if (typeof b.coverBase64 === "string") e.coverBase64 = b.coverBase64;
    /* ★ v3.20: السعر بالدينار ورابط Drive — نفس تطبيع الإنشاء */
    if (b.price !== undefined) e.price = Math.max(0, Math.round(Number(b.price) || 0));
    if (b.driveLink !== undefined) e.driveLink = normDrive(b.driveLink);
    /* ★ v3.25: ملف PDF المدمج واتجاه القارئ */
    if (b.pdfUrl !== undefined) e.pdfUrl = normPdfUrl(b.pdfUrl);
    if (b.direction !== undefined) e.direction = normDirection(b.direction);
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
    await EbookProgress.deleteMany({ ebookId: id }); // ★ v3.25: تنظيف تقدم القراءة
    return ok();
  });
}

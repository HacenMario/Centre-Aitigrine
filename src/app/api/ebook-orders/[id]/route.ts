/**
 * طلب كتاب واحد — قرارات فريق الإدارة (v3.20)
 * PATCH: accept (قبول → إشعار العميل بالتواصل عبر واتساب)
 *        paid    (تأكيد الدفع → تفعيل الكتاب + إشعار موجّه لصفحة الكتب)
 *        cancel  (رفض/إلغاء الطلب — حذف نهائي، الإدارة فقط)
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { ActivityLog, Ebook, EbookOrder, Settings, User } from "@/lib/models";
import { requireUser } from "@/lib/auth";
import { notifyUser } from "@/lib/push";
import { ebookOrderAcceptedText, ebookPaidText } from "@/lib/notify-text";
import { logAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await requireUser(["admin", "assistant"]);
    const { id } = await ctx.params;
    const o = await EbookOrder.findById(id);
    if (!o) return fail(404, "الطلب غير موجود");
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "");

    const book = await Ebook.findById(String(o.ebookId)).lean<Record<string, unknown> | null>();
    const bookTitle = String(book?.title || "كتاب");
    const client = await User.findById(String(o.clientId))
      .select("name phone")
      .lean<{ name: string; phone: string } | null>();

    if (action === "accept") {
      if (o.status !== "pending") return fail(409, "الطلب مراجَع مسبقاً — حالته الحالية تسمح بالتأكيد أو الإلغاء");
      o.status = "accepted";
      o.acceptedAt = new Date();
      await o.save();
      await logAudit({ _id: me._id, name: me.name, role: me.role }, "ebook.orderAccept", `كتاب: ${bookTitle}`, `عميل: ${client?.name || "—"}`, String(o._id));
      /* إشعار العميل: التواصل عبر واتساب لتأكيد الدفع — مع رقم المركز من الإعدادات إن توفر */
      const s = await Settings.findOne({ key: "center" }).lean<Record<string, unknown> | null>();
      const wa = String(s?.whatsapp || s?.phone || "");
      notifyUser(String(o.clientId), ebookOrderAcceptedText({ bookTitle, price: o.price, whatsapp: wa }), "ebook_order", `ebooks:${String(o.ebookId)}`);
      return ok({ order: o.toObject() });
    }

    if (action === "paid") {
      if (o.status === "paid") return fail(409, "الطلب مفعّل مسبقاً");
      o.status = "paid";
      o.paidAt = new Date();
      await o.save();
      await logAudit({ _id: me._id, name: me.name, role: me.role }, "ebook.orderPaid", `كتاب: ${bookTitle}`, `عميل: ${client?.name || "—"}`, String(o._id));
      /* ★ نبضة إثبات اجتماعي: شراء كتاب — تدخل نافذة التحفيز للزوار */
      ActivityLog.create({
        userId: o.clientId,
        kind: "ebook",
        name: (client?.name || "").trim().split(/\s+/)[0] || "",
        labels: { ar: bookTitle, fr: String(book?.titleFr || "") || bookTitle, en: String(book?.titleEn || "") || bookTitle, tr: String(book?.titleEn || "") || bookTitle, es: String(book?.titleEn || "") || bookTitle },
      }).catch(() => {});
      notifyUser(String(o.clientId), ebookPaidText({ bookTitle }), "ebook_order", `ebooks:${String(o.ebookId)}`);
      return ok({ order: o.toObject() });
    }

    if (action === "cancel") {
      await requireUser(["admin"]);
      await EbookOrder.deleteOne({ _id: o._id });
      await logAudit({ _id: me._id, name: me.name, role: me.role }, "ebook.orderCancel", `كتاب: ${bookTitle}`, `عميل: ${client?.name || "—"}`, String(o._id));
      return ok();
    }

    return fail(400, "إجراء غير معروف");
  });
}

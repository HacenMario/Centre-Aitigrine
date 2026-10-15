/**
 * طلبات شراء الكتب الإلكترونية (v3.20)
 * POST: العميل يطلب شراء كتاب مدفوع — الطلب يصل للإدارة فوراً (إشعار + نافذة بالصوت)
 * GET:  الإدارة/المساعد كل الطلبات مع بيانات الكتاب والعميل؛ العميل طلباته فقط
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Ebook, EbookOrder, User } from "@/lib/models";
import { requireUser } from "@/lib/auth";
import { notifyStaff } from "@/lib/push";
import { ebookOrderStaffText } from "@/lib/notify-text";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    const staff = me.role === "admin" || me.role === "assistant";
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";

    const q: Record<string, unknown> = staff ? {} : { clientId: me._id };
    if (["pending", "accepted", "paid"].includes(status)) q.status = status;

    const rows = await EbookOrder.find(q).sort({ createdAt: -1 }).limit(200).lean<
      Record<string, unknown>[]
    >();

    /* بيانات الكتب والعملاء المرتبطة — دفعة واحدة */
    const bookIds = [...new Set(rows.map((r) => String(r.ebookId)))];
    const clientIds = [...new Set(rows.map((r) => String(r.clientId)))];
    const books = await Ebook.find({ _id: { $in: bookIds } })
      .select("title titleFr titleEn price coverBase64 driveLink")
      .lean<Record<string, unknown>[]>();
    const clients = await User.find({ _id: { $in: clientIds } })
      .select("name phone")
      .lean<Record<string, unknown>[]>();
    const bookMap = new Map(books.map((b) => [String(b._id), b]));
    const clientMap = new Map(clients.map((c) => [String(c._id), c]));

    return ok({
      orders: rows.map((r) => {
        const b = bookMap.get(String(r.ebookId));
        const c = clientMap.get(String(r.clientId));
        return {
          ...r,
          book: b
            ? {
                _id: String(b._id),
                title: b.title,
                titleFr: b.titleFr,
                titleEn: b.titleEn,
                coverBase64: b.coverBase64,
                price: b.price,
              }
            : null,
          client: c ? { name: c.name, phone: c.phone } : null,
        };
      }),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser(["client"]);
    const b = await req.json().catch(() => ({}));
    const ebookId = String(b.ebookId || "");
    if (!ebookId) return fail(400, "الكتاب مطلوب");

    const book = await Ebook.findById(ebookId).lean<Record<string, unknown> | null>();
    if (!book || book.active === false) return fail(404, "الكتاب غير متاح");
    const price = Math.max(0, Number(book.price) || 0);
    if (price <= 0) return fail(400, "هذا الكتاب مجاني — اقرأه مباشرة");

    /* طلب واحد فعال لكل عميل/كتاب: بانتظار أو مقبول أو مفعّل — إعادة الطلب رفض */
    const existing = await EbookOrder.findOne({
      ebookId: ebookId,
      clientId: me._id,
      status: { $in: ["pending", "accepted", "paid"] },
    }).lean<{ status: string } | null>();
    if (existing) {
      if (existing.status === "paid") return fail(409, "هذا الكتاب مفعّل في حسابك بالفعل");
      return fail(409, "لديك طلب قائم لهذا الكتاب — بانتظار مراجعة الإدارة");
    }

    const o = await EbookOrder.create({ ebookId: ebookId, clientId: me._id, price });
    await logAudit(
      { _id: me._id, name: me.name, role: me.role },
      "ebook.order",
      `كتاب: ${String(book.title)}`,
      `السعر: ${price} دج`,
      String(o._id)
    );

    /* إشعار فريق الإدارة فوراً — النافذة المنبثقة بالصوت تلتقطه عند الاستطلاع التالي */
    notifyStaff(
      ebookOrderStaffText({ clientName: me.name, clientPhone: me.phone, bookTitle: String(book.title), price }),
      "ebook_order",
      "orders"
    );

    return ok({ order: o.toObject() });
  });
}

/**
 * الكتب الإلكترونية
 * GET: للجميع — بطاقات العنوان والنبذة والغلاف + السعر وحالة طلبي
 *      ★ v3.20: المحتوى (blocks) ورابط Drive لا يُرسَنان في القائمة أبداً
 *      (القارئ يجلب الكتاب منفرداً حيث تُطبَّق قواعد الوصول بدقة)
 * POST: الإدارة والمساعد — مع السعر بالدينار ورابط Google Drive وملف PDF المدمج (★ v3.25)
 */
import { NextRequest } from "next/server";
import { ok, fail, handle, withPublicCache, isAuthedReq } from "@/lib/api-helpers";
import { Ebook, EbookOrder } from "@/lib/models";
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

export async function GET(req: NextRequest) {
  /* ★ v3.28: النداء الموثق (توكن) بلا كاش — استجابته متغيرة حسب المستخدم */
  const __res = await handle(async () => {
    const me = await currentUser();
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "1" && me && isStaff(me.role);
    const q = all ? {} : { active: true };
    const ebooks = await Ebook.find(q).sort({ createdAt: -1 }).lean<Record<string, unknown>[]>();

    /* ★ v3.20: حالة طلبي لكل كتاب (للعميل) — شارة الحالة وزر الشراء يبنىان عليها */
    let myOrders: Record<string, string> = {};
    if (me && me.role === "client") {
      const rows = await EbookOrder.find({ clientId: me._id }).lean<{ ebookId: unknown; status: string }[]>();
      myOrders = Object.fromEntries(rows.map((r) => [String(r.ebookId), r.status]));
    }

    return ok({
      ebooks: ebooks.map((e) => {
        const driveHas = !!e.driveLink;
        /* ★ v3.25: رابط PDF المدمج لا يُكشف في القائمة — pdfHas يكفي للشارات
           (مسار الوسائط عام والاسم العشوائي حماية إضافية، فلا يُسرَّب الرابط لغير المستحق) */
        const { blocks: _blocks, driveLink: _drive, pdfUrl: _pdf, ...rest } = e;
        return { ...rest, driveHas, pdfHas: !!e.pdfUrl, myOrder: myOrders[String(e._id)] || null };
      }),
    });
  });
    /* ★ v3.28: كاش الحافة للنسخة العامة فقط */
    return withPublicCache(__res, !isAuthedReq(req));
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin", "assistant"]);
    const b = await req.json().catch(() => ({}));
    const title = String(b.title || "").trim();
    if (!title) return fail(400, "عنوان الكتاب مطلوب");
    /* ★ v3.20: السعر بالدينار — 0 = مجاني، > 0 = مدفوع؛ رابط Drive اختياري مُطبَّع */
    const price = Math.max(0, Math.round(Number(b.price) || 0));
    const driveLink = normDrive(b.driveLink);
    const e = await Ebook.create({
      title,
      titleFr: String(b.titleFr || ""),
      titleEn: String(b.titleEn || ""),
      summary: String(b.summary || ""),
      summaryFr: String(b.summaryFr || ""),
      summaryEn: String(b.summaryEn || ""),
      author: String(b.author || ""),
      coverBase64: String(b.coverBase64 || ""),
      price,
      driveLink,
      pdfUrl: normPdfUrl(b.pdfUrl),
      direction: normDirection(b.direction),
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

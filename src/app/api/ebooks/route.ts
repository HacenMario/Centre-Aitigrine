/**
 * الكتب الإلكترونية
 * GET: للجميع — بطاقات العنوان والنبذة والغلاف + السعر وحالة طلبي
 *      ★ v3.20: المحتوى (blocks) ورابط Drive لا يُرسَنان في القائمة أبداً
 *      (القارئ يجلب الكتاب منفرداً حيث تُطبَّق قواعد الوصول بدقة)
 * POST: الإدارة والمساعد — مع السعر بالدينار ورابط Google Drive
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Ebook, EbookOrder } from "@/lib/models";
import { currentUser, isStaff, requireUser } from "@/lib/auth";

/** تطبيع رابط Drive — يُقبل http/https فقط وطول معقول */
function normDrive(v: unknown): string {
  const s = String(v || "").trim();
  if (!s) return "";
  if (!/^https?:\/\/\S+$/i.test(s) || s.length > 2048) return "";
  return s;
}

export async function GET(req: NextRequest) {
  return handle(async () => {
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
        const { blocks: _blocks, driveLink: _drive, ...rest } = e;
        return { ...rest, driveHas, myOrder: myOrders[String(e._id)] || null };
      }),
    });
  });
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

/**
 * شهادات وقصص النجاح (v3.8)
 * GET    /api/testimonials          → عام: المعتمدة فقط (الاسم محوّل بلا أسماء كاملة)
 *                                     للإدارة: كل الشهادات مع الأسماء الحقيقية
 * POST   /api/testimonials          → إدارة فقط: إضافة شهادة/قصة { authorReal?, text, textFr?, textEn?, rating, kind }
 * PATCH  /api/testimonials?id=      → إدارة فقط: تعديل/اعتماد
 * DELETE /api/testimonials?id=      → إدارة فقط
 * ★ سياسة الخصوصية: العرض العمومي لا يُظهر يوماً اسماً كاملاً —
 *   يحول الاسم تلقائياً إلى "الأول + حرف البداية" (مثال: أمينة ب.) ما لم تحدد الإدارة صيغة علنية.
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Testimonial } from "@/lib/models";
import { requireUser, isStaff, currentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

type TLean = {
  _id: unknown;
  authorReal: string;
  authorPublic: string;
  text: string;
  textFr: string;
  textEn: string;
  rating: number;
  kind: string;
  approved: boolean;
  createdAt?: Date;
};

/** تحويل الاسم لصيغة عمومية آمنة: "أمينة بن علي" → "أمينة ب." */
function anonymize(real: string, pub: string): string {
  if (pub && pub.trim()) return pub.trim().slice(0, 40);
  const parts = String(real || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  const first = parts[0];
  const initial = parts[1] ? parts[1][0] + "." : "";
  return `${first} ${initial}`.trim();
}

export async function GET() {
  return handle(async () => {
    const me = await currentUser();
    const staff = !!(me && isStaff(me.role));
    const filter = staff ? {} : { approved: true };
    const rows = await Testimonial.find(filter).sort({ createdAt: -1 }).limit(200).lean<TLean[]>();
    return ok({
      items: rows.map((r) => ({
        _id: String(r._id),
        /* العمومي: صيغة محولة — الإدارة وحدها ترى الاسم الحقيقي */
        author: staff ? r.authorReal || "—" : anonymize(r.authorReal, r.authorPublic),
        authorReal: staff ? r.authorReal : undefined,
        text: r.text,
        textFr: r.textFr || "",
        textEn: r.textEn || "",
        rating: r.rating || 5,
        kind: r.kind || "testimonial",
        approved: !!r.approved,
        at: r.createdAt,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    if (!isStaff(me.role)) return fail(403, "إدارة الشهادات متاحة للإدارة فقط");
    const b = await req.json().catch(() => null);
    if (!b) return fail(400, "بيانات غير صالحة");
    const text = String(b.text || "").trim();
    if (text.length < 10) return fail(400, "نص الشهادة قصير جداً (10 أحرف على الأقل)");
    const doc = await Testimonial.create({
      authorReal: String(b.authorReal || "").slice(0, 120),
      authorPublic: String(b.authorPublic || "").slice(0, 40),
      text: text.slice(0, 2000),
      textFr: String(b.textFr || "").slice(0, 2000),
      textEn: String(b.textEn || "").slice(0, 2000),
      rating: Math.min(5, Math.max(1, Number(b.rating) || 5)),
      kind: b.kind === "story" ? "story" : "testimonial",
      approved: !!b.approved,
      submittedBy: me._id,
    });
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "testimonial.create", `شهادة: ${anonymize(String(b.authorReal || ""), String(b.authorPublic || ""))}`, doc.approved ? "منشورة" : "بانتظار الاعتماد", String(doc._id));
    return ok({ _id: String(doc._id) });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    if (!isStaff(me.role)) return fail(403, "إدارة الشهادات متاحة للإدارة فقط");
    const id = req.nextUrl.searchParams.get("id") || "";
    const b = await req.json().catch(() => null);
    if (!id || !b) return fail(400, "معرّف أو بيانات ناقصة");
    const doc = await Testimonial.findById(id);
    if (!doc) return fail(404, "الشهادة غير موجودة");
    if (typeof b.approved === "boolean") doc.approved = b.approved;
    if (b.authorReal !== undefined) doc.authorReal = String(b.authorReal).slice(0, 120);
    if (b.authorPublic !== undefined) doc.authorPublic = String(b.authorPublic).slice(0, 40);
    if (b.text !== undefined && String(b.text).trim().length >= 10) doc.text = String(b.text).slice(0, 2000);
    if (b.textFr !== undefined) doc.textFr = String(b.textFr).slice(0, 2000);
    if (b.textEn !== undefined) doc.textEn = String(b.textEn).slice(0, 2000);
    if (b.rating !== undefined) doc.rating = Math.min(5, Math.max(1, Number(b.rating) || 5));
    if (b.kind !== undefined) doc.kind = b.kind === "story" ? "story" : "testimonial";
    await doc.save();
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "testimonial.update", `شهادة: ${doc._id}`, doc.approved ? "معتمدة" : "غير معتمدة", id);
    return ok({ ok: true });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    if (!isStaff(me.role)) return fail(403, "إدارة الشهادات متاحة للإدارة فقط");
    const id = req.nextUrl.searchParams.get("id") || "";
    const doc = await Testimonial.findByIdAndDelete(id).lean<TLean | null>();
    if (!doc) return fail(404, "الشهادة غير موجودة");
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "testimonial.delete", `شهادة: ${doc._id}`, "حذف", id);
    return ok({ ok: true });
  });
}

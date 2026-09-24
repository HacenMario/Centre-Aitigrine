/**
 * كوبونات الخصم والعروض (v3.8)
 * GET    /api/coupons          → قائمة الكوبونات (إدارة/مساعد)
 * POST   /api/coupons          → إنشاء كوبون (إدارة/مساعد) { code, kind, value, description*, maxUses, expiresAt, minPrice }
 * PATCH  /api/coupons?id=      → تعديل (تفعيل/قيم) (إدارة/مساعد)
 * DELETE /api/coupons?id=      → حذف (إدارة/مساعد)
 * GET    /api/coupons?validate=CODE&price=NN → تحقق عام للعميل: يعمل الكوبون على هذا السعر؟
 *   → { ok, coupon: { code, kind, value, discount } } أو خطأ مفهوم
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Coupon } from "@/lib/models";
import { requireUser, isStaff, currentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

type CouponLean = {
  _id: unknown;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  description?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  maxUses: number;
  usedCount: number;
  expiresAt: Date | null;
  minPrice: number;
  active: boolean;
  createdAt?: Date;
};

/** حساب الخصم المبلغ من كوبون على سعر */
export function discountOf(c: { kind: string; value: number }, price: number): number {
  const d = c.kind === "percent" ? Math.round(((price || 0) * c.value) / 100) : c.value;
  return Math.max(0, Math.min(d, price || 0));
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const code = (req.nextUrl.searchParams.get("validate") || "").trim().toUpperCase();
    /* ── تحقق عام (للعميل عند الحجز) ── */
    if (code) {
      const price = Number(req.nextUrl.searchParams.get("price")) || 0;
      const c = await Coupon.findOne({ code }).lean<CouponLean | null>();
      if (!c || !c.active) return fail(404, "الكوبون غير موجود أو معطل");
      if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now())
        return fail(410, "انتهت صلاحية هذا الكوبون");
      if (c.maxUses > 0 && (c.usedCount || 0) >= c.maxUses)
        return fail(409, "استُنفدت عدد استخدامات هذا الكوبون");
      if (c.minPrice > 0 && price < c.minPrice)
        return fail(422, `هذا الكوبون يتطلب سعراً لا يقل عن ${c.minPrice} دج`);
      return ok({
        coupon: {
          code: c.code,
          kind: c.kind,
          value: c.value,
          discount: discountOf(c, price),
          description: c.description || "",
          descriptionFr: c.descriptionFr || "",
          descriptionEn: c.descriptionEn || "",
        },
      });
    }

    /* ── قائمة الإدارة ── */
    const me = await requireUser();
    if (!isStaff(me.role)) return fail(403, "لا تملك صلاحية لإدارة الكوبونات");
    const rows = await Coupon.find({}).sort({ createdAt: -1 }).limit(300).lean<CouponLean[]>();
    return ok({
      items: rows.map((c) => ({
        _id: String(c._id),
        code: c.code,
        kind: c.kind,
        value: c.value,
        description: c.description || "",
        descriptionFr: c.descriptionFr || "",
        descriptionEn: c.descriptionEn || "",
        maxUses: c.maxUses || 0,
        usedCount: c.usedCount || 0,
        expiresAt: c.expiresAt,
        minPrice: c.minPrice || 0,
        active: c.active !== false,
        expired: !!(c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()),
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    if (!isStaff(me.role)) return fail(403, "لا تملك صلاحية لإنشاء الكوبونات");
    const b = await req.json().catch(() => null);
    if (!b) return fail(400, "بيانات غير صالحة");
    const code = String(b.code || "").trim().toUpperCase();
    const kind = b.kind === "fixed" ? "fixed" : "percent";
    const value = Number(b.value);
    if (!/^[A-Z0-9-]{3,24}$/.test(code))
      return fail(400, "رمز الكوبون: 3-24 حرفاً إنجليزياً كبيراً أو أرقاماً");
    if (!value || value <= 0) return fail(400, "قيمة الكوبون مطلوبة");
    if (kind === "percent" && value > 100) return fail(400, "نسبة الخصم لا تتجاوز 100%");
    const exists = await Coupon.findOne({ code }).lean();
    if (exists) return fail(409, "رمز الكوبون مستعمل من قبل — اختر رمزاً آخر");
    const doc = await Coupon.create({
      code,
      kind,
      value,
      description: String(b.description || "").slice(0, 300),
      descriptionFr: String(b.descriptionFr || "").slice(0, 300),
      descriptionEn: String(b.descriptionEn || "").slice(0, 300),
      maxUses: Math.max(0, Number(b.maxUses) || 0),
      minPrice: Math.max(0, Number(b.minPrice) || 0),
      expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
    });
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "coupon.create", `كوبون: ${code}`, `${kind === "percent" ? `${value}%` : `${value} دج`}`, String(doc._id));
    return ok({ _id: String(doc._id) });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    if (!isStaff(me.role)) return fail(403, "لا تملك صلاحية لتعديل الكوبونات");
    const id = req.nextUrl.searchParams.get("id") || "";
    const b = await req.json().catch(() => null);
    if (!id || !b) return fail(400, "معرّف أو بيانات ناقصة");
    const c = await Coupon.findById(id);
    if (!c) return fail(404, "الكوبون غير موجود");
    const before = `${c.kind === "percent" ? c.value + "%" : c.value + " دج"} active=${c.active}`;
    if (typeof b.active === "boolean") c.active = b.active;
    if (b.value !== undefined) {
      const v = Number(b.value);
      if (!v || v <= 0) return fail(400, "قيمة غير صالحة");
      if (c.kind === "percent" && v > 100) return fail(400, "النسبة لا تتجاوز 100%");
      c.value = v;
    }
    if (b.description !== undefined) c.description = String(b.description).slice(0, 300);
    if (b.maxUses !== undefined) c.maxUses = Math.max(0, Number(b.maxUses) || 0);
    if (b.minPrice !== undefined) c.minPrice = Math.max(0, Number(b.minPrice) || 0);
    if (b.expiresAt !== undefined) c.expiresAt = b.expiresAt ? new Date(b.expiresAt) : null;
    await c.save();
    const after = `${c.kind === "percent" ? c.value + "%" : c.value + " دج"} active=${c.active}`;
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "coupon.update", `كوبون: ${c.code}`, `${before} → ${after}`, id);
    return ok({ ok: true });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    if (!isStaff(me.role)) return fail(403, "لا تملك صلاحية لحذف الكوبونات");
    const id = req.nextUrl.searchParams.get("id") || "";
    const c = await Coupon.findByIdAndDelete(id).lean<CouponLean | null>();
    if (!c) return fail(404, "الكوبون غير موجود");
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "coupon.delete", `كوبون: ${c.code}`, "حذف", id);
    void currentUser;
    return ok({ ok: true });
  });
}

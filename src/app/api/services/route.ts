/**
 * الخدمات — GET للجميع (المفعّلة فقط للعميل) — POST للإدارة
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Service } from "@/lib/models";
import { currentUser, isStaff, requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await currentUser();
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "1" && me && isStaff(me.role);
    const q = all ? {} : { active: true };
    const services = await Service.find(q).sort({ order: 1, createdAt: -1 }).lean();
    return ok({ services });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin", "assistant"]);
    const b = await req.json().catch(() => ({}));
    const title = String(b.title || "").trim();
    if (!title) return fail(400, "عنوان الخدمة مطلوب");
    const s = await Service.create({
      title,
      titleFr: String(b.titleFr || ""),
      titleEn: String(b.titleEn || ""),
      description: String(b.description || ""),
      descriptionFr: String(b.descriptionFr || ""),
      descriptionEn: String(b.descriptionEn || ""),
      icon: String(b.icon || "✨").slice(0, 8),
      category: String(b.category || ""),
      price: Number(b.price) || 0,
      durationMin: Number(b.durationMin) || 60,
      coverBase64: String(b.coverBase64 || ""),
      active: b.active !== false,
      order: Number(b.order) || 0,
    });
    return ok({ service: s.toObject() });
  });
}

/** تعديل/تفعيل/حذف تكوين — الإدارة | POST: تسجيل عميل في تكوين (نمط طمأنينة) */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Course } from "@/lib/models";
import { requireUser } from "@/lib/auth";
import { notifyStaff } from "@/lib/push";
import { enrollRequestText } from "@/lib/notify-text";

type Ctx = { params: Promise<{ id: string }> };

/** تسجيل في التكوين — عميل مسجل: مرة واحدة لكل عميل + إشعار للإدارة */
export async function POST(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await requireUser(["client"]);
    const { id } = await ctx.params;
    const c = await Course.findById(id);
    if (!c || !c.active) return fail(404, "التكوين غير متاح");
    const ids = ((c.enrolledIds as unknown[]) || []).map(String);
    if (ids.includes(String(me._id))) return fail(409, "أنت مسجل مسبقاً في هذا التكوين");
    if (c.capacity > 0 && ids.length >= c.capacity) return fail(409, "اكتملت مقاعد هذا التكوين");
    c.enrolledIds = [...(ids.map((x) => x)), me._id] as never;
    await c.save();
    notifyStaff(
      enrollRequestText({ clientName: me.name, clientPhone: me.phone, courseTitle: c.title }),
      "courses",
      "courses"
    );
    return ok({ enrolled: true, enrolledCount: ids.length + 1 });
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser(["admin", "assistant"]);
    const { id } = await ctx.params;
    const c = await Course.findById(id);
    if (!c) return fail(404, "التكوين غير موجود");
    const b = await req.json().catch(() => ({}));
    if (b.title !== undefined) c.title = String(b.title).trim();
    if (b.titleFr !== undefined) c.titleFr = String(b.titleFr);
    if (b.titleEn !== undefined) c.titleEn = String(b.titleEn);
    if (b.titleTr !== undefined) c.titleTr = String(b.titleTr);
    if (b.titleEs !== undefined) c.titleEs = String(b.titleEs);
    if (b.description !== undefined) c.description = String(b.description);
    if (b.descriptionFr !== undefined) c.descriptionFr = String(b.descriptionFr);
    if (b.descriptionTr !== undefined) c.descriptionTr = String(b.descriptionTr);
    if (b.descriptionEs !== undefined) c.descriptionEs = String(b.descriptionEs);
    if (b.descriptionEn !== undefined) c.descriptionEn = String(b.descriptionEn);
    if (b.category !== undefined) c.category = String(b.category);
    if (b.trainerName !== undefined) c.trainerName = String(b.trainerName);
    if (b.price !== undefined) c.price = Number(b.price) || 0;
    if (b.capacity !== undefined) c.capacity = Number(b.capacity) || 0;
    if (typeof b.coverBase64 === "string") c.coverBase64 = b.coverBase64;
    if (Array.isArray(b.images)) c.images = b.images.map(String).slice(0, 12);
    if (Array.isArray(b.sessions))
      c.sessions = b.sessions
        .filter((s: { date?: string; start?: string; end?: string }) => s?.date && s?.start && s?.end)
        .map((s: { title?: string; date: string; start: string; end: string }) => ({
          title: String(s.title || ""),
          date: String(s.date),
          start: String(s.start),
          end: String(s.end),
        }));
    if (typeof b.active === "boolean") c.active = b.active;
    await c.save();
    return ok({ course: c.toObject() });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    await requireUser(["admin"]);
    const { id } = await ctx.params;
    await Course.findByIdAndDelete(id);
    return ok();
  });
}

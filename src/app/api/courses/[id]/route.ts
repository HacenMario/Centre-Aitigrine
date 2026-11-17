/** تعديل/تفعيل/حذف تكوين — الإدارة | POST: تسجيل عميل في تكوين (نمط طمأنينة)
 * ★ v3.11: المكوِّن المسؤول (trainerId) — مرجع حساب دور «مكون» أو «أخصائي»
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Course, User, ActivityLog } from "@/lib/models";
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
    /* ★ v3.20: نبضة إثبات اجتماعي — مقعد تكوين جديد (اسم أول فقط) */
    ActivityLog.create({
      userId: me._id,
      kind: "course",
      name: me.name.trim().split(/\s+/)[0] || "",
      labels: {
        ar: c.title,
        fr: c.titleFr || c.title,
        en: c.titleEn || c.title,
        tr: c.titleEn || c.title,
        es: c.titleEn || c.title,
      },
      /* ★ v3.24: موعد انطلاق التكوين إن توفر */
      meta: { mode: "", when: String((c as unknown as { startDate?: string }).startDate || "") },
    }).catch(() => {});
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
    if (b.description !== undefined) c.description = String(b.description);
    if (b.descriptionFr !== undefined) c.descriptionFr = String(b.descriptionFr);
    if (b.descriptionEn !== undefined) c.descriptionEn = String(b.descriptionEn);
    if (b.category !== undefined) c.category = String(b.category);
    /* ★ v3.11: المكوِّن المسؤول — تحقق خادمي عند التعديل + مزامنة الاسم */
    if (b.trainerId !== undefined) {
      if (!b.trainerId) {
        c.trainerId = null;
        if (b.trainerName !== undefined) c.trainerName = String(b.trainerName);
      } else {
        const tu = await User.findById(String(b.trainerId))
          .select("name role active")
          .lean<{ _id: unknown; name: string; role: string; active?: boolean } | null>();
        if (!tu || tu.active === false || !["trainer", "specialist"].includes(tu.role))
          return fail(400, "المكوِّن المحدد غير صالح");
        c.trainerId = tu._id as never;
        c.trainerName = tu.name;
      }
    } else if (b.trainerName !== undefined) c.trainerName = String(b.trainerName);
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

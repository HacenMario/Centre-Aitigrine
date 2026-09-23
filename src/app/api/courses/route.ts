/** التكوينات — GET للجميع (مع enrolledCount للمقاعد المتبقية)، POST للإدارة */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Course } from "@/lib/models";
import { currentUser, isStaff, requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await currentUser();
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "1" && me && isStaff(me.role);
    const q = all ? {} : { active: true };
    const courses = await Course.find(q).sort({ createdAt: -1 }).lean();
    /* عدد المسجلين لكل تكوين — لحساب المقاعد المتبقية (نمط طمأنينة) */
    const mine = me?._id ? String(me._id) : null;
    return ok({
      courses: courses.map((c) => ({
        ...c,
        enrolledCount: ((c.enrolledIds as unknown[]) || []).length,
        enrolledByMe: mine ? ((c.enrolledIds as unknown[]) || []).some((x) => String(x) === mine) : false,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin", "assistant"]);
    const b = await req.json().catch(() => ({}));
    const title = String(b.title || "").trim();
    if (!title) return fail(400, "عنوان التكوين مطلوب");
    const c = await Course.create({
      title,
      titleFr: String(b.titleFr || ""),
      titleEn: String(b.titleEn || ""),
      description: String(b.description || ""),
      descriptionFr: String(b.descriptionFr || ""),
      descriptionEn: String(b.descriptionEn || ""),
      category: String(b.category || ""),
      trainerName: String(b.trainerName || ""),
      price: Number(b.price) || 0,
      capacity: Number(b.capacity) || 0,
      coverBase64: String(b.coverBase64 || ""),
      images: Array.isArray(b.images) ? b.images.map(String).slice(0, 12) : [],
      sessions: Array.isArray(b.sessions)
        ? b.sessions
            .filter((s: { date?: string; start?: string; end?: string }) => s?.date && s?.start && s?.end)
            .map((s: { title?: string; date: string; start: string; end: string }) => ({
              title: String(s.title || ""),
              date: String(s.date),
              start: String(s.start),
              end: String(s.end),
            }))
        : [],
      active: b.active !== false,
    });
    return ok({ course: c.toObject() });
  });
}

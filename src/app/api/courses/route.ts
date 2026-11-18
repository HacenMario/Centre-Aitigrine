/** التكوينات — GET للجميع (مع enrolledCount للمقاعد المتبقية)، POST للإدارة
 * ★ v3.11: المكوِّن المسؤول (trainerId) — مرجع حساب دور «مكون» يُزامن اسمه trainerName
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Course, User } from "@/lib/models";
import { currentUser, isStaff, requireUser } from "@/lib/auth";

/* ★ v3.26: مواد التكوين — تحقق روابط PDF الداخلية */
const normMat = (m: unknown): { name: string; url: string }[] =>
  Array.isArray(m)
    ? (m as { name?: unknown; url?: unknown })
        .map((x) => ({ name: String(x?.name || "").trim().slice(0, 200), url: String(x?.url || "") }))
        .filter((x) => /^\/api\/media\/[A-Za-z0-9._%-]+\.pdf$/.test(x.url))
        .slice(0, 20)
    : [];

export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await currentUser();
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "1" && me && isStaff(me.role);
    const q = all ? {} : { active: true };
    const courses = await Course.find(q).sort({ createdAt: -1 }).lean();
    /* ★ v3.11: مزامنة أسماء المكوِّنين — resolvetrainerId → أحدث اسم للحساب (يغطي تغيير الاسم)
     * وترجيع trainerRole لبطاقة التكوين لعرض شارة (أخصائي/مكوِّن) */
    const tIds = new Set<string>();
    courses.forEach((c) => {
      const tid = (c as { trainerId?: unknown }).trainerId;
      if (tid) tIds.add(String(tid));
    });
    let trainerMap = new Map<string, { name: string; role: string }>();
    if (tIds.size) {
      const tus = await User.find({ _id: { $in: [...tIds] } })
        .select("name role")
        .lean<{ _id: unknown; name: string; role: string }[]>();
      trainerMap = new Map(
        tus.map((u) => [String(u._id), { name: u.name, role: u.role }])
      );
    }
    /* عدد المسجلين لكل تكوين — لحساب المقاعد المتبقية (نمط طمأنينة) */
    const mine = me?._id ? String(me._id) : null;
    return ok({
      courses: courses.map((c) => {
        const tid = String((c as { trainerId?: unknown }).trainerId || "");
        const tu = tid ? trainerMap.get(tid) : undefined;
        const enrolledByMe = mine ? ((c.enrolledIds as unknown[]) || []).some((x) => String(x) === mine) : false;
        /* ★ v3.26: مواد التكوين للمسجّلين والمدرب والإدارة حصراً — لا تُكشف روابطها لغيرهم */
        const canSeeMaterials = Boolean(all || (mine && (tid === mine || enrolledByMe)));
        return {
          ...c,
          trainerId: tid || null,
          trainerName: tu?.name || c.trainerName || "",
          trainerRole: tu?.role || "",
          enrolledCount: ((c.enrolledIds as unknown[]) || []).length,
          enrolledByMe,
          materials: canSeeMaterials ? normMat(c.materials) : [],
        };
      }),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin", "assistant"]);
    const b = await req.json().catch(() => ({}));
    const title = String(b.title || "").trim();
    if (!title) return fail(400, "عنوان التكوين مطلوب");

    /* ★ v3.11: المكوِّن المسؤول — تحقق خادمي: حساب نشط بدور «مكون» (أو أخصائي) */
    let trainerId: string | null = null;
    let trainerName = String(b.trainerName || "");
    if (b.trainerId) {
      const tu = await User.findById(String(b.trainerId))
        .select("name role active")
        .lean<{ _id: unknown; name: string; role: string; active?: boolean } | null>();
      if (!tu || tu.active === false || !["trainer", "specialist"].includes(tu.role))
        return fail(400, "المكوِّن المحدد غير صالح");
      trainerId = String(tu._id);
      trainerName = tu.name;
    }

    const c = await Course.create({
      title,
      titleFr: String(b.titleFr || ""),
      titleEn: String(b.titleEn || ""),
      description: String(b.description || ""),
      descriptionFr: String(b.descriptionFr || ""),
      descriptionEn: String(b.descriptionEn || ""),
      category: String(b.category || ""),
      trainerId,
      trainerName,
      price: Number(b.price) || 0,
      capacity: Number(b.capacity) || 0,
      coverBase64: String(b.coverBase64 || ""),
      images: Array.isArray(b.images) ? b.images.map(String).slice(0, 12) : [],
      materials: normMat(b.materials),
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

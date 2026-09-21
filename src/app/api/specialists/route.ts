/**
 * قائمة الأخصائيين العامة (نمط طمأنينة /api/counselors)
 * GET: للجميع (ضيوف + عملاء) — بيانات العرض الكاملة:
 * الاسم، اللقب (ثلاثي اللغة)، التخصصات المرتبطة (مترجمة)، سنوات الخبرة،
 * اللغات، النبذة (ثلاثية اللغة)، الصورة، ساعات العمل، متوسط التقييم
 * بدون حقول حساسة (لا هاتف ولا كلمات مرور ولا حسابات الطاقم)
 */
import { NextRequest } from "next/server";
import { ok, handle } from "@/lib/api-helpers";
import { Rating, Specialty, User } from "@/lib/models";
import { mapToObj } from "@/lib/map";

type SpecRow = {
  _id: unknown;
  name: string;
  title?: string;
  titleFr?: string;
  titleEn?: string;
  specialty?: string;
  langs?: string[];
  bio?: string;
  bioFr?: string;
  bioEn?: string;
  yearsExperience?: number;
  specialties?: unknown[];
  photoBase64?: string;
  weeklyHours?: Map<string, string[]>;
};

export async function GET(req: NextRequest) {
  return handle(async () => {
    const { searchParams } = new URL(req.url);
    const specialty = searchParams.get("specialty");
    const q: Record<string, unknown> = { role: "specialist", active: true };
    if (specialty && ["psychological", "art_therapy"].includes(specialty)) {
      q.specialty = { $in: [specialty, "both"] };
    }
    const rows = await User.find(q).sort({ createdAt: 1 }).lean<SpecRow[]>();

    /* التخصصات المفصّلة لكل الأخصائيين في استعلام واحد */
    const allIds = new Set<string>();
    rows.forEach((u) => {
      const arr = Array.isArray(u.specialties) ? u.specialties : [];
      arr.forEach((s) => {
        if (s && typeof s === "object" && "toString" in (s as object)) allIds.add(String(s));
        else if (s) allIds.add(String(s));
      });
    });
    const specs = allIds.size
      ? await Specialty.find({ _id: { $in: [...allIds] } })
          .select("name builtin order")
          .lean<{ _id: unknown; name: { ar?: string; fr?: string; en?: string }; builtin?: boolean }[]>()
      : [];
    const specMap = new Map(
      specs.map((s) => [
        String(s._id),
        { _id: String(s._id), ar: s.name?.ar || "", fr: s.name?.fr || "", en: s.name?.en || "", builtin: !!s.builtin },
      ])
    );

    /* متوسط التقييم لكل أخصائي في استعلام تجميعي واحد */
    const ratingAgg = await Rating.aggregate([
      { $group: { _id: "$specialistId", avg: { $avg: "$stars" }, count: { $sum: 1 } } },
    ]);
    const ratingMap = new Map(
      (ratingAgg as { _id: string; avg: number; count: number }[]).map((r) => [
        String(r._id),
        { avg: Math.round(r.avg * 10) / 10, count: r.count },
      ])
    );

    return ok({
      specialists: rows.map((u) => {
        const arr = Array.isArray(u.specialties) ? u.specialties : [];
        const linked = arr
          .map((s) => specMap.get(String(s)))
          .filter(Boolean) as { _id: string; ar: string; fr: string; en: string; builtin: boolean }[];
        const rating = ratingMap.get(String(u._id)) || { avg: 0, count: 0 };
        return {
          _id: String(u._id),
          name: u.name,
          title: u.title || "",
          titleFr: u.titleFr || "",
          titleEn: u.titleEn || "",
          specialty: u.specialty || "psychological",
          langs: u.langs ?? ["ar"],
          bio: u.bio || "",
          bioFr: u.bioFr || "",
          bioEn: u.bioEn || "",
          yearsExperience: u.yearsExperience ?? 0,
          specialties: linked,
          photoBase64: u.photoBase64 || "",
          weeklyHours: mapToObj(u.weeklyHours) as Record<string, string[]>,
          rating,
        };
      }),
    });
  });
}

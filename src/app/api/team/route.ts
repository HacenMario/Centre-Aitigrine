/**
 * فريق المركز — أخصائيون نشطون (معلومات عامة آمنة للصفحة الرئيسية)
 * ★ v3.23.1: كاش حافة عام — الاستجابة متطابقة لكل الزوار وبها صور base64 ثقيلة،
 *   تخديمها من الـ CDN يقلص Fast Origin Transfer (التحديث يظهر خلال ≤60 ثانية كحد أقصى)
 */
import { ok, handle, PUBLIC_EDGE_CACHE } from "@/lib/api-helpers";
import { User } from "@/lib/models";

export async function GET() {
  return handle(async () => {
    /* weeklyHours مشمولة — يحتاجها نموذج الحجز لعرض الأوقات المتاحة للعميل */
    const specs = await User.find({ role: "specialist", active: true })
      .select("name title titleFr titleEn specialty langs bio bioFr bioEn yearsExperience specialties photoBase64 weeklyHours")
      .sort({ createdAt: 1 })
      .lean<{ _id: unknown; name: string; title?: string; specialty?: string; langs?: string[]; bio?: string; photoBase64?: string; weeklyHours?: unknown }[]>();
    const res = ok({
      team: specs.map((s) => {
        let wh: Record<string, string[]> = {};
        const raw = s.weeklyHours as unknown;
        try {
          if (raw instanceof Map) wh = Object.fromEntries(raw.entries());
          else if (raw && typeof raw === "object") wh = { ...(raw as Record<string, string[]>) };
        } catch {}
        return {
          _id: String(s._id),
          name: s.name,
          title: s.title || "",
          titleFr: s.titleFr || "",
          titleEn: s.titleEn || "",
          specialty: s.specialty || "psychological",
          langs: s.langs || ["ar"],
          bio: s.bio || "",
          bioFr: s.bioFr || "",
          bioEn: s.bioEn || "",
          yearsExperience: s.yearsExperience ?? 0,
          specialties: Array.isArray(s.specialties) ? s.specialties.map((x) => String(x)) : [],
          photoBase64: s.photoBase64 || "",
          weeklyHours: wh,
        };
      }),
    });
    /* ★ v3.23.1: تخديم من الـ CDN — الزوار المتكررون لا يستدعون الدالة أصلاً */
    res.headers.set("Cache-Control", PUBLIC_EDGE_CACHE);
    return res;
  });
}

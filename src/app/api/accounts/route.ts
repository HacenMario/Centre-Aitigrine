/**
 * الحسابات — الإدارة فقط تنشئ وتعدّل
 * GET: قائمة (إدارة/مساعد) — POST: إنشاء (إدارة فقط)
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { User } from "@/lib/models";
import { hashPassword, requireUser, toSafeUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin", "assistant"]);
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");
    const q: Record<string, unknown> = {};
    if (role && ["admin", "assistant", "specialist", "trainer", "client"].includes(role)) q.role = role;
    const users = await User.find(q).sort({ createdAt: -1 }).lean();
    return ok({ users: users.map(toSafeUser) });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin"]);
    const b = await req.json().catch(() => ({}));
    const name = String(b.name || "").trim();
    const phone = String(b.phone || "").trim();
    const password = String(b.password || "");
    const role = String(b.role || "");
    if (!name || !phone || !password) return fail(400, "الاسم والهاتف وكلمة المرور مطلوبة");
    if (password.length < 6) return fail(400, "كلمة المرور 6 أحرف على الأقل");
    /** ★ v3.11: دور «مكون» — صلاحيات فريق الطاقم بلا مواعيد (انظر توثيق UserSchema في models.ts) */
    if (!["admin", "assistant", "specialist", "trainer", "client"].includes(role))
      return fail(400, "دور غير صحيح");
    const dup = await User.findOne({ phone }).lean();
    if (dup) return fail(409, "رقم الهاتف مستخدم مسبقاً");

    const u = await User.create({
      name,
      phone,
      passwordHash: hashPassword(password),
      role,
      /* الملف المهني: للأخصائي والمكوّن معاً — التخصص الإكلينيكي وساعات الاستقبال للأخصائي فقط */
      specialty: role === "specialist" ? b.specialty || "psychological" : undefined,
      langs: Array.isArray(b.langs) && b.langs.length ? b.langs.map(String) : ["ar"],
      title: String(b.title || ""),
      titleFr: String(b.titleFr || ""),
      titleEn: String(b.titleEn || ""),
      bio: String(b.bio || ""),
      bioFr: String(b.bioFr || ""),
      bioEn: String(b.bioEn || ""),
      yearsExperience:
        role === "specialist" || role === "trainer"
          ? Math.max(0, Math.min(70, Math.round(Number(b.yearsExperience) || 0)))
          : 0,
      specialties:
        (role === "specialist" || role === "trainer") && Array.isArray(b.specialties)
          ? b.specialties.map(String).filter(Boolean)
          : [],
      /* ★ v3.12: الخدمات التي يجيدها الأخصائي — للأخصائي فقط */
      serviceIds:
        role === "specialist" && Array.isArray(b.serviceIds)
          ? b.serviceIds.map(String).filter(Boolean)
          : [],
      /* ★ v3.23: نسبة الأخصائي من كل جلسة (%) — للأخصائي فقط */
      commissionRate:
        role === "specialist" ? Math.max(0, Math.min(100, Math.round(Number(b.commissionRate) || 0))) : 0,
      photoBase64: String(b.photoBase64 || ""),
      /* ساعات العمل: للأخصائي فقط (المكوّن لا يستقبل مواعيد أصلاً) */
      weeklyHours: role === "specialist" ? b.weeklyHours || {} : {},
      assignedSpecialistId: b.assignedSpecialistId || null,
      active: true,
    });
    return ok({ user: toSafeUser(u) });
  });
}

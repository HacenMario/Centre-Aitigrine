/** تعديل/تفعيل/حذف تكوين — الإدارة | POST: تسجيل عميل في تكوين (نمط طمأنينة)
 * ★ v3.11: المكوِّن المسؤول (trainerId) — مرجع حساب دور «مكون» أو «أخصائي»
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Course, User, ActivityLog } from "@/lib/models";
import { requireUser } from "@/lib/auth";
import { notifyStaff, notifyUser } from "@/lib/push";
import { enrollRequestText } from "@/lib/notify-text";

type Ctx = { params: Promise<{ id: string }> };

/** تسجيل في التكوين — عميل مسجل: مرة واحدة لكل عميل + إشعار للإدارة */
/* ★ v3.26: مواد التكوين — تحقق روابط PDF الداخلية */
const normMat = (m: unknown): { name: string; url: string }[] =>
  Array.isArray(m)
    ? (m as { name?: unknown; url?: unknown })
        .map((x) => ({ name: String(x?.name || "").trim().slice(0, 200), url: String(x?.url || "") }))
        .filter((x) => /^\/api\/media\/[A-Za-z0-9._%-]+\.pdf$/.test(x.url))
        .slice(0, 20)
    : [];

export async function POST(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const b = await req.json().catch(() => ({}));
    const { id } = await ctx.params;

    /* ── ★ v3.27: إدارة التسجيلات — تأكيد/رفض/إزالة (الإدارة والمساعد ومالك التكوين) ── */
    const action = String(b.action || "");
    if (action === "confirm" || action === "reject" || action === "remove") {
      const staff = await requireUser(["admin", "assistant", "trainer", "specialist"]);
      const c = await Course.findById(id);
      if (!c) return fail(404, "التكوين غير موجود");
      /* المكوِّن والأخصائي يديران تكوينهما هو فقط */
      if (["trainer", "specialist"].includes(staff.role) && String((c as unknown as { trainerId?: unknown }).trainerId || "") !== String(staff._id))
        return fail(403, "غير مصرح — إدارة التسجيلات لمالك التكوين والإدارة فقط");
      const uid = /^[0-9a-fA-F]{24}$/.test(String(b.userId || "")) ? String(b.userId) : "";
      if (!uid) return fail(400, "معرّف المستخدم غير صالح");

      if (action === "confirm") {
        const pend = ((c.pendingIds as unknown[]) || []).map(String);
        if (!pend.includes(uid)) return fail(409, "لا يوجد طلب تسجيل لهذا المستخدم");
        const ids = ((c.enrolledIds as unknown[]) || []).map(String);
        c.pendingIds = pend.filter((x) => x !== uid) as never;
        if (ids.includes(uid)) {
          await c.save();
          return ok({ enrolledCount: ids.length });
        }
        if (c.capacity > 0 && ids.length >= c.capacity) return fail(409, "اكتملت المقاعد — وسّع السعة أولاً ثم أكّد");
        c.enrolledIds = [...ids, uid] as never;
        await c.save();
        /* نبضة إثبات اجتماعي — تسجيل مؤكد حقيقي */
        const tu = await User.findById(uid).select("name").lean<{ name?: string } | null>();
        ActivityLog.create({
          userId: uid,
          kind: "course",
          name: String(tu?.name || "").trim().split(/\s+/)[0] || "",
          labels: {
            ar: c.title,
            fr: c.titleFr || c.title,
            en: c.titleEn || c.title,
            tr: c.titleEn || c.title,
            es: c.titleEn || c.title,
          },
          meta: { mode: "", when: String((c as unknown as { startDate?: string }).startDate || "") },
        }).catch(() => {});
        notifyUser(
          uid,
          {
            titles: { ar: "تم تأكيد تسجيلك في تكوين", fr: "Votre inscription est confirmée", en: "Your enrollment is confirmed" },
            bodies: {
              ar: `تم تأكيد تسجيلك في تكوين «${c.title}» — تُفتح لك الآن مواد التكوين داخل الموقع.`,
              fr: `Votre inscription à la formation « ${c.title} » est confirmée — les supports sont désormais accessibles sur le site.`,
              en: `Your enrollment in the course "${c.title}" is confirmed — the materials are now available on the site.`,
            },
          },
          "courses",
          "courses"
        );
        return ok({ enrolledCount: ((c.enrolledIds as unknown[]) || []).length });
      }

      if (action === "reject") {
        const pend = ((c.pendingIds as unknown[]) || []).map(String);
        if (!pend.includes(uid)) return fail(409, "لا يوجد طلب تسجيل لهذا المستخدم");
        c.pendingIds = pend.filter((x) => x !== uid) as never;
        await c.save();
        notifyUser(
          uid,
          {
            titles: { ar: "بشأن طلب تسجيلك في تكوين", fr: "Concernant votre demande d'inscription", en: "About your enrollment request" },
            bodies: {
              ar: `لم يُقبل طلب تسجيلك في تكوين «${c.title}». للاستفسار تواصل مع إدارة المركز.`,
              fr: `Votre demande d'inscription à la formation « ${c.title} » n'a pas été acceptée. Contactez l'administration pour plus d'informations.`,
              en: `Your enrollment request for "${c.title}" was not accepted. Please contact the center administration for details.`,
            },
          },
          "courses",
          "courses"
        );
        return ok({ pendingCount: ((c.pendingIds as unknown[]) || []).length });
      }

      /* إزالة مسجّل مؤكد */
      const ids2 = ((c.enrolledIds as unknown[]) || []).map(String);
      const pend2 = ((c.pendingIds as unknown[]) || []).map(String);
      c.enrolledIds = ids2.filter((x) => x !== uid) as never;
      c.pendingIds = pend2.filter((x) => x !== uid) as never;
      await c.save();
      return ok({ enrolledCount: ((c.enrolledIds as unknown[]) || []).length });
    }

    /* ── تسجيل عميل ── */
    const me = await requireUser(["client"]);
    const c = await Course.findById(id);
    if (!c || !c.active) return fail(404, "التكوين غير متاح");
    const ids = ((c.enrolledIds as unknown[]) || []).map(String);
    if (ids.includes(String(me._id))) return fail(409, "أنت مسجل مسبقاً في هذا التكوين");
    const pend = ((c.pendingIds as unknown[]) || []).map(String);
    if (pend.includes(String(me._id))) return fail(409, "طلب تسجيلك معلق بالفعل — بانتظار تأكيد الإدارة");
    if (c.capacity > 0 && ids.length >= c.capacity) return fail(409, "اكتملت مقاعد هذا التكوين");

    /* ★ v3.27: التكوين المؤسَّر — طلب تسجيل بانتظار تأكيد الإدارة قبل فتح المواد */
    if ((Number(c.price) || 0) > 0) {
      c.pendingIds = [...pend, me._id] as never;
      await c.save();
      notifyStaff(
        enrollRequestText({ clientName: me.name, clientPhone: me.phone, courseTitle: c.title }),
        "courses",
        "courses"
      );
      return ok({ pending: true, pendingCount: pend.length + 1 });
    }

    /* المجاني: تسجيل مباشر مؤكد (السلوك القائم) */
    c.enrolledIds = [...ids, me._id] as never;
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
    /* ★ v3.26: مواد التكوين */
    if (Array.isArray(b.materials)) {
      const norm = normMat(b.materials);
      if (norm.length || b.materials.length === 0) c.materials = norm;
    }
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

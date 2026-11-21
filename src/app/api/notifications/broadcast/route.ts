/**
 * ★ v3.29.0: إرسال الإشعارات من إعدادات المركز — للإدارة حصراً
 * POST { target: "all" | userId, title, body, alsoCurrent }
 * - target=all: مستند جماعي مشترك (بلا userId) يصل تلقائياً لكل من يسجل بعد الآن؛
 *   وalsoCurrent=true ينشر نسخاً شخصية فورية بإشعارات الأجهزة لكل المسجلين النشطين حالياً
 * - target=userId: إشعار شخصي عبر notifyUser المعتمد (داخلي + إشعار الجهاز)
 * النص الواحد يحمل بخمسة لغات — الإشعار الإداري رسالة بشرية واحدة بلغة الإدارة
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Notification, User } from "@/lib/models";
import { requireUser } from "@/lib/auth";
import { notifyUser } from "@/lib/push";

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin"]);
    const b = await req.json().catch(() => ({}));
    const title = String(b.title || "").trim();
    const body = String(b.body || "").trim();
    const alsoCurrent = Boolean(b.alsoCurrent);
    const target = String(b.target || "all");
    if (!title) return fail(400, "عنوان الإشعار مطلوب");
    if (title.length > 120 || body.length > 2000) return fail(400, "نص الإشعار طويل جداً");

    const texts = {
      titles: { ar: title, fr: title, en: title, tr: title, es: title },
      bodies: { ar: body, fr: body, en: body, tr: body, es: body },
    };

    if (target === "all") {
      /* المستند المشترك: يظهر لمن سُجِّل عند إنشائه أو بعده (انظر GET في notifications) */
      await Notification.create({
        broadcast: true,
        title,
        body,
        titles: texts.titles,
        bodies: texts.bodies,
        kind: "broadcast",
        link: "",
      });
      let delivered = 0;
      if (alsoCurrent) {
        const users = await User.find({ active: true }).select("_id").lean<{ _id: unknown }[]>();
        await Promise.allSettled(users.map((u) => notifyUser(String(u._id), texts, "broadcast")));
        delivered = users.length;
      }
      return ok({ delivered, future: true });
    }

    /* مستخدم محدد — تحقق بمعرف حقيقي الشكل ثم الإرسال بالمساعد المعتمد */
    if (!/^[0-9a-fA-F]{24}$/.test(target)) return fail(400, "معرّف المستخدم غير صالح");
    const u = await User.findById(target).lean();
    if (!u) return fail(404, "المستخدم غير موجود");
    await notifyUser(target, texts, "broadcast");
    return ok({ delivered: 1, future: false });
  });
}

/**
 * مركز أيت تقرين — إشعارات Web Push (VAPID) + إشعارات داخلية ثلاثية اللغة
 * كل إشعار يحمل نصوصه بثلاث لغات (عربي/فرنسي/إنجليزي) —
 * الواجهة تعرض بلغة المستخدم، وService Worker يختار لغة الجهاز تلقائياً
 */
import webpush from "web-push";
import crypto from "crypto";
import { connectDB } from "./mongo";
import { Settings, Notification, PushSub, User } from "./models";
import type { PentaNotification } from "./notify-text";

/** توليد مفاتيح VAPID مرة واحدة وحفظها في الإعدادات */
export async function ensureVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  await connectDB();
  let s = await Settings.findOne({ key: "center" });
  if (!s) s = await Settings.create({ key: "center" });
  if (s.vapidPublic && s.vapidPrivate) {
    return { publicKey: s.vapidPublic, privateKey: s.vapidPrivate };
  }
  const keys = webpush.generateVAPIDKeys();
  s.vapidPublic = keys.publicKey;
  s.vapidPrivate = keys.privateKey;
  await s.save();
  console.log("🔑 مفاتيح VAPID وُلِّدت وحُفظت");
  return { publicKey: keys.publicKey, privateKey: keys.privateKey };
}

async function configuredPush() {
  const keys = await ensureVapidKeys();
  webpush.setVapidDetails("mailto:ait-tegrine@center.dz", keys.publicKey, keys.privateKey);
  return webpush;
}

/** إشعار داخلي + Web Push لكل أجهزة المستخدم — ثلاثي اللغة
 *  ★ التوقيع الموحّد في كل الموقع: notifyUser(userId, tri, kind, link)
 *    kind: نوع الإشعار — link: وجهة الإشعار (نمط طمأنينة)
 *    الضغط على الإشعار ينقل المستخدم للموضع المناسب
 *    الصيغة: "view" أو "view:id" — مثال: "appointments" / "accounts" / "login:client" */
export async function notifyUser(
  userId: string,
  titleOrTri: string | PentaNotification,
  kind = "general",
  link = ""
): Promise<void> {
  try {
    await connectDB();
    /* وضع ثلاثي اللغة: notifyUser(id, {titles, bodies}, kind, link) */
    let titles = { ar: "", fr: "", en: "", tr: "", es: "" };
    let bodies = { ar: "", fr: "", en: "", tr: "", es: "" };
    if (typeof titleOrTri === "string") {
      titles.ar = titleOrTri;
    } else {
      titles = {
        ar: titleOrTri.titles?.ar || "",
        fr: titleOrTri.titles?.fr || titles.ar,
        en: titleOrTri.titles?.en || titles.ar,
        tr: titleOrTri.titles?.tr || titles.fr || titles.ar,
        es: titleOrTri.titles?.es || titles.fr || titles.ar,
      };
      bodies = {
        ar: titleOrTri.bodies?.ar || "",
        fr: titleOrTri.bodies?.fr || bodies.ar,
        en: titleOrTri.bodies?.en || bodies.ar,
        tr: titleOrTri.bodies?.tr || bodies.fr || bodies.ar,
        es: titleOrTri.bodies?.es || bodies.fr || bodies.ar,
      };
    }
    const title = titles.ar || titles.fr || titles.en || titles.tr || titles.es || "إشعار";
    await Notification.create({ userId, title, body: bodies.ar, titles, bodies, kind, link });
    const subs = await PushSub.find({ userId }).lean();
    if (!subs.length) return;
    const wp = await configuredPush();
    /* الحمولة تحمل اللغات الخمس — Service Worker يختار لغة الجهاز */
    const payload = JSON.stringify({ titles, bodies, title, body: bodies.ar, kind, link });
    await Promise.allSettled(
      subs.map((sub) =>
        wp
          .sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          )
          .catch(async (err: { statusCode?: number }) => {
            // اشتراك منتهي — نحذفه
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await PushSub.deleteOne({ endpoint: sub.endpoint });
            }
          })
      )
    );
  } catch (e) {
    console.error("notifyUser error:", e);
  }
}

/** إشعار كل فريق الإدارة (أدمين + مساعدون) — ثلاثي اللغة */
export async function notifyStaff(
  titleOrTri: string | PentaNotification,
  kind = "general",
  link = ""
): Promise<void> {
  try {
    await connectDB();
    const staff = await User.find({ role: { $in: ["admin", "assistant"] }, active: true })
      .select("_id")
      .lean<{ _id: unknown }[]>();
    await Promise.allSettled(staff.map((s) => notifyUser(String(s._id), titleOrTri, kind, link)));
  } catch (e) {
    console.error("notifyStaff error:", e);
  }
}

/** مفتاح VAPID العام للواجهة */
export async function getVapidPublicKey(): Promise<string> {
  const { publicKey } = await ensureVapidKeys();
  return publicKey;
}

/** توليد توكن للحماية (احتياطي) */
export function randomToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

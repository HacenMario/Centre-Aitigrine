/**
 * مركز أيت تقرين — مجدول التذكيرات (ثلاثي اللغة + إشعار الطرف المعني فقط)
 * • تذكير بموعد الغد (يُرسل مرة واحدة يومياً عند اقتراب اليوم)
 * • تذكير قبل ساعة من الموعد
 * ★ منطق الأطراف الصحيح: الإشعار يصل فقط للأطراف المعنية بالموعِد (العميل + الأخصائي)
 *   — الإدارة لا تصلها تذكيرات مواعيد الآخرين (إشعاراتها إدارية فقط)
 * الإشعار ثلاثي اللغة: الواجهة تعرض بلغة المستخدم وWeb Push بلغة جهازه
 */
import { connectDB } from "./mongo";
import { Appointment, User } from "./models";
import { notifyUser } from "./push";
import { reminderDayText, reminderHourText } from "./notify-text";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

let started = false;

export async function runReminderScan(): Promise<{ day: number; hour: number }> {
  await connectDB();
  let sentDay = 0;
  let sentHour = 0;

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400_000);
  const tomorrowStr = ymd(tomorrow);

  /* ── 1) تذكير مواعيد الغد ── */
  const dayTargets = await Appointment.find({
    date: tomorrowStr,
    status: { $in: ["pending", "confirmed"] },
    remindedDay: false,
  }).lean<{ _id: unknown; clientId: unknown; specialistId: unknown; time: string; serviceTitle: string }[]>();

  for (const a of dayTargets) {
    const [client, specialist] = await Promise.all([
      User.findById(a.clientId).lean<{ name: string } | null>(),
      User.findById(a.specialistId).lean<{ name: string } | null>(),
    ]);
    /* للعميل: نصه الخاص — للأخصائي: نصه الخاص (لا تفسير ولا مشاركة نصوص) */
    const triClient = reminderDayText({
      tomorrowStr,
      time: a.time,
      serviceTitle: a.serviceTitle,
      forClient: true,
      otherName: specialist?.name || "",
    });
    const triSpec = reminderDayText({
      tomorrowStr,
      time: a.time,
      forClient: false,
      otherName: client?.name || "",
    });
    await notifyUser(String(a.clientId), triClient, "reminder_day", `appointments:${String(a._id)}`);
    await notifyUser(String(a.specialistId), triSpec, "reminder_day", `appointments:${String(a._id)}`);
    await Appointment.updateOne({ _id: a._id }, { $set: { remindedDay: true } });
    sentDay++;
  }

  /* ── 2) تذكير قبل ساعة ── */
  const todayStr = ymd(now);
  const hourTargets = await Appointment.find({
    date: todayStr,
    status: { $in: ["pending", "confirmed"] },
    remindedHour: false,
  }).lean<{ _id: unknown; clientId: unknown; specialistId: unknown; time: string; serviceTitle: string }[]>();

  for (const a of hourTargets) {
    const [h, m] = a.time.split(":").map(Number);
    if (Number.isNaN(h)) continue;
    const apptMin = h * 60 + (m || 0);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const diff = apptMin - nowMin;
    // يُرسل عندما يتبقى بين 30 و75 دقيقة (نافذة الفحص كل 5 دقائق)
    if (diff < 30 || diff > 75) continue;
    const [client, specialist] = await Promise.all([
      User.findById(a.clientId).lean<{ name: string } | null>(),
      User.findById(a.specialistId).lean<{ name: string } | null>(),
    ]);
    const triClient = reminderHourText({
      time: a.time,
      serviceTitle: a.serviceTitle,
      forClient: true,
      otherName: specialist?.name || "",
    });
    const triSpec = reminderHourText({
      time: a.time,
      forClient: false,
      otherName: client?.name || "",
    });
    await notifyUser(String(a.clientId), triClient, "reminder_hour", `appointments:${String(a._id)}`);
    await notifyUser(String(a.specialistId), triSpec, "reminder_hour", `appointments:${String(a._id)}`);
    await Appointment.updateOne({ _id: a._id }, { $set: { remindedHour: true } });
    sentHour++;
  }

  return { day: sentDay, hour: sentHour };
}

/** تشغيل الحلقة — مرة واحدة لكل عملية خادم */
export function startScheduler(): void {
  if (started) return;
  started = true;
  console.log("⏰ مجدول التذكيرات يعمل — فحص كل 5 دقائق");
  // فحص أولي بعد 20 ثانية من الإقلاع
  setTimeout(() => runReminderScan().catch(() => {}), 20_000);
  setInterval(() => runReminderScan().catch(() => {}), 5 * 60_000);
}

/**
 * إضافة الموعد للتقويم (v3.8) — ملف iCal القياسي
 * GET /api/calendar?id=<appointmentId>  (يتطلب هيدر التوكن)
 * → ملف .ics يفتح في Apple Calendar / Outlook / Google Calendar
 * رابط Google Calendar يُبنى في الواجهة مباشرة (بلا API خارجي)
 */
import { NextRequest, NextResponse } from "next/server";
import { fail, handle } from "@/lib/api-helpers";
import { Appointment, Settings, User } from "@/lib/models";
import { requireUser } from "@/lib/auth";

function icsDate(date: string, time: string, addHours = 0): string {
  /* YYYYMMDDTHHMMSS — بتوقيت محلي بصيغةfloating */
  const [y, m, d] = date.split("-").map((n) => String(Number(n)).padStart(2, "0"));
  const [hh, mm] = time.split(":").map((n) => String(Number(n)).padStart(2, "0"));
  let H = Number(hh) + addHours;
  let D = Number(d);
  if (H >= 24) {
    H -= 24;
    D += 1; // تبسيط: تجاوز منتصف الليل نادر في المواعيد
  }
  return `${y}${m}${String(D).padStart(2, "0")}T${String(H).padStart(2, "0")}${mm}00`;
}
function esc(s: string): string {
  return String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    const id = req.nextUrl.searchParams.get("id") || "";
    if (!id) return fail(400, "معرّف الموعد مطلوب");

    const appt = await Appointment.findById(id).lean<Record<string, unknown> | null>();
    if (!appt) return fail(404, "الموعد غير موجود");
    /* صلاحية العرض: صاحب الموعد، الأخصائي، أو الإدارة */
    const isOwner = String(appt.clientId) === String(me._id);
    const isSpec = String(appt.specialistId) === String(me._id);
    if (!isOwner && !isSpec && me.role !== "admin" && me.role !== "assistant")
      return fail(403, "لا تملك صلاحية لهذا الموعد");

    const spec = await User.findById(appt.specialistId).select("name").lean<{ name?: string } | null>();
    const client = await User.findById(appt.clientId).select("name").lean<{ name?: string } | null>();
    const st = await Settings.findOne({ key: "center" }).lean<{ centerName?: string; address?: string; mapsUrl?: string } | null>();

    const title = String(appt.serviceTitle || (appt.kind === "art_therapy" ? "علاج فني" : "جلسة نفسية"));
    const date = String(appt.date);
    const time = String(appt.time);
    const summary = `${title} — ${st?.centerName || "مركز آيت تقرين"}`;
    const desc = [
      `الأخصائي: ${spec?.name || "—"}`,
      `العميل: ${client?.name || "—"}`,
      `الطريقة: ${appt.mode === "remote" ? "عن بُعد" : "حضورية"}`,
      `الحالة: ${appt.status}`,
      appt.notes ? `ملاحظات: ${appt.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Aitigrine Center//Appointments//AR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:appt-${String(appt._id)}@aitigrine`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART:${icsDate(date, time)}`,
      `DTEND:${icsDate(date, time, 1)}`,
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc(desc)}`,
      `LOCATION:${esc(appt.mode === "remote" ? "عن بُعد (فيديو)" : st?.address || "")}`,
      `STATUS:${appt.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT60M",
      "ACTION:DISPLAY",
      "DESCRIPTION:تذكير — بعد ساعة من موعد جلستك",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="appointment-${date}-${String(time).replace(":", "-")}.ics"`,
      },
    });
  });
}

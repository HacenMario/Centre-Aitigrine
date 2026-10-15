/**
 * أنشطة المركز العامة — تغذي نافذة الإثبات الاجتماعي (v3.20)
 * GET عام: آخر الأنشطة الحقيقية (حجز موعد / مقعد تكوين / شراء كتاب)
 * — نبضة واحدة لكل مستخدم (الأحدث) لضمان دوران كل المستخدمين دون تكرار
 * — بيانات محدودة عمداً: الاسم الأول فقط + نوع النشاط وتفاصيله وزمنه
 */
import { ok, handle } from "@/lib/api-helpers";
import { ActivityLog } from "@/lib/models";

const MAX = 20;

export async function GET() {
  return handle(async () => {
    const rows = await ActivityLog.find({})
      .sort({ createdAt: -1 })
      .limit(MAX * 4)
      .lean<Record<string, unknown>[]>();

    /* نبضة واحدة لكل مستخدم — أحدث نشاط له، ثم الأحدث أولاً */
    const seen = new Set<string>();
    const items: Record<string, unknown>[] = [];
    for (const r of rows) {
      const uid = String(r.userId || "");
      if (uid && seen.has(uid)) continue;
      if (uid) seen.add(uid);
      const labels = (r.labels || {}) as Record<string, string>;
      items.push({
        kind: r.kind,
        name: r.name || "",
        labels: {
          ar: labels.ar || "",
          fr: labels.fr || labels.ar || "",
          en: labels.en || labels.ar || "",
          tr: labels.tr || labels.en || labels.ar || "",
          es: labels.es || labels.en || labels.ar || "",
        },
        at: r.createdAt,
      });
      if (items.length >= MAX) break;
    }

    return ok({ activities: items });
  });
}

/**
 * سجل التدقيق (v3.10) — توثيق كل عملية حساسة: من فعل ماذا ومتى
 * ★ يُستدعى من كل مسار API حساس بعد نجاح العملية (بلا فشل صامت):
 *   logAudit(req, actor, action, target, meta?)
 * ★ v3.10 حذف تلقائي بعد 3 أيام (طلب صاحب المركز):
 *   - TTL index في المخطط (expireAfterSeconds = 3 أيام) — الحذف دوري من MongoDB
 *   - تنظيف احتياطي مع كل كتابة (يضمن الحذف حتى لو كانت مراقبة TTL معطلة/بطيئة)
 * الكتابة لا تعطل الاستجابة أبداً — أي خطأ يُسجل في console فقط
 */
import { headers } from "next/headers";
import { AuditLog } from "./models";
import type { UserDoc } from "./models";

export type AuditActor = {
  _id?: unknown;
  name?: string;
  role?: string;
} | null;

/** مدة الاحتفاظ بالسجل — 3 أيام */
export const AUDIT_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

export async function logAudit(
  actor: AuditActor,
  action: string,
  target = "",
  meta = "",
  targetId = ""
): Promise<void> {
  try {
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "";
    await AuditLog.create({
      actorId: actor?._id ?? null,
      actorName: actor?.name ?? "زائر",
      actorRole: actor?.role ?? "guest",
      action,
      target,
      targetId,
      meta,
      ip,
      userAgent: (h.get("user-agent") || "").slice(0, 300),
    });
    /* تنظيف احتياطي: كل ما هو أقدم من 3 أيام يُحذف فوراً (احتمال واحد من 10 — يكفي ويوفر الاستعلامات) */
    if (Math.random() < 0.1) {
      await AuditLog.deleteMany({ createdAt: { $lt: new Date(Date.now() - AUDIT_RETENTION_MS) } }).catch(() => {});
    }
  } catch (e) {
    console.error("audit log failed:", (e as Error)?.message);
  }
}

/** وصف موحد للأهداف داخل السجل */
export function auditTarget(kind: string, label: string): string {
  return `${kind}: ${label}`.trim();
}

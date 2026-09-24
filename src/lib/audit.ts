/**
 * سجل التدقيق (v3.8) — توثيق كل عملية حساسة: من فعل ماذا ومتى
 * ★ يُستدعى من كل مسار API حساس بعد نجاح العملية (بلا فشل صامت):
 *   logAudit(req, actor, action, target, meta?)
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
  } catch (e) {
    console.error("audit log failed:", (e as Error)?.message);
  }
}

/** وصف موحد للأهداف داخل السجل */
export function auditTarget(kind: string, label: string): string {
  return `${kind}: ${label}`.trim();
}

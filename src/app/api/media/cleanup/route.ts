/**
 * تنظيف الوسائط اليتيمة بضغطة واحدة — v3.18
 * POST /api/media/cleanup
 * صلاحيات: الإدارة والمساعد
 *
 * الفحص أولاً (scanMediaUsage): كل ملف بلا أي استخدام في أي مجموعة يُحذف
 * عبر آلية GridFS الرسمية (files + chunks معاً)، والمستخدم يبقى كالمشرط.
 * ⛔ تعذر الفحص = إلغاء التنظيف كلياً (وضع محافظ — لا حذف بلا تأكد).
 * يُدوَّن في سجل التدقيق: عدد المحذوف والبايتات المحررة.
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth";
import { listMedia, deleteMediaByName } from "@/lib/media-store";
import { scanMediaUsage } from "@/lib/media-usage";
import { logAudit, auditTarget } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_req: NextRequest) {
  return handle(async () => {
    const me = await requireUser(["admin", "assistant"]);

    const files = await listMedia();
    let usage;
    try {
      usage = await scanMediaUsage(files.map((f) => f.name));
    } catch (e) {
      console.error("media usage scan failed (cleanup):", (e as Error)?.message);
      return fail(503, "تعذر فحص الاستخدام — أُلغي التنظيف احتياطاً، أعد المحاولة");
    }

    const targets = files.filter((f) => !(usage.get(f.name) || []).length);
    const deleted: { name: string; size: number }[] = [];
    let freed = 0;
    for (const f of targets) {
      const r = await deleteMediaByName(f.name);
      if (r !== null) {
        freed += r;
        deleted.push({ name: f.name, size: f.size });
      }
    }

    if (deleted.length) {
      await logAudit(
        me,
        "media.cleanup",
        auditTarget("media", "تنظيف الوسائط اليتيمة"),
        `deleted=${deleted.length}; freed=${freed}; kept=${files.length - deleted.length}`
      );
    }
    return ok({ ok: true, deleted, freed, kept: files.length - deleted.length });
  });
}

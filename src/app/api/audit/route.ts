/**
 * سجل التدقيق — عرض للإدارة فقط
 * GET /api/audit?limit=200&action=&q=  → آخر العمليات (فلاتر اختيارية)
 * DELETE /api/audit  → تفريغ السجل (إدارة فقط — يُوثَّق نفسه قبل التفريغ)
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { AuditLog } from "@/lib/models";
import { requireUser, isStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    if (!isStaff(me.role)) return fail(403, "لا تملك صلاحية لعرض سجل التدقيق");
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Number(sp.get("limit")) || 200, 500);
    const action = (sp.get("action") || "").trim();
    const q = (sp.get("q") || "").trim();

    const filter: Record<string, unknown> = {};
    if (action) filter.action = { $regex: action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") };
    if (q) {
      const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      filter.$or = [{ actorName: rx }, { target: rx }, { meta: rx }, { ip: rx }];
    }

    const rows = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<Record<string, unknown>[]>();
    return ok({
      items: rows.map((r) => ({
        _id: String(r._id),
        actorName: r.actorName || "—",
        actorRole: r.actorRole || "",
        action: r.action || "",
        target: r.target || "",
        meta: r.meta || "",
        ip: r.ip || "",
        userAgent: r.userAgent || "",
        at: r.createdAt,
      })),
    });
  });
}

export async function DELETE() {
  return handle(async () => {
    const me = await requireUser(["admin"]);
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "audit.clear", "سجل التدقيق", "تفريغ كامل للسجل");
    await AuditLog.deleteMany({});
    return ok({ ok: true });
  });
}

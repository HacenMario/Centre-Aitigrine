/**
 * الاقتراحات والبلاغات
 * POST: للجميع — GET: الإدارة/المساعد
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Feedback } from "@/lib/models";
import { currentUser, requireUser } from "@/lib/auth";
import { notifyStaff } from "@/lib/push";
import { feedbackText } from "@/lib/notify-text";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin", "assistant"]);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const q: Record<string, unknown> = {};
    if (status && ["new", "read", "resolved"].includes(status)) q.status = status;
    const rows = await Feedback.find(q).sort({ createdAt: -1 }).limit(300).lean();
    return ok({ feedback: rows });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await currentUser();
    const b = await req.json().catch(() => ({}));
    const message = String(b.message || "").trim();
    if (message.length < 5) return fail(400, "الرسالة قصيرة جداً");
    const doc = await Feedback.create({
      userId: me ? me._id : null,
      name: me ? me.name : String(b.name || "زائر"),
      type: b.type === "report" ? "report" : "suggestion",
      message: message.slice(0, 4000),
      contact: String(b.contact || "").slice(0, 200),
      status: "new",
    });
    /* إشعار فوري لفريق الإدارة بكل تفاصيل الاقتراح/البلاغ */
    notifyStaff(
      feedbackText({
        kind: b.type === "report" ? "report" : "suggestion",
        name: me ? me.name : String(b.name || "زائر"),
        contact: String(b.contact || ""),
        message: message.slice(0, 4000),
      }),
      "feedback",
      "feedback"
    );
    return ok({ sent: true });
  });
}

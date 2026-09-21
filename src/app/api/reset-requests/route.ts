/**
 * طلبات استعادة كلمة المرور — للإدارة فقط
 * GET: قائمة الطلبات المعلّقة (مع اسم وصاحب الطلب)
 * PATCH { id, password }: تعيين كلمة مرور مؤقتة ووسم الطلب منجزاً
 * DELETE { id }: رفض الطلب
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { ResetRequest, User } from "@/lib/models";
import { requireUser, hashPassword } from "@/lib/auth";
import { notifyUser } from "@/lib/push";
import { resetHandledText } from "@/lib/notify-text";

export async function GET() {
  return handle(async () => {
    await requireUser(["admin", "assistant"]);
    const rows = await ResetRequest.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean<{ _id: unknown; userId: unknown; phone: string; createdAt: Date }[]>();
    const ids = rows.map((r) => r.userId);
    const users = await User.find({ _id: { $in: ids } })
      .lean<{ _id: unknown; name: string; phone: string; role: string }[]>();
    const umap = new Map(users.map((u) => [String(u._id), u]));
    return ok({
      requests: rows.map((r) => {
        const u = umap.get(String(r.userId));
        return {
          id: String(r._id),
          name: u?.name || "—",
          phone: u?.phone || r.phone,
          role: u?.role || "client",
          createdAt: r.createdAt,
        };
      }),
    });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin", "assistant"]);
    const b = await req.json().catch(() => ({}));
    const id = String(b.id || "");
    const password = String(b.password || "");
    if (!id) return fail(400, "طلب غير معروف");
    if (password.length < 6) return fail(400, "كلمة المرور يجب أن تكون 6 أحرف على الأقل");
    const reqDoc = await ResetRequest.findById(id).lean<{ userId: unknown } | null>();
    if (!reqDoc) return fail(404, "الطلب غير موجود");
    await User.findByIdAndUpdate(reqDoc.userId, { passwordHash: hashPassword(password) });
    await ResetRequest.findByIdAndUpdate(id, { status: "done" });
    /* إشعار صاحب الطلب بأن طلبه عولج — مع الكلمة المؤقتة ليتمكن من الدخول
       الضغط على الإشعار ينقل مباشرة لبوابة الدخول المناسبة لنوع الحساب */
    const target = await User.findById(reqDoc.userId).select("role").lean<{ role?: string } | null>();
    const loginLink = target?.role === "specialist" ? "login:specialist" : target?.role === "admin" ? "login:admin" : "login:client";
    notifyUser(String(reqDoc.userId), resetHandledText({ tempPassword: password }), "reset", loginLink);
    return ok({ done: true });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin", "assistant"]);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";
    if (!id) return fail(400, "طلب غير معروف");
    await ResetRequest.findByIdAndUpdate(id, { status: "done" });
    return ok();
  });
}

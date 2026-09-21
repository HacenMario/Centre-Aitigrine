/**
 * نسيت كلمة المرور (مسار الأخصائيين والموظفين) — POST { phone }
 * يُسجّل طلب استعادة يصل إلى الإدارة (حسابات) لتعيين كلمة مرور مؤقتة
 * ★ الإدارة تُبلَّغ فوراً بإشعار داخلي كامل التفاصيل (الاسم/الهاتف/الدور/الوقت)
 * العملاء لديهم الاسترجاع الفوري بعبارة الاسترجاع عبر /api/auth/recover
 * الرد دائماً ناجح منعاً لتسريب وجود الحساب أم لا
 */
import { NextRequest } from "next/server";
import { ok, handle } from "@/lib/api-helpers";
import { User, ResetRequest } from "@/lib/models";
import { notifyStaff } from "@/lib/push";
import { resetRequestedText } from "@/lib/notify-text";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const phone = String(body.phone || "").trim();
    if (phone) {
      const user = await User.findOne({ phone }).lean<{
        _id: import("mongoose").Types.ObjectId;
        name: string;
        role: string;
      } | null>();
      if (user) {
        const pending = await ResetRequest.findOne({
          userId: user._id,
          status: "pending",
        }).lean();
        if (!pending) await ResetRequest.create({ userId: user._id, phone });
        /* إشعار فوري لكل فريق الإدارة بكل التفاصيل — لم يكن يصل سابقاً */
        notifyStaff(
          resetRequestedText({
            name: user.name || "—",
            phone,
            role: user.role || "—",
          }),
          "reset",
          "accounts"
        );
      }
    }
    return ok({ sent: true });
  });
}

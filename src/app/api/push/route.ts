/**
 * Web Push (VAPID)
 * GET: المفتاح العام — POST: حفظ اشتراك الجهاز — DELETE: إزالة الاشتراك
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { PushSub } from "@/lib/models";
import { currentUser } from "@/lib/auth";
import { getVapidPublicKey } from "@/lib/push";

export async function GET() {
  return handle(async () => {
    const publicKey = await getVapidPublicKey();
    return ok({ publicKey });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await currentUser();
    if (!me) return fail(401, "سجّل الدخول أولاً");
    const b = await req.json().catch(() => null);
    const sub = b?.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth)
      return fail(400, "اشتراك غير صحيح");
    await PushSub.findOneAndUpdate(
      { endpoint: sub.endpoint },
      {
        $set: {
          userId: me._id,
          endpoint: String(sub.endpoint),
          p256dh: String(sub.keys.p256dh),
          auth: String(sub.keys.auth),
        },
      },
      { upsert: true }
    );
    return ok({ subscribed: true });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const me = await currentUser();
    if (!me) return fail(401, "غير مسجل");
    const b = await req.json().catch(() => ({}));
    if (b.endpoint) await PushSub.deleteOne({ endpoint: String(b.endpoint) });
    return ok();
  });
}

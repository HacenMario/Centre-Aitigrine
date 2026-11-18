/**
 * الإعلان العائم (نمط طمأنينة) — GET: إعلان عائم صالح للمستخدم الحالي
 * يظهر للعملاء والأخصائيين فقط (لا للإدارة ولا لغير المسجلين)
 * بحد ظهور لكل مستخدم (impressions) وصلاحية تنتهي (expiresAt)
 * POST: تسجيل ظهور (impression) لعدّاد حد الإزعاج
 */
import { NextRequest } from "next/server";
import { ok, handle } from "@/lib/api-helpers";
import { Ad } from "@/lib/models";
import { currentUser } from "@/lib/auth";

export async function GET() {
  return handle(async () => {
    const me = await currentUser();
    if (!me || !["client", "specialist"].includes(me.role)) return ok({ ad: null });

    const now = new Date();
    const ads = await Ad.find({
      status: "PUBLISHED",
      float: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    })
      .sort({ reviewedAt: -1 })
      .limit(10)
      .lean();

    /* أول إعلان لم يستنفد حد الظهور لهذا المستخدم */
    for (const r of ads) {
      const rec = r as Record<string, unknown>;
      const impressions = (rec.impressions as { userId: unknown; count: number }[]) || [];
      const mine = impressions.find((x) => String(x.userId) === String(me._id));
      if (!mine || mine.count < (Number(rec.floatPerUser) || 3)) {
        return ok({
          ad: {
            id: String(rec._id),
            title: (rec.title as string) || "",
            body: (rec.body as string) || "",
            media: ((rec.media as string[]) || []),
            adType: (rec.adType as string) || "",
            logo: (rec.logo as string) || "",
            contact: (rec.contact as Record<string, string>) || {},
            ctaText: (rec.ctaText as string) || "",
            ctaUrl: (rec.ctaUrl as string) || "",
          },
        });
      }
    }
    return ok({ ad: null });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await currentUser();
    if (!me) return ok();
    const b = await req.json().catch(() => ({}));
    const adId = String(b.id || "");
    if (!adId) return ok();
    const ad = await Ad.findById(adId).select("impressions floatPerUser").lean();
    if (!ad) return ok();
    const impressions = ((ad as unknown as { impressions: { userId: unknown; count: number }[] }).impressions || []);
    const mine = impressions.find((x) => String(x.userId) === String(me._id));
    if (!mine) {
      await Ad.updateOne({ _id: adId }, { $push: { impressions: { userId: me._id, count: 1 } } });
    } else if (mine.count < (Number(ad.floatPerUser) || 3)) {
      await Ad.updateOne(
        { _id: adId, impressions: { $elemMatch: { userId: me._id } } },
        { $inc: { "impressions.$.count": 1 } }
      );
    }
    return ok();
  });
}

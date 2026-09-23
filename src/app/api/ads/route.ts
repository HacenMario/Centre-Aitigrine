/**
 * الإعلانات (نمط طمأنينة v1.15 مكيَّف لمركز أيت تقرين)
 * GET                          → المنشور (PUBLISHED) للجميع — صفحة الإعلانات العمومية
 * GET ?staff=1                 → كل الإعلانات بكل حالاتها (للإدارة فقط) + تفاصيل التفاعل
 * GET ?pageSize=8              → للبانر الدوّار
 * POST { action: "create" }    → الإدارة تصيغ إعلاناً (DRAFT أو PUBLISHED مباشرة)
 * POST { action: "update" }    → تعديل إعلان
 * POST { action: "publish" | "archive" | "delete" }
 * POST { action: "view" }      → تسجيل مشاهدة (تفرد للمستخدمين المسجلين)
 * POST { action: "like" }      → إعجاب/إلغاء (عميل أو أخصائي)
 * POST { action: "comment" }   → تعليق (عميل أو أخصائي)
 * POST { action: "comment-hide" | "comment-reply" } → الإدارة تدير التعليقات
 * الإعلان العائم: float + floatPerUser + floatDays → expiresAt يُحسب عند النشر
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Ad, User } from "@/lib/models";
import { currentUser, requireUser } from "@/lib/auth";
import { notifyStaff, notifyUser } from "@/lib/push";
import { adInteractionText } from "@/lib/notify-text";

const MAX_MEDIA_ITEM = 6_000_000; // ~4.5MB لكل وسيط
const MAX_MEDIA_TOTAL = 12_000_000;

export async function GET(req: NextRequest) {
  return handle(async () => {
    const { searchParams } = new URL(req.url);
    const staff = searchParams.get("staff") === "1";
    const pageSize = Math.min(20, Math.max(1, Number(searchParams.get("pageSize")) || 12));
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const viewerId = String(searchParams.get("viewerId") || "");

    /* لوحة الإدارة: كل الإعلانات مع كل التفاصيل */
    if (staff) {
      const me = await requireUser(["admin", "assistant"]);
      void me;
      const [rows, total] = await Promise.all([
        Ad.find({}).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
        Ad.countDocuments({}),
      ]);
      return ok({
        ads: rows.map((r) => {
          const rec = r as Record<string, unknown>;
          const comments = (rec.comments as Record<string, unknown>[]) || [];
          const visible = comments.filter((c) => !c.hidden);
          return {
            ...rec,
            _id: String(rec._id),
            mediaCount: ((rec.media as string[]) || []).length,
            views: Number(rec.views) || 0,
            likesCount: ((rec.likes as string[]) || []).length,
            commentsCount: visible.length,
            comments: comments.map((c, i) => ({
              id: String(i),
              name: (c.name as string) || "—",
              text: (c.text as string) || "",
              hidden: c.hidden === true,
              reply: c.reply ? { text: (c.reply as { text?: string }).text || null, at: (c.reply as { at?: string }).at || null } : null,
              createdAt: c.createdAt,
            })),
          };
        }),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / pageSize)),
      });
    }

    /* الجمهور: المنشور فقط */
    const filter = { status: "PUBLISHED" as const };
    const [rows, total] = await Promise.all([
      Ad.find(filter).sort({ reviewedAt: -1, createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      Ad.countDocuments(filter),
    ]);
    const viewerOid = viewerId && /^[a-f0-9]{24}$/i.test(viewerId) ? viewerId : null;
    return ok({
      ads: rows.map((r) => {
        const rec = r as Record<string, unknown>;
        const likes = ((rec.likes as unknown[]) || []).map(String);
        const comments = ((rec.comments as Record<string, unknown>[]) || []).filter((cm) => !cm.hidden);
        return {
          id: String(rec._id),
          title: (rec.title as string) || "",
          body: (rec.body as string) || "",
          media: ((rec.media as string[]) || []),
          publishedAt: (rec.reviewedAt as string) || (rec.createdAt as string),
          likesCount: likes.length,
          likedByMe: viewerOid ? likes.includes(viewerOid) : false,
          commentsCount: comments.length,
          comments: comments.map((cm) => ({
            name: (cm.name as string) || "—",
            text: (cm.text as string) || "",
            reply: cm.reply
              ? { text: (cm.reply as { text?: string }).text || null, at: (cm.reply as { at?: string }).at || null }
              : null,
            createdAt: cm.createdAt,
          })),
        };
      }),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await currentUser();
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "");
    const id = String(b.id || "");

    /* ── إدارة الإعلانات: الإدارة حصراً ── */
    if (["create", "update", "publish", "archive", "delete", "comment-hide", "comment-reply"].includes(action)) {
      const staff = await requireUser(["admin", "assistant"]);

      if (action === "create" || action === "update") {
        const title = String(b.title || "").trim();
        const bodyText = String(b.body || "").trim();
        const media = Array.isArray(b.media) ? (b.media as string[]).map(String) : [];
        if (title.length < 3) return fail(400, "عنوان الإعلان قصير جداً");
        if (bodyText.length < 3) return fail(400, "نص الإعلان قصير جداً");
        if (media.length > 6) return fail(400, "الحد الأقصى 6 وسائط (5 صور + فيديو)");
        const dataItems = media.filter((m) => m.startsWith("data:"));
        if (dataItems.some((m) => m.length > MAX_MEDIA_ITEM)) return fail(400, "أحد الوسائط كبير جداً");
        if (dataItems.reduce((s, m) => s + m.length, 0) > MAX_MEDIA_TOTAL) return fail(400, "مجموع الوسائط كبير جداً");

        const float = b.float === true;
        const floatPerUser = Math.min(20, Math.max(1, Number(b.floatPerUser) || 3));
        const floatDays = Math.min(365, Math.max(1, Number(b.floatDays) || 7));
        const publish = b.publish === true;
        const now = new Date();
        const expiresAt = float && publish ? new Date(now.getTime() + floatDays * 86400_000) : null;

        if (action === "create") {
          const doc = await Ad.create({
            title,
            body: bodyText,
            media,
            float,
            floatPerUser,
            floatDays,
            expiresAt,
            status: publish ? "PUBLISHED" : "DRAFT",
            createdBy: staff._id,
            reviewedBy: publish ? String(staff.name) : null,
            reviewedAt: publish ? now : null,
          });
          if (publish) {
            notifyStaff(
              {
                titles: { ar: "نُشر إعلان جديد", fr: "Nouvelle annonce publiée", en: "New ad published", tr: "Yeni duyuru yayınlandı", es: "Nuevo anuncio publicado" },
                bodies: {
                  ar: `نُشر إعلان «${title}» بواسطة ${staff.name}.`,
                  fr: `L'annonce « ${title} » a été publiée par ${staff.name}.`,
                  en: `Ad "${title}" was published by ${staff.name}.`,
                  tr: `«${title}» duyurusu ${staff.name} tarafından yayınlandı.`,
                  es: `El anuncio «${title}» fue publicado por ${staff.name}.`,
                },
              },
              "ads",
              "ads"
            );
          }
          return ok({ ad: doc.toObject() });
        }

        /* تحديث */
        const ad = await Ad.findById(id);
        if (!ad) return fail(404, "الإعلان غير موجود");
        ad.title = title;
        ad.body = bodyText;
        ad.media = media;
        ad.float = float;
        ad.floatPerUser = floatPerUser;
        ad.floatDays = floatDays;
        const wasPublished = ad.status === "PUBLISHED";
        if (b.publish === true && !wasPublished) {
          ad.status = "PUBLISHED";
          ad.reviewedBy = String(staff.name);
          ad.reviewedAt = now;
          ad.expiresAt = float ? new Date(now.getTime() + floatDays * 86400_000) : null;
        } else if (b.publish === false && wasPublished) {
          ad.status = "DRAFT";
          ad.expiresAt = null;
        }
        if (ad.status === "PUBLISHED" && ad.float) {
          ad.expiresAt = new Date((ad.reviewedAt || now).getTime() + ad.floatDays * 86400_000);
        }
        await ad.save();
        return ok({ ad: ad.toObject() });
      }

      if (action === "publish" || action === "archive") {
        const ad = await Ad.findById(id);
        if (!ad) return fail(404, "الإعلان غير موجود");
        if (action === "publish") {
          const now = new Date();
          ad.status = "PUBLISHED";
          ad.reviewedBy = String(staff.name);
          ad.reviewedAt = now;
          ad.expiresAt = ad.float ? new Date(now.getTime() + ad.floatDays * 86400_000) : null;
        } else {
          ad.status = "ARCHIVED";
          ad.expiresAt = null;
        }
        await ad.save();
        return ok();
      }

      if (action === "delete") {
        await Ad.deleteOne({ _id: id });
        return ok();
      }

      if (action === "comment-hide") {
        const ci = Number(b.commentIndex);
        const ad = await Ad.findById(id);
        if (!ad || !ad.comments?.[ci]) return fail(404, "التعليق غير موجود");
        ad.comments[ci].hidden = b.hidden === true;
        await ad.save();
        return ok();
      }

      if (action === "comment-reply") {
        const ci = Number(b.commentIndex);
        const text = String(b.text || "").trim();
        const ad = await Ad.findById(id);
        if (!ad || !ad.comments?.[ci]) return fail(404, "التعليق غير موجود");
        if (!text) return fail(400, "اكتب الرد أولاً");
        ad.comments[ci].reply = { text, at: new Date() };
        await ad.save();
        /* إبلاغ صاحب التعليق بالرد */
        const uid = ad.comments[ci].userId;
        if (uid) {
          notifyUser(
            String(uid),
            {
              titles: { ar: "رد المركز على تعليقك", fr: "Réponse du centre à votre commentaire", en: "Center replied to your comment", tr: "Merkezin yorumunuza yanıtı", es: "Respuesta del centro a su comentario" },
              bodies: {
                ar: `ردّ فريق المركز على تعليقك في إعلان «${ad.title}»: «${text.slice(0, 200)}»`,
                fr: `Le centre a répondu à votre commentaire sur « ${ad.title} » : « ${text.slice(0, 200)} »`,
                en: `The center replied to your comment on "${ad.title}": "${text.slice(0, 200)}"`,
                tr: `Merkez, «${ad.title}» duyurusundaki yorumunuza yanıt verdi: «${text.slice(0, 200)}»`,
                es: `El centro respondió a su comentario en «${ad.title}»: «${text.slice(0, 200)}»`,
              },
            },
            "ads",
            "ads"
          );
        }
        return ok();
      }
    }

    /* ── تفاعل الجمهور: عملاء وأخصائيون مسجلون ── */
    if (action === "view") {
      const ad = await Ad.findById(id).select("views viewers title").lean();
      if (!ad) return ok();
      await Ad.updateOne(
        { _id: id },
        me
          ? { $addToSet: { viewers: me._id }, $inc: { views: 1 } }
          : { $inc: { views: 1 } }
      );
      return ok();
    }

    if (action === "like") {
      if (!me || !["client", "specialist"].includes(me.role))
        return fail(401, "سجّل الدخول كي تتفاعل مع الإعلانات");
      const ad = await Ad.findById(id).select("likes title").lean();
      if (!ad) return fail(404, "الإعلان غير موجود");
      const liked = (ad.likes || []).some((l) => String(l) === String(me._id));
      const updated = await Ad.findByIdAndUpdate(
        id,
        liked ? { $pull: { likes: me._id } } : { $addToSet: { likes: me._id } },
        { new: true }
      ).select("likes").lean();
      if (!liked) {
        notifyStaff(adInteractionText({ kind: "like", name: me.name, adTitle: ad.title || "" }), "ads", "ads");
      }
      return ok({ likedByMe: !liked, likesCount: ((updated?.likes as unknown[]) || []).length });
    }

    if (action === "comment") {
      if (!me || !["client", "specialist"].includes(me.role))
        return fail(401, "سجّل الدخول كي تتفاعل مع الإعلانات");
      const text = String(b.text || "").trim();
      if (!text) return fail(400, "اكتب تعليقك أولاً");
      if (text.length > 400) return fail(400, "التعليق طويل جداً (400 حرف كحد أقصى)");
      const ad = await Ad.findById(id).select("title comments").lean();
      if (!ad) return fail(404, "الإعلان غير موجود");
      await Ad.updateOne(
        { _id: id },
        { $push: { comments: { userId: me._id, name: me.name, text, hidden: false, reply: null, createdAt: new Date() } } }
      );
      notifyStaff(adInteractionText({ kind: "comment", name: me.name, adTitle: ad.title || "", text }), "ads", "ads");
      return ok({ sent: true });
    }

    return fail(400, "إجراء غير معروف");
  });
}

/**
 * v3.21.0 — بيانات المشاركة الاجتماعية (قراءة خادمة فقط)
 * تُستعمل في مكانين:
 *   1) generateMetadata في page.tsx — معاينة الرابط المنشور على فايسبوك/واتساب/تلغرام
 *      (العنوان والنبذة وصورة العنصر بدل واجهة الموقع العامة)
 *   2) /api/share-image — بث صورة العنصر كملف صورة حقيقي (data URL لا يصلح لـ og:image)
 * ★ قراءة فقط: لا تكتب في قاعدة البيانات ولا تمس أي منطق قائم
 */
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongo";
import { Article, Ebook, Course, Ad } from "@/lib/models";

/** الصفحات العامة القابلة للمشاركة — تطابق مفاتيح ?view= */
export type ShareView = "articles" | "ebooks" | "courses" | "ads";

export function isShareView(v: string): v is ShareView {
  return v === "articles" || v === "ebooks" || v === "courses" || v === "ads";
}

export function isObjectId(s: string): boolean {
  return /^[a-f0-9]{24}$/i.test(s);
}

export type ShareItem = {
  title: string;
  description: string;
  /** data:image/… أو /api/media/… أو "" إن لا صورة */
  imageData: string;
};

/** اقتصار الوصف على طول معقول لمعاينات الشبكات */
function clip(s: string, max = 180): string {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** أول صورة صالحة من وسائط إعلان (تخطّي الفيديو) */
function firstAdImage(media: unknown): string {
  const arr = Array.isArray(media) ? (media as string[]) : [];
  for (const m of arr) {
    if (typeof m !== "string" || !m) continue;
    if (m.startsWith("data:video/")) continue;
    if (m.startsWith("data:image/")) return m;
    if (m.startsWith("/api/media/")) return m;
  }
  return "";
}

/** أفضل نص عرض للعنوان بلغة الزائر — العربية أولاً ثم الفرنسية ثم الإنجليزية */
function pickTitle(ar: string, fr?: string, en?: string): string {
  return ar || fr || en || "";
}

/** حل عنصر قابل للمشاركة من (view,id) — null إن غير موجود أو غير منشور أو خطأ */
export async function resolveShareItem(
  view: ShareView,
  id: string
): Promise<ShareItem | null> {
  if (!isObjectId(id)) return null;
  try {
    await connectDB();

    if (view === "articles") {
      const a = await Article.findById(id)
        .select("title titleFr titleEn summary summaryFr summaryEn coverBase64 active")
        .lean<{ title: string; titleFr?: string; titleEn?: string; summary?: string; summaryFr?: string; summaryEn?: string; coverBase64?: string; active?: boolean } | null>();
      if (!a || a.active === false) return null;
      return {
        title: pickTitle(a.title, a.titleFr, a.titleEn),
        description: clip(a.summary || a.summaryFr || a.summaryEn || ""),
        imageData: a.coverBase64 || "",
      };
    }

    if (view === "ebooks") {
      const e = await Ebook.findById(id)
        .select("title titleFr titleEn summary summaryFr summaryEn coverBase64 active")
        .lean<{ title: string; titleFr?: string; titleEn?: string; summary?: string; summaryFr?: string; summaryEn?: string; coverBase64?: string; active?: boolean } | null>();
      if (!e || e.active === false) return null;
      return {
        title: pickTitle(e.title, e.titleFr, e.titleEn),
        description: clip(e.summary || e.summaryFr || e.summaryEn || ""),
        imageData: e.coverBase64 || "",
      };
    }

    if (view === "courses") {
      const c = await Course.findById(id)
        .select("title titleFr titleEn description descriptionFr descriptionEn coverBase64 active")
        .lean<{ title: string; titleFr?: string; titleEn?: string; description?: string; descriptionFr?: string; descriptionEn?: string; coverBase64?: string; active?: boolean } | null>();
      if (!c || c.active === false) return null;
      return {
        title: pickTitle(c.title, c.titleFr, c.titleEn),
        description: clip(c.description || c.descriptionFr || c.descriptionEn || ""),
        imageData: c.coverBase64 || "",
      };
    }

    /* الإعلانات: المنشور فقط — ومع انتهاء الصلاحية إن وُجدت */
    const ad = await Ad.findOne({ _id: new mongoose.Types.ObjectId(id), status: "PUBLISHED" })
      .select("title body media expiresAt")
      .lean<{ title: string; body?: string; media?: string[]; expiresAt?: Date | null } | null>();
    if (!ad) return null;
    if (ad.expiresAt && new Date(ad.expiresAt).getTime() < Date.now()) return null;
    return {
      title: ad.title,
      description: clip(ad.body || ""),
      imageData: firstAdImage(ad.media),
    };
  } catch {
    return null;
  }
}

/**
 * المقالات العلمية (v3.6.0) — علم النفس والأرطفونية
 * GET: للجميع — المقالات المفعّلة فقط (الإدارة ترى الكل مع ?all=1)
 *      القائمة بلا متن المقال (يُجلب كاملاً عند فتح المقال) — أداء أفضل
 * POST: الأخصائيون والمكوّنون وإدارة المركز (admin/assistant/specialist/trainer)
 *       أخصائي أو مكوّن ينشر → إشعار فريق الإدارة
 *       إدارة تنشر → إشعار العملاء والأخصائيين (عدا الكاتب)
 */
import { NextRequest } from "next/server";
import { ok, fail, handle, PUBLIC_EDGE_CACHE } from "@/lib/api-helpers";
import { Article, User } from "@/lib/models";
import { currentUser, isStaff, requireUser } from "@/lib/auth";
import { notifyStaff, notifyUser } from "@/lib/push";
import { articlePublishedText } from "@/lib/notify-text";

/* إسقاط المتن من القائمة — يُقرأ من مسار المقال المفرد */
const LIST_PROJECTION = "-content -contentFr -contentEn";

/* ★ v3.26: رابط PDF داخل الموقع فقط (من /api/media) — كالنمط المعتمد في الكتب الإلكترونية */
const normPdfUrl = (v: unknown) => (/^\/api\/media\/[A-Za-z0-9._%-]+\.pdf$/.test(String(v || "")) ? String(v) : "");

export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await currentUser();
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "1" && me && isStaff(me.role);
    /* الأخصائي/المكوّن يرى مقالاته المعطّلة هو أيضاً (كي يتمكن من إعادة تفعيلها) — ★ v3.11 */
    const mineOnly =
      searchParams.get("mine") === "1" &&
      me &&
      (me.role === "specialist" || me.role === "trainer");
    const q = all ? {} : mineOnly ? { authorId: me._id } : { active: true };
    const articles = await Article.find(q)
      .select(LIST_PROJECTION)
      .sort({ createdAt: -1 })
      .lean();
    /* ★ v3.17: كاش حافة على القائمة العامة فقط — عناوين الإدارة/مقالاتي بلا كاش */
    const res = ok({ articles });
    if (!all && !mineOnly) res.headers.set("Cache-Control", PUBLIC_EDGE_CACHE);
    return res;
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser(["admin", "assistant", "specialist", "trainer"]);
    const b = await req.json().catch(() => ({}));
    const title = String(b.title || "").trim();
    const content = String(b.content || "").trim();
    if (!title) return fail(400, "عنوان المقال مطلوب");
    if (!content) return fail(400, "نص المقال مطلوب");

    const category = ["psychology", "orthophony", "general"].includes(String(b.category))
      ? String(b.category)
      : "general";

    const a = await Article.create({
      title,
      titleFr: String(b.titleFr || "").trim(),
      titleEn: String(b.titleEn || "").trim(),
      summary: String(b.summary || "").trim(),
      summaryFr: String(b.summaryFr || "").trim(),
      summaryEn: String(b.summaryEn || "").trim(),
      content,
      contentFr: String(b.contentFr || ""),
      contentEn: String(b.contentEn || ""),
      category,
      pdfUrl: normPdfUrl(b.pdfUrl),
      coverBase64: typeof b.coverBase64 === "string" ? b.coverBase64 : "",
      authorId: me._id,
      authorName: me.name || "",
      authorRole: me.role,
      authorTitle: String(me.title || ""),
      authorTitleFr: String(me.titleFr || ""),
      authorTitleEn: String(me.titleEn || ""),
      active: b.active !== false,
    });

    /* إشعارات النشر — ثلاثية اللغة، لا يُشعَر الكاتب نفسه */
    const tri = {
      title,
      titleFr: String(b.titleFr || ""),
      titleEn: String(b.titleEn || ""),
    };
    try {
      if (me.role === "specialist" || me.role === "trainer") {
        /* أخصائي أو مكوّن نشر → فريق الإدارة يُعلم */
        await notifyStaff(
          articlePublishedText({ ...tri, authorName: me.name || "", viewer: "staff" }),
          "article",
          "articles"
        );
      } else {
        /* إدارة نشرت → العملاء والأخصائيون والمكوّنون النشطون (عدا الكاتب) يُعلمون */
        const audience = await User.find({
          role: { $in: ["client", "specialist", "trainer"] },
          active: true,
          _id: { $ne: me._id },
        })
          .select("_id")
          .lean<{ _id: unknown }[]>();
        await Promise.allSettled(
          audience.map((u) =>
            notifyUser(
              String(u._id),
              articlePublishedText({ ...tri, authorName: me.name || "", viewer: "audience" }),
              "article",
              "articles"
            )
          )
        );
      }
    } catch (e) {
      console.error("article notify error:", (e as Error)?.message);
    }

    return ok({ article: a.toObject() });
  });
}

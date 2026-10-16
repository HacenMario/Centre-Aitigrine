/**
 * v3.21.1 — اسم وصورة مؤلف/مكوِّن العنصر لصورة المشاركة على انستغرام
 * GET /api/share-author?view=articles|ebooks|courses|ads&id=<24hex>
 * يعيد { name, photo } — photo صورة data URL أو "" إن لا صورة.
 * ★ قراءة عامة فقط: اسم الكاتب وصورته معلومان منشورة أصلاً مع العنصر،
 *   ولا يُجاب إلا للعناصر المنشورة (نفس شروط resolveShareItem في share-meta.ts).
 *   لا يحتاج جلسة — لا يكشف شيئاً حساساً — لا يكتب في قاعدة البيانات.
 *   الإعلانات: إعلان المركز بلا مؤلف ⇒ استجابة فارغة دائماً.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongo";
import { Article, Ebook, Course, User } from "@/lib/models";
import { isShareView, isObjectId } from "@/lib/share-meta";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const view = sp.get("view") || "";
  const id = sp.get("id") || "";
  const empty = { name: "", photo: "" };

  if (!isShareView(view) || !isObjectId(id)) {
    return NextResponse.json(empty, { headers: NO_STORE });
  }

  /* الإعلانات بلا مؤلف — بلا أي استعلام */
  if (view === "ads") {
    return NextResponse.json(empty, { headers: NO_STORE });
  }

  try {
    await connectDB();

    /* المقال: بطاقة الكاتب لقطة محفوظة (authorName) + صورة حسابه الحالية إن وُجدت */
    if (view === "articles") {
      const a = await Article.findById(id)
        .select("authorId authorName active")
        .lean<{ authorId?: unknown; authorName?: string; active?: boolean } | null>();
      if (!a || a.active === false) return NextResponse.json(empty, { headers: NO_STORE });
      let name = (a.authorName || "").trim();
      let photo = "";
      if (a.authorId) {
        const u = await User.findById(a.authorId)
          .select("name photoBase64")
          .lean<{ name?: string; photoBase64?: string } | null>();
        if (u) {
          if (!name) name = (u.name || "").trim();
          photo = u.photoBase64 || "";
        }
      }
      return NextResponse.json({ name, photo }, { headers: NO_STORE });
    }

    /* التكوين: المكوِّن المسؤول — اسمه مزامَن من حسابه وصورته من حسابه */
    if (view === "courses") {
      const c = await Course.findById(id)
        .select("trainerId trainerName active")
        .lean<{ trainerId?: unknown; trainerName?: string; active?: boolean } | null>();
      if (!c || c.active === false) return NextResponse.json(empty, { headers: NO_STORE });
      let name = (c.trainerName || "").trim();
      let photo = "";
      if (c.trainerId) {
        const u = await User.findById(c.trainerId)
          .select("name photoBase64")
          .lean<{ name?: string; photoBase64?: string } | null>();
        if (u) {
          if (!name) name = (u.name || "").trim();
          photo = u.photoBase64 || "";
        }
      }
      return NextResponse.json({ name, photo }, { headers: NO_STORE });
    }

    /* الكتاب الإلكتروني: مؤلف نصي حر — بلا صورة حساب */
    const e = await Ebook.findById(id)
      .select("author active")
      .lean<{ author?: string; active?: boolean } | null>();
    if (!e || e.active === false) return NextResponse.json(empty, { headers: NO_STORE });
    return NextResponse.json({ name: (e.author || "").trim(), photo: "" }, { headers: NO_STORE });
  } catch {
    return NextResponse.json(empty, { headers: NO_STORE });
  }
}

/**
 * v3.21.0 — بث صورة العنصر للمشاركة الاجتماعية
 * GET /api/share-image?view=articles|ebooks|courses|ads&id=<24hex>
 * ★ og:image لا يقبل data URLs — هذا المسار يفكّ الصورة المخزنة (base64) ويعيدها
 *   كملف صورة حقيقي بـ Content-Type صحيح وتخزين مؤقت محترم.
 *   إن لم توجد صورة: تحويل إلى شعار المركز (معاينة أنيقة دائماً).
 * عام للجميع — الروبوتات (فايسبوك/واتساب/تلغرام) تحتاج القراءة بلا جلسة.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveShareItem, isShareView } from "@/lib/share-meta";

export const runtime = "nodejs";

const CACHE = "public, max-age=600, s-maxage=86400, stale-while-revalidate=604800";

function absolute(req: NextRequest, path: string): string {
  return new URL(path, req.nextUrl.origin).toString();
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const view = sp.get("view") || "";
  const id = sp.get("id") || "";

  /* لا صورة → شعار المركز (302 يتبعها فايسبوك وكل الروبوتات) */
  if (!isShareView(view) || !id) {
    return NextResponse.redirect(absolute(req, "/logo.png"), 302);
  }

  const item = await resolveShareItem(view, id);
  const data = item?.imageData || "";

  /* وسائط GridFS: تحويل مباشر لرابطها العام */
  if (data.startsWith("/api/media/")) {
    return NextResponse.redirect(absolute(req, data), 302);
  }

  /* صورة base64: فك وإرجاع الملف */
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(data);
  if (m) {
    try {
      const buf = Buffer.from(m[2], "base64");
      if (buf.length > 0) {
        return new NextResponse(buf, {
          status: 200,
          headers: {
            "Content-Type": m[1],
            "Content-Length": String(buf.length),
            "Cache-Control": CACHE,
          },
        });
      }
    } catch {}
  }

  /* بلا صورة صالحة → الشعار */
  return NextResponse.redirect(absolute(req, "/logo.png"), 302);
}

/**
 * مركز أيت تقرين — نقطة الدخول
 * ★ v3.21.0: صفحة خادمية تصدّر generateMetadata — معاينة حية للروابط المنشورة
 *   على فايسبوك/واتساب/تلغرام: عنوان العنصر ونبذته وصورته بدل واجهة الموقع العامة.
 *   بلا ?view=&id= (أو عنصر غير منشور) تبقى بيانات layout الافتراضية كما هي — لا تغيير.
 * التطبيق نفسه يعمل في المتصفح فقط (client-only عبر AppLauncher) — شاشة إقلاع بشعار المركز
 */
import type { Metadata } from "next";
import { headers } from "next/headers";
import AppLauncher from "@/components/app-launcher";
import { resolveShareItem, isShareView } from "@/lib/share-meta";

const SITE = "مركز آيت تقرين";

type SP = Record<string, string | string[] | undefined>;

/** أصل الموقع الحالي من الترويسات — لروابط صور og مطلقة */
async function siteOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "";
    if (!host) return "";
    const proto =
      h.get("x-forwarded-proto") ||
      (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return "";
  }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SP>;
}): Promise<Metadata> {
  try {
    const sp = await searchParams;
    const view = typeof sp.view === "string" ? sp.view : "";
    const id = typeof sp.id === "string" ? sp.id : "";
    if (!view || !id || !isShareView(view)) return {};

    const origin = await siteOrigin();
    if (!origin) return {};

    /* مهلة قصيرة: الميتاداتا لا يجوز أن تؤخر إقلاع الموقع أبداً */
    const item = await Promise.race([
      resolveShareItem(view, id),
      new Promise<null>((res) => setTimeout(() => res(null), 2500)),
    ]);
    if (!item?.title) return {};

    return {
      title: `${item.title} | ${SITE}`,
      description: item.description,
      openGraph: {
        title: item.title,
        description: item.description,
        siteName: SITE,
        type: "article",
        images: [{ url: `${origin}/api/share-image?view=${view}&id=${id}` }],
      },
      /* واتساب وتلغرام يقرؤان og:* — twitter card اجتهاد مجامل بلا أي أثر آخر */
      twitter: {
        card: "summary_large_image",
        title: item.title,
        description: item.description,
        images: [`${origin}/api/share-image?view=${view}&id=${id}`],
      },
    };
  } catch {
    return {};
  }
}

export default function Page() {
  return <AppLauncher />;
}

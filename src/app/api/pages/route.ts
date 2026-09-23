/**
 * صفحات المحتوى: faq / about / privacy / terms — خماسية اللغة
 * GET ?key=faq&lang=tr → النسخة التركية إن وُجدت وإلا العربية (وإلا الافتراضي الاحترافي)
 * PUT: الإدارة — { key, lang?, items }
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { PageContent } from "@/lib/models";
import { requireUser } from "@/lib/auth";
import { PAGE_DEFAULTS } from "@/lib/page-defaults";

const KEYS = ["faq", "about", "privacy", "terms"];

type Item = Record<string, unknown>;

function byLang(
  doc: { items?: Item[]; itemsFr?: Item[]; itemsEn?: Item[]; itemsTr?: Item[]; itemsEs?: Item[] } | null,
  key: string,
  lang: string
): Item[] {
  const pick = (v?: Item[]) => (Array.isArray(v) && v.length ? v : null);
  if (doc) {
    const custom =
      (lang === "fr"
        ? pick(doc.itemsFr)
        : lang === "en"
          ? pick(doc.itemsEn)
          : lang === "tr"
            ? pick(doc.itemsTr)
            : lang === "es"
              ? pick(doc.itemsEs)
              : pick(doc.items)) || pick(doc.items);
    if (custom) return custom;
  }
  const pack = PAGE_DEFAULTS[lang as keyof typeof PAGE_DEFAULTS] || PAGE_DEFAULTS.ar;
  return pack[key as "faq"] as unknown as Item[];
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key") || "";
    const lang = searchParams.get("lang") || "ar";
    if (key && KEYS.includes(key)) {
      const p = await PageContent.findOne({ key }).lean<{
        items: Item[];
        itemsFr?: Item[];
        itemsEn?: Item[];
        itemsTr?: Item[];
        itemsEs?: Item[];
      } | null>();
      return ok({ key, lang, items: byLang(p, key, lang) });
    }
    const all = await PageContent.find().lean<{
      key: string;
      items: Item[];
      itemsFr?: Item[];
      itemsEn?: Item[];
      itemsTr?: Item[];
      itemsEs?: Item[];
    }[]>();
    const map: Record<string, Item[]> = {};
    KEYS.forEach((k) => {
      const doc = all.find((p) => p.key === k) || null;
      map[k] = byLang(doc, k, "ar");
    });
    return ok({ pages: map });
  });
}

export async function PUT(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin", "assistant"]);
    const b = await req.json().catch(() => ({}));
    const key = String(b.key || "");
    const lang = String(b.lang || "ar");
    if (!KEYS.includes(key)) return fail(400, "صفحة غير معروفة");
    if (!Array.isArray(b.items)) return fail(400, "عناصر غير صحيحة");
    const field =
      lang === "fr" ? "itemsFr" : lang === "en" ? "itemsEn" : lang === "tr" ? "itemsTr" : lang === "es" ? "itemsEs" : "items";
    await PageContent.findOneAndUpdate(
      { key },
      {
        $set: { [field]: b.items.slice(0, 100), updatedAt: new Date() },
      },
      { upsert: true }
    );
    return ok();
  });
}

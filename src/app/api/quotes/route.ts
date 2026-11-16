/**
 * العبارات الترحيبية «لحظة اطمئنان» — نمط طمأنينة
 * GET  : عام — العبارات النشطة فقط (تُبذر المكتبة المدمجة مرة واحدة عند أول تشغيل)
 * POST : الإدارة — list-all / create / update / delete
 * كل عبارة بخمس لغات (عربي/فرنسي/إنجليزي/تركي/إسباني — ★ v3.10) + مؤلف اختياري + تفعيل
 */
import { NextRequest } from "next/server";
import { ok, fail, handle, PUBLIC_EDGE_CACHE } from "@/lib/api-helpers";
import { WelcomeQuote } from "@/lib/models";
import { requireUser } from "@/lib/auth";
import { RE_QUOTES } from "@/lib/re-quotes";

export const dynamic = "force-dynamic";

/* ─── زرع تلقائي عند أول تشغيل (صفر تهيئة يدوية — نمط طمأنينة) ───
   تُزرع عبارات re-quotes.ts مرة واحدة فقط عندما يكون الجدول فارغاً،
   وأي إضافة/تعديل من الإدارة بعدها يبقى محفوظاً كما هو. */
async function ensureSeeded() {
  try {
    const count = await WelcomeQuote.countDocuments({});
    if (count > 0) return;
    await WelcomeQuote.insertMany(
      RE_QUOTES.map((q) => ({
        textAr: q.ar,
        textFr: q.fr,
        textEn: q.en,
        author: "",
        active: true,
      }))
    );
    console.log(`🌱 تم زرع ${RE_QUOTES.length} عبارة ترحيبية افتراضية`);
  } catch (e) {
    console.error("تعذر زرع العبارات الافتراضية:", (e as Error).message);
  }
}

function mapQuote(q: Record<string, unknown>) {
  return {
    id: String(q._id),
    textAr: q.textAr,
    textFr: q.textFr ?? "",
    textEn: q.textEn ?? "",
    textTr: q.textTr ?? "",
    textEs: q.textEs ?? "",
    author: q.author ?? "",
    active: !!q.active,
    createdAt: q.createdAt,
  };
}

export async function GET() {
  return handle(async () => {
    await ensureSeeded();
    const rows = await WelcomeQuote.find({ active: true })
      .select("textAr textFr textEn textTr textEs author active createdAt")
      .limit(300)
      .lean<Record<string, unknown>[]>();
    const res = ok({ total: rows.length, quotes: rows.map(mapQuote) });
    /* ★ v3.23.1: كاش حافة — العبارات النشطة متطابقة لكل الزوار (التعديل يظهر خلال ≤60 ثانية) */
    res.headers.set("Cache-Control", PUBLIC_EDGE_CACHE);
    return res;
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireUser(["admin"]);
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "");

    if (action === "list-all") {
      const rows = await WelcomeQuote.find()
        .sort({ createdAt: -1 })
        .limit(300)
        .lean<Record<string, unknown>[]>();
      return ok({ quotes: rows.map(mapQuote) });
    }

    if (action === "create") {
      const textAr = String(b.textAr || "").trim();
      if (!textAr) return fail(400, "MISSING_AR");
      const q = await WelcomeQuote.create({
        textAr,
        textFr: String(b.textFr || "").trim(),
        textEn: String(b.textEn || "").trim(),
        textTr: String(b.textTr || "").trim(),
        textEs: String(b.textEs || "").trim(),
        author: String(b.author || "").trim(),
        active: b.active !== false,
      });
      return ok({ quote: mapQuote(q.toObject() as unknown as Record<string, unknown>) });
    }

    if (action === "update") {
      const id = String(b.id || "");
      if (!id) return fail(400, "id required");
      const patch: Record<string, unknown> = {};
      if (typeof b.textAr === "string") {
        if (!b.textAr.trim()) return fail(400, "MISSING_AR");
        patch.textAr = b.textAr.trim();
      }
      if (typeof b.textFr === "string") patch.textFr = b.textFr.trim();
      if (typeof b.textEn === "string") patch.textEn = b.textEn.trim();
      if (typeof b.textTr === "string") patch.textTr = b.textTr.trim();
      if (typeof b.textEs === "string") patch.textEs = b.textEs.trim();
      if (typeof b.author === "string") patch.author = b.author.trim();
      if (typeof b.active === "boolean") patch.active = b.active;
      const q = await WelcomeQuote.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
      if (!q) return fail(404, "NOT_FOUND");
      return ok({ quote: mapQuote(q as unknown as Record<string, unknown>) });
    }

    if (action === "delete") {
      const id = String(b.id || "");
      if (!id) return fail(400, "id required");
      const r = await WelcomeQuote.findByIdAndDelete(id);
      if (!r) return fail(404, "NOT_FOUND");
      return ok();
    }

    return fail(400, "Unknown action");
  });
}

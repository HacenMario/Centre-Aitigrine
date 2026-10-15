/**
 * فاحص استخدام وسائط GridFS — v3.18
 * الغاية: حماية الملفات المستخدمة من الحذف وإتقاء اليتيمة قبل التنظيف.
 *
 * المنهج (تغطية شاملة بلا افتراضات):
 *  - أي تواجد للنص «/api/media/<اسم الملف>» في أي حقل نصي للمجموعات المرشحة
 *    يُحتسب استخداماً — حتى لو كانت الحقول تاريخياً اسمها Base64 (قد تحمل روابط).
 *  - الفواتير: Appointment.invoiceFile يحفظ اسم الملف مجرداً بلا مسار ⇒ مطابقة اسم مباشرة.
 *  - المستندات المحتملة الضخامة (base64) تُرشَّح خادمياً بـ $or regex أولاً ثم
 *    تُفحص في الذاكرة — غير المطابق لا يُسحب من قاعدة البيانات أبداً.
 *
 * الأمان: أي خطأ في الفحص يُرمى للمستدعي — مسارات الحذف ترفض الحذف عند تعذر
 * الفحص (الوضع المحافظ: تعذر التأكد = لا حذف).
 */
import {
  Settings,
  Ad,
  Course,
  Service,
  Ebook,
  Article,
  User,
  Appointment,
  PageContent,
} from "./models";

export type MediaUsageKind =
  | "slider"
  | "settings"
  | "ads"
  | "courses"
  | "services"
  | "ebooks"
  | "articles"
  | "users"
  | "pages"
  | "invoice";

/** Escape آمن لأسماء الملفات داخل regex (أسماؤنا timestamp-hex.ext لكن نحتاط) */
function urlReSrc(name: string): string {
  return `/api/media/${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
}

function addKind(
  map: Map<string, MediaUsageKind[]>,
  name: string,
  kind: MediaUsageKind
): void {
  const arr = map.get(name) || [];
  if (!arr.includes(kind)) arr.push(kind);
  map.set(name, arr);
}

function matchNamesInString(
  text: string,
  names: string[],
  kind: MediaUsageKind,
  map: Map<string, MediaUsageKind[]>
): void {
  for (const n of names) {
    if (text.includes(`/api/media/${n}`)) addKind(map, n, kind);
  }
}

/** فحص مجموعة بمصفوفة حقول: ترشيح خادمي ثم مطابقة ذاكرة على المستندات المطابقة فقط */
async function scanByRegex(
  model: { find: (q: unknown) => { lean: () => Promise<unknown[]> } },
  fields: string[],
  kind: MediaUsageKind,
  map: Map<string, MediaUsageKind[]>,
  names: string[]
): Promise<void> {
  const clauses = names.flatMap((n) =>
    fields.map((f) => ({ [f]: { $regex: urlReSrc(n) } }))
  );
  if (!clauses.length) return;
  const docs = (await model.find({ $or: clauses }).lean()) as Record<
    string,
    unknown
  >[];
  for (const d of docs) {
    const payload: Record<string, unknown> = {};
    for (const f of fields) payload[f] = d[f];
    matchNamesInString(JSON.stringify(payload), names, kind, map);
  }
}

/**
 * يبني خريطة: اسم الملف ← قائمة أنواع استخدامه.
 * ملف بلا أنواع = يتيم (آمن للحذف). الفحص النظيف شرط لأي حذف.
 */
export async function scanMediaUsage(
  names: string[]
): Promise<Map<string, MediaUsageKind[]>> {
  const map = new Map<string, MediaUsageKind[]>();
  for (const n of names) map.set(n, []);
  if (!names.length) return map;
  const errors: string[] = [];

  /* 1) الإعدادات: سلايدر الرئيسية + أي حقل آخر يحمل رابطاً
        (نستثني logoBase64 وsliderMedia.data — base64 ضخم بلا فائدة للمطابقة) */
  try {
    const st = (await Settings.findOne(
      {},
      { logoBase64: 0, "sliderMedia.data": 0 }
    ).lean()) as Record<string, unknown> | null;
    if (st) {
      const slider = Array.isArray(st.sliderMedia)
        ? (st.sliderMedia as { url?: string }[])
        : [];
      for (const m of slider) {
        const u = String(m?.url || "");
        if (!u) continue;
        for (const n of names)
          if (u.includes(`/api/media/${n}`)) addKind(map, n, "slider");
      }
      const rest = { ...st, sliderMedia: undefined, __v: undefined };
      matchNamesInString(
        JSON.stringify(rest),
        names,
        "settings",
        map
      );
    }
  } catch (e) {
    errors.push(`settings: ${(e as Error)?.message}`);
  }

  /* 2) الإعلانات — media[] روابط /api/media (رفع MediaInput) */
  try {
    await scanByRegex(Ad, ["media"], "ads", map, names);
  } catch (e) {
    errors.push(`ads: ${(e as Error)?.message}`);
  }

  /* 3) التكوينات / الخدمات / الكتب / المقالات / صور الحسابات — تغطية استباقية */
  try {
    await scanByRegex(Course, ["images", "coverBase64"], "courses", map, names);
  } catch (e) {
    errors.push(`courses: ${(e as Error)?.message}`);
  }
  try {
    await scanByRegex(Service, ["coverBase64"], "services", map, names);
  } catch (e) {
    errors.push(`services: ${(e as Error)?.message}`);
  }
  try {
    await scanByRegex(Ebook, ["coverBase64"], "ebooks", map, names);
  } catch (e) {
    errors.push(`ebooks: ${(e as Error)?.message}`);
  }
  try {
    await scanByRegex(Article, ["coverBase64"], "articles", map, names);
  } catch (e) {
    errors.push(`articles: ${(e as Error)?.message}`);
  }
  try {
    await scanByRegex(User, ["photoBase64"], "users", map, names);
  } catch (e) {
    errors.push(`users: ${(e as Error)?.message}`);
  }

  /* 4) الفواتير — invoiceFile يحمل اسم الملف مجرداً */
  try {
    const pdfNames = names.filter((n) => n.toLowerCase().endsWith(".pdf"));
    if (pdfNames.length) {
      const appts = (await Appointment.find(
        { invoiceFile: { $in: pdfNames } },
        { invoiceFile: 1 }
      ).lean()) as { invoiceFile?: string }[];
      for (const a of appts) {
        if (a?.invoiceFile) addKind(map, a.invoiceFile, "invoice");
      }
    }
  } catch (e) {
    errors.push(`invoices: ${(e as Error)?.message}`);
  }

  /* 5) صفحات المحتوى — مستندات صغيرة، فحص كامل في الذاكرة */
  try {
    const pages = (await PageContent.find({}).lean()) as unknown[];
    for (const p of pages) {
      matchNamesInString(JSON.stringify(p), names, "pages", map);
    }
  } catch (e) {
    errors.push(`pages: ${(e as Error)?.message}`);
  }

  if (errors.length) {
    throw new Error(`فشل فحص استخدام الوسائط [${errors.join(" | ")}]`);
  }
  return map;
}

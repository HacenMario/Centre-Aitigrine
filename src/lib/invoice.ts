/**
 * الفاتورة PDF — ★ بالفرنسية دائماً بطلب صاحب المركز، تخطيط LTR فرنسي منضبط
 * - القيم الواردة من قاعدة البيانات (أسماء، خدمة) قد تكون بالعربية: pdfkit+fontkit
 *   يشكّل العربية ويصحح ترتيبها، وتُثبَّت المسافات بين الحروف العربية عبر NBSP
 *   (الحل المُثبت بصرياً في v3.8.1) — دون أي تأثير على النص الفرنسي.
 * - الملف: facture-<num>.pdf في GridFS (idempotent) — تاريخ الإصدار بتوقيت الجزائر GMT+1
 *
 * ── v3.10.0 — إصلاح «الفاتورة في صفحتين» الجذري ──
 * السبب: التذييل كان يُرسم عند y=772/786 بينما حد الصفحة السفلي 792 —
 * السطر الأخير كان يفيض بضع نقاط فيفتح PDFKit صفحة ثانية لسطر واحد!
 * الحل: تذييل مرفوع (752/766) بنصوص أقصر مضمونة بسطر واحد بالقياس الفعلي widthOfString،
 * وكل المحتوى ينتهي قبل ~460 بفاصل آمن ضخم — الصفحة الواحدة مضمونة هندسياً.
 *
 * ── v3.10.0 — توحيد Mode/Désignation ──
 * سطر الجدول يذكر وضع الجلسة بنفس صياغة سطر Mode (لا تناقض بين
 * «Présentielle au centre» / «À distance» ونص عمود DÉSIGNATION)،
 * مع قصّ عمود DÉSIGNATION بالقياس الفعلي فلا يتجاوز عمود MONTANT أبداً.
 */
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { Appointment, Settings, User, Service } from "./models";
import { mediaBucket, putMedia, mediaMeta } from "./media-store";

export type InvoiceLang = "fr";

const LABELS: Record<string, string> = {
  title: "FACTURE DE SÉANCE",
  invoiceNo: "N° de facture",
  issueDate: "Date d'émission",
  client: "Client",
  clientPhone: "Téléphone",
  specialist: "Spécialiste",
  service: "Prestation",
  sessionDate: "Date de la séance",
  sessionTime: "Heure",
  mode: "Mode",
  remote: "À distance (vidéo)",
  onsite: "Présentielle au centre",
  designation: "DÉSIGNATION",
  amount: "MONTANT",
  sessionPrice: "Séance",
  discount: "Remise",
  netDue: "NET À PAYER",
  paymentStatus: "Statut du paiement",
  paid: "Payé",
  unpaid: "Non payé",
  footer1: "Facture émise électroniquement par le Centre Ait Tegrine — document officiel.",
  footer2: "Merci de votre confiance — santé et bien-être.",
  remoteShort: "à distance (vidéo)",
  onsiteShort: "présentielle au centre",
  psych: "Séance psychologique",
  art: "Séance d'art-thérapie",
  currency: "DA",
};

export type InvoiceData = {
  number: string;
  createdAt: Date;
  centerName: string;
  centerPhone: string;
  centerAddress: string;
  logoBase64: string;
  clientName: string;
  clientPhone: string;
  specialistName: string;
  serviceTitle: string;
  date: string;
  time: string;
  mode: string;
  price: number;
  discount: number;
  couponCode: string;
  total: number;
  paymentStatus: string;
};

/** التاريخ بتوقيت الجزائر GMT+1 — JJ/MM/AAAA */
function algiersDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Algiers", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** تاريخ الجلسة المخزّن YYYY-MM-DD → JJ/MM/AAAA */
function frDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || "—");
}

/**
 * تثبيت المسافات العربية داخل قيمة مكتوبة بالعربية (حل v3.8.1 المُثبت بصرياً):
 * NBSP بين حرفين عربيين فقط — يمنع طيّ المسافات في bidi الداخلي لـ fontkit
 */
function fixArabicSpacing(s: string): string {
  return String(s ?? "").replace(/(?<=[\u0600-\u06FF\u0640])\u0020+(?=[\u0600-\u06FF\u0640])/g, "\u00A0");
}
const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(String(s ?? ""));
/** القيم: عربية فقط تحتاج تثبيت المسافات — الفرنسية تُرسم كما هي */
const V = (s: string) => (hasArabic(s) ? fixArabicSpacing(String(s)) : String(s ?? ""));

/** قصّ نص ليتسع لعرض معيّن بالقياس الفعلي — يمنع أي تجاوز عمودي */
function fitText(doc: PDFKit.PDFDocument, s: string, maxW: number): string {
  let out = String(s ?? "").trim();
  if (!out) return out;
  try {
    while (out.length > 1 && doc.widthOfString(out) > maxW) {
      out = out.slice(0, -1).replace(/\s+\S*$/, "");
      if (doc.widthOfString(out + " …") <= maxW) return out + " …";
    }
  } catch {}
  return out;
}

/** توليد بايتات PDF — دائماً بالفرنسية وتخطيط LTR منضبط — صفحة واحدة مضمونة */
export function renderInvoicePdf(d: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const L = LABELS;
    const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: `Facture ${d.number}`, Author: d.centerName || "Centre Ait Tegrine" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fontPath = path.join(process.cwd(), "public", "fonts", "DejaVuSans.ttf");
    const fontBold = path.join(process.cwd(), "public", "fonts", "DejaVuSans-Bold.ttf");
    try {
      doc.registerFont("body", fs.existsSync(fontPath) ? fontPath : "Helvetica");
      doc.registerFont("bodyb", fs.existsSync(fontBold) ? fontBold : "Helvetica-Bold");
    } catch {
      doc.registerFont("body", "Helvetica");
      doc.registerFont("bodyb", "Helvetica-Bold");
    }

    const money = (n: number) => `${Number(n || 0).toLocaleString("fr-FR")} ${L.currency}`;
    const TEAL = "#0f766e";
    const INK = "#111827";
    const GRAY = "#6b7280";
    const LINE = "#e5e7eb";

    /* ══ 1) الترويسة: شعار يسار + بيانات المركز، والعنوان يمين ══ */
    const logo = d.logoBase64?.startsWith("data:image")
      ? Buffer.from(d.logoBase64.slice(d.logoBase64.indexOf(",") + 1), "base64")
      : null;
    let headerTextX = 50;
    if (logo) {
      try {
        doc.image(logo, 50, 42, { fit: [64, 64] });
        headerTextX = 128;
      } catch {}
    }
    doc.font("bodyb").fontSize(15).fillColor(INK);
    doc.text(V(d.centerName || "Centre Ait Tegrine"), headerTextX, 46, { width: 240, lineGap: 2 });
    doc.font("body").fontSize(9.5).fillColor(GRAY);
    doc.text(V(d.centerAddress || ""), headerTextX, doc.y + 2, { width: 240, lineGap: 1 });
    doc.text(`Tél : ${d.centerPhone || "—"}`, headerTextX, doc.y + 1, { width: 240 });

    doc.font("bodyb").fontSize(17).fillColor(TEAL);
    doc.text(L.title, 300, 54, { width: 245, align: "right" });
    doc.font("body").fontSize(10.5).fillColor("#374151");
    doc.text(`${L.invoiceNo} : ${d.number}`, 300, 84, { width: 245, align: "right" });
    doc.text(`${L.issueDate} : ${algiersDate(d.createdAt)}`, 300, 100, { width: 245, align: "right" });

    /* خط فاصل */
    const ruleY = Math.max(118, doc.y + 14);
    doc.moveTo(50, ruleY).lineTo(545, ruleY).strokeColor(TEAL).lineWidth(2).stroke();

    /* ══ 2) بيانات العميل والجلسة — عمودان: العميل يمين، الجلسة يسار ══ */
    let y = ruleY + 18;
    doc.font("bodyb").fontSize(11).fillColor(TEAL);
    doc.text("INFORMATIONS", 50, y, { width: 495 });
    y += 18;

    const kv = (label: string, value: string, x = 50, w = 495) => {
      const lw = 138; /* عمود التسميات يتسع لأطول تسمية (Date de la séance) */
      doc.font("bodyb").fontSize(10.5).fillColor("#374151");
      doc.text(`${label} :`, x, y, { width: lw, align: "left" });
      doc.font("body").fontSize(10.5).fillColor(INK);
      doc.text(V(value) || "—", x + lw + 8, y, { width: w - lw - 8 });
      y += Math.max(16, doc.heightOfString(V(value) || "—", { width: w - lw - 8 }) + 3);
    };

    kv(L.client, d.clientName);
    kv(L.clientPhone, d.clientPhone || "—");
    kv(L.specialist, d.specialistName);
    kv(L.service, d.serviceTitle || L.psych);
    kv(L.sessionDate, `${frDay(d.date)} — ${d.time}`);
    kv(L.mode, d.mode === "remote" ? L.remote : L.onsite);

    y += 8;

    /* ══ 3) جدول المبالغ — صفحة واحدة: كل المحتوى ينتهي هنا قبل ~460 (حد الأمان 720) ══ */
    const tableX = 50;
    const tableW = 495;
    const AMT_X = 380; /* بداية عمود المبلغ */
    const DESC_MAX_W = AMT_X - tableX - 30; /* أقصى عرض لعمود DÉSIGNATION قبل عمود المبلغ */

    doc.rect(tableX, y, tableW, 26).fill(TEAL);
    doc.font("bodyb").fontSize(10.5).fillColor("#ffffff");
    doc.text(L.designation, tableX + 12, y + 7, { width: DESC_MAX_W });
    doc.text(L.amount, AMT_X, y + 7, { width: tableX + tableW - AMT_X - 12, align: "right" });
    y += 26;

    const row = (label: string, value: string, bold = false) => {
      const h = 24;
      doc.rect(tableX, y, tableW, h).fill(bold ? "#e6f5f3" : "#ffffff");
      doc.strokeColor(LINE).lineWidth(0.5).rect(tableX, y, tableW, h).stroke();
      doc.font(bold ? "bodyb" : "body").fontSize(10.5).fillColor(INK);
      /* ★ v3.10: قصّ بالقياس الفعلي — لا يتجاوز النص عمود المبلغ مهما طال */
      doc.text(fitText(doc, label, DESC_MAX_W), tableX + 12, y + 7, { width: DESC_MAX_W, lineBreak: false });
      doc.text(value, AMT_X, y + 7, { width: tableX + tableW - AMT_X - 12, align: "right", lineBreak: false });
      y += h;
    };

    /* ★ v3.10: DÉSIGNATION يذكّر وضع الجلسة بنفس صياغة سطر Mode — لا تناقض أبداً */
    const isRemote = d.mode === "remote";
    const desigBase = V(d.serviceTitle || L.psych);
    const desigSuffix = isRemote ? L.remoteShort : L.onsiteShort;
    row(`${desigBase} — ${desigSuffix}`, money(d.price));
    if (d.discount > 0) row(`${L.discount}${d.couponCode ? ` (${d.couponCode})` : ""}`, `- ${money(d.discount)}`);
    row(L.netDue, money(d.total), true);

    /* حالة الدفع */
    y += 10;
    const paid = d.paymentStatus === "paid";
    doc.roundedRect(tableX, y, 190, 24, 12).fill(paid ? "#ecfdf5" : "#fffbeb");
    doc.strokeColor(paid ? "#a7f3d0" : "#fde68a").lineWidth(1).roundedRect(tableX, y, 190, 24, 12).stroke();
    doc.font("bodyb").fontSize(10).fillColor(paid ? "#047857" : "#b45309");
    doc.text(`${L.paymentStatus} : ${paid ? L.paid : L.unpaid}`, tableX + 12, y + 7, { width: 170, lineBreak: false });
    y += 34;

    /* ══ تذييل مرفوع (v3.10) — 752/766 < حد الصفحة 792 بفاصل مريح
       الصفحة الواحدة مضمونة: حتى لو التف نص التذييل (مستحيل بعد القياس) يبقى داخل الحد */
    doc.font("body").fontSize(8.5).fillColor(GRAY);
    doc.text(L.footer1, 50, 752, { width: 495, align: "center", lineGap: 0, lineBreak: false });
    doc.text(L.footer2, 50, 766, { width: 495, align: "center", lineBreak: false });

    doc.end();
  });
}

/**
 * ضمان وجود الفاتورة الفرنسية للجلسة (idempotent)
 * ★ v3.10: إصدار التخطيط (invoiceVersion) — الفواتير القديمة (صفحتان بسبب تذييل الفائض)
 *   تُعاد توليدها تلقائياً بالتخطيط الجديد (صفحة واحدة) عند أول طلب
 */
const INVOICE_VERSION = "v3.10";
export async function ensureInvoice(appointmentId: string, _lang?: InvoiceLang): Promise<{ number: string; file: string } | null> {
  void _lang;
  const appt = await Appointment.findById(appointmentId).lean<Record<string, unknown> | null>();
  if (!appt) return null;

  const number = String(appt.invoiceNumber || "");
  const file = `facture-${number || "draft"}.pdf`;
  if (number) {
    const meta = await mediaMeta(file).catch(() => null);
    /* الفاتورة الموجودة تُعاد فقط إن كانت بنفس إصدار التخطيط الحالي */
    if (meta && String(appt.invoiceVersion || "") === INVOICE_VERSION) return { number, file };
  }

  const [st, client, spec] = await Promise.all([
    Settings.findOne({ key: "center" }).lean<{ centerName?: string; centerNameFr?: string; phone?: string; address?: string; logoBase64?: string } | null>(),
    User.findById(appt.clientId).select("name phone").lean<{ name?: string; phone?: string } | null>(),
    User.findById(appt.specialistId).select("name").lean<{ name?: string } | null>(),
  ]);

  /* ★ v3.9: عنوان الخدمة بالفرنسية — وإن غاب عن الموعد جُلب من الخدمة نفسها */
  let serviceFr = String(appt.serviceTitleFr || appt.serviceTitleEn || appt.serviceTitle || "");
  if (!serviceFr && appt.serviceId) {
    const svc = await Service.findById(String(appt.serviceId)).select("title").lean<{ title?: { fr?: string; en?: string; ar?: string } } | null>().catch(() => null);
    serviceFr = String(svc?.title?.fr || svc?.title?.en || svc?.title?.ar || "");
  }
  if (!serviceFr) serviceFr = appt.kind === "art_therapy" ? LABELS.art : LABELS.psych;

  const price = Number(appt.price || 0);
  const discount = Number(appt.discount || 0);
  const now = new Date();
  const invNumber = number || `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(appt._id).slice(-6).toUpperCase()}`;

  const data: InvoiceData = {
    number: invNumber,
    createdAt: now,
    centerName: st?.centerNameFr || st?.centerName || "Centre Ait Tegrine",
    centerPhone: st?.phone || "",
    centerAddress: st?.addressFr || st?.address || "",
    logoBase64: st?.logoBase64 || "",
    clientName: client?.name || "",
    clientPhone: client?.phone || "",
    specialistName: spec?.name || "",
    serviceTitle: serviceFr,
    date: String(appt.date || ""),
    time: String(appt.time || ""),
    mode: String(appt.mode || "onsite"),
    price,
    discount,
    couponCode: String(appt.couponCode || ""),
    total: Math.max(0, price - discount),
    paymentStatus: String(appt.paymentStatus || "unpaid"),
  };

  const buf = await renderInvoicePdf(data);
  const fileName = `facture-${invNumber}.pdf`;
  await putMedia(fileName, buf, "application/pdf");

  /* نربط الرقم بالإصدار والموعد — الإصدار يضمن إعادة توليد أي فاتورة قديمة */
  await Appointment.findByIdAndUpdate(appointmentId, {
    invoiceNumber: invNumber,
    invoiceFile: fileName,
    invoiceAt: number ? (appt.invoiceAt as Date || now) : now,
    invoiceVersion: INVOICE_VERSION,
  });

  void mediaBucket;
  return { number: invNumber, file: fileName };
}

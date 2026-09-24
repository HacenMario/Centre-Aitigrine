/**
 * الفواتير PDF التلقائية (v3.8)
 * ensureInvoice(appointmentId) — يولّد فاتورة PDF بشعار المركز للجلسة
 *   ويحفظها في GridFS ويربط رقمها بملف العميل (idempotent: يُنشأ مرة واحدة)
 * ★ العربية: تشكيل الحروف (ArabicShaper) + ترتيب bidi يدوي للأسطر RTL
 *   (pdfkit لا يدعم التشكيل/الاتجاه أصلاً — هذه المعالجة تعطي نصاً عربياً سليماً)
 */
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { ArabicShaper } from "arabic-persian-reshaper";
import { Appointment, Settings, User } from "./models";
import { mediaBucket, putMedia, mediaMeta } from "./media-store";

/* ── bidi مبسّط: اعكس ترتيب المقاطع واعكس داخل المقطع العربي ── */
const RTL_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function arLine(text: string): string {
  if (!text) return "";
  const shaped = ArabicShaper.convertArabic(String(text));
  /* قسّم إلى مقاطع: عربي متصل / غير عربي متصل */
  const runs: string[] = [];
  let cur = "";
  let curRtl = null as boolean | null;
  for (const ch of shaped) {
    const isRtl = RTL_RE.test(ch) || ch === " ";
    const rtlClass = RTL_RE.test(ch) ? true : curRtl === true && ch === " " ? true : RTL_RE.test(ch);
    void rtlClass;
    const chRtl = RTL_RE.test(ch);
    const useRtl = chRtl || (curRtl === true && ch === " ");
    if (curRtl === null) {
      cur = ch;
      curRtl = useRtl;
    } else if (useRtl === curRtl) {
      cur += ch;
    } else {
      runs.push(cur);
      cur = ch;
      curRtl = useRtl;
    }
  }
  if (cur) runs.push(cur);
  /* اقلب أطراف المسافات في المقاطع */
  const fixed = runs.map((r) => {
    const rtl = RTL_RE.test(r.replace(/\s+/g, ""));
    return rtl ? [...r].reverse().join("").replace(/^ /, " ").replace(/ $/, " ") : r;
  });
  return fixed.reverse().join("");
}

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

/** توليد بايتات PDF من بيانات الفاتورة */
export function renderInvoicePdf(d: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: `Invoice ${d.number}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fontPath = path.join(process.cwd(), "public", "fonts", "DejaVuSans.ttf");
    const fontBold = path.join(process.cwd(), "public", "fonts", "DejaVuSans-Bold.ttf");
    const AR = (s: string) => arLine(s);
    try {
      doc.registerFont("ar", fs.existsSync(fontPath) ? fontPath : "Helvetica");
      doc.registerFont("arb", fs.existsSync(fontBold) ? fontBold : "Helvetica-Bold");
    } catch {
      doc.registerFont("ar", "Helvetica");
      doc.registerFont("arb", "Helvetica-Bold");
    }

    const money = (n: number) => `${Number(n || 0).toLocaleString("fr-DZ")} DA`;

    /* الشعار + اسم المركز */
    const logo = d.logoBase64?.startsWith("data:image")
      ? Buffer.from(d.logoBase64.slice(d.logoBase64.indexOf(",") + 1), "base64")
      : null;
    if (logo) {
      try {
        doc.image(logo, 50, 40, { fit: [70, 70] });
      } catch {}
    }
    doc.font("arb").fontSize(18).fillColor("#111827");
    doc.text(AR(d.centerName || "Centre Aitigrine"), logo ? 135 : 50, 48, { align: "left" });
    doc.font("ar").fontSize(10).fillColor("#6b7280");
    doc.text(AR(d.centerAddress || ""), logo ? 135 : 50, 74, { align: "left" });
    doc.text(`Tél: ${d.centerPhone || "—"}`, logo ? 135 : 50, 90, { align: "left" });

    /* عنوان الفاتورة */
    doc.font("arb").fontSize(22).fillColor("#0f766e");
    doc.text(AR("فاتورة جلسة"), 50, 50, { align: "right", width: 495 });
    doc.font("ar").fontSize(11).fillColor("#374151");
    doc.text(`${AR("رقم الفاتورة")}: ${d.number}`, 50, 80, { align: "right", width: 495 });
    doc.text(`${AR("تاريخ الإصدار")}: ${d.createdAt.toISOString().slice(0, 10)}`, 50, 98, { align: "right", width: 495 });

    doc.moveTo(50, 130).lineTo(545, 130).strokeColor("#0f766e").lineWidth(2).stroke();

    /* بيانات العميل والجلسة */
    let y = 150;
    const kv = (label: string, value: string, x = 50, w = 495) => {
      doc.font("arb").fontSize(11).fillColor("#374151").text(AR(label), x, y, { align: "right", width: w });
      doc.font("ar").fontSize(11).fillColor("#111827").text(String(value || "—"), x, y, { align: "left", width: w - 120 });
      y += 22;
    };
    kv("العميل", d.clientName || "—");
    kv("هاتف العميل", d.clientPhone || "—");
    kv("الأخصائي", d.specialistName || "—");
    kv("الخدمة", d.serviceTitle || "جلسة نفسية");
    kv("تاريخ الجلسة", `${d.date} ${d.time}`);
    kv("طريقة الجلسة", d.mode === "remote" ? "عن بُعد (فيديو)" : "حضورية في المركز");

    /* جدول المبالغ */
    y += 12;
    doc.rect(50, y, 495, 26).fill("#0f766e");
    doc.font("arb").fontSize(11).fillColor("#ffffff");
    doc.text(AR("البيان"), 320, y + 7, { align: "left", width: 200 });
    doc.text(AR("المبلغ"), 60, y + 7, { align: "right", width: 180 });
    y += 26;

    const row = (label: string, value: string, bold = false) => {
      doc.rect(50, y, 495, 24).fill(bold ? "#e6f5f3" : "#ffffff");
      doc.strokeColor("#e5e7eb").lineWidth(0.5).rect(50, y, 495, 24).stroke();
      doc.font(bold ? "arb" : "ar").fontSize(11).fillColor("#111827");
      doc.text(AR(label), 320, y + 6, { align: "left", width: 200 });
      doc.text(value, 60, y + 6, { align: "right", width: 180 });
      y += 24;
    };
    row("سعر الجلسة", money(d.price));
    if (d.discount > 0) {
      row(`الخصم${d.couponCode ? ` (${d.couponCode})` : ""}`, `- ${money(d.discount)}`);
    }
    row("الصافي المستحق", money(d.total), true);
    row("حالة الدفع", d.paymentStatus === "paid" ? "مدفوع" : "غير مدفوع");

    /* تذييل */
    doc.font("ar").fontSize(9).fillColor("#6b7280");
    doc.text(AR("هذه الفاتورة صادرة إلكترونياً عن نظام مركز آيت تقرين وتُعتبر وثيقة رسمية."), 50, 720, { align: "center", width: 495 });
    doc.text(AR("شكراً لثقتكم — نتمنى لكم دوام الصحة والعافية"), 50, 736, { align: "center", width: 495 });

    doc.end();
  });
}

/**
 * ضمان وجود فاتورة للجلسة: يُنشئها إن لم تكن موجودة ويحفظها GridFS
 * returns { number, file } أو null إن فشل
 */
export async function ensureInvoice(appointmentId: string): Promise<{ number: string; file: string } | null> {
  const appt = await Appointment.findById(appointmentId).lean<Record<string, unknown> | null>();
  if (!appt) return null;
  if (appt.invoiceNumber && appt.invoiceFile) {
    const meta = await mediaMeta(String(appt.invoiceFile)).catch(() => null);
    if (meta) return { number: String(appt.invoiceNumber), file: String(appt.invoiceFile) };
  }

  const [st, client, spec] = await Promise.all([
    Settings.findOne({ key: "center" }).lean<{ centerName?: string; phone?: string; address?: string; logoBase64?: string } | null>(),
    User.findById(appt.clientId).select("name phone").lean<{ name?: string; phone?: string } | null>(),
    User.findById(appt.specialistId).select("name").lean<{ name?: string } | null>(),
  ]);

  const price = Number(appt.price || 0);
  const discount = Number(appt.discount || 0);
  const now = new Date();
  const number = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(appt._id).slice(-6).toUpperCase()}`;
  const data: InvoiceData = {
    number,
    createdAt: now,
    centerName: st?.centerName || "Centre Aitigrine — مركز آيت تقرين",
    centerPhone: st?.phone || "",
    centerAddress: st?.address || "",
    logoBase64: st?.logoBase64 || "",
    clientName: client?.name || "",
    clientPhone: client?.phone || "",
    specialistName: spec?.name || "",
    serviceTitle: String(appt.serviceTitle || (appt.kind === "art_therapy" ? "جلسة علاج فني" : "جلسة نفسية")),
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
  const file = `invoice-${number}.pdf`;
  await putMedia(file, buf, "application/pdf");

  await Appointment.findByIdAndUpdate(appointmentId, {
    invoiceNumber: number,
    invoiceFile: file,
    invoiceAt: now,
  });

  /* تجنب أي تراكم: مرجع للحاوية في مكان واحد */
  void mediaBucket;
  return { number, file };
}

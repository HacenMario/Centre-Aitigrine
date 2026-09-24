/**
 * الفواتير PDF التلقائية (v3.8.1)
 * ensureInvoice(appointmentId, lang) — يولّد فاتورة PDF بشعار المركز للجلسة
 *   ويحفظها في GridFS ويربط رقمها بملف العميل (idempotent لكل لغة)
 * ★ v3.8.1 — إصلاح جذري للعربية (مُثبت بفحص بصري فعلي للصور):
 *   pdfkit 0.20 + fontkit 2.0 يشكّلان العربية ويرتّبان bidi تلقائياً — الترتيب صحيح،
 *   لكن المسافات العادية بين كلمتين عربيتين داخل السطر تُطوى فتظهر الكلمات ملتصقة.
 *   الحل المُختبر: NBSP بين الحروف العربية حصراً (arLine) — يثبّت المسافات العربية
 *   ويترك الأرقام واللاتيني بمسافاتها العادية ليعالجها bidi الداخلي بشكل صحيح.
 * ★ الفاتورة بلغة واجهة المستخدم (عربي/فرنسي/إنجليزي/تركي/إسباني)
 *   مع اتجاه صفوف RTL للعربية و LTR للبقية، وتواريخ بتوقيت الجزائر GMT+1
 */
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { Appointment, Settings, User } from "./models";
import { mediaBucket, putMedia, mediaMeta } from "./media-store";

export type InvoiceLang = "ar" | "fr" | "en" | "tr" | "es";

/** قواميس الفاتورة — خمس لغات */
const LABELS: Record<InvoiceLang, Record<string, string>> = {
  ar: {
    title: "فاتورة جلسة", invoiceNo: "رقم الفاتورة", issueDate: "تاريخ الإصدار",
    client: "العميل", clientPhone: "هاتف العميل", specialist: "الأخصائي",
    service: "الخدمة", sessionDate: "تاريخ الجلسة", mode: "طريقة الجلسة",
    remote: "عن بُعد (فيديو)", onsite: "حضورية في المركز",
    description: "البيان", amount: "المبلغ",
    sessionPrice: "سعر الجلسة", discount: "الخصم", netDue: "الصافي المستحق",
    paymentStatus: "حالة الدفع", paid: "مدفوع", unpaid: "غير مدفوع",
    footer1: "هذه الفاتورة صادرة إلكترونياً عن نظام مركز آيت تقرين وتُعتبر وثيقة رسمية.",
    footer2: "شكراً لثقتكم — نتمنى لكم دوام الصحة والعافية",
    psych: "جلسة نفسية", art: "جلسة علاج فني", currency: "دج",
  },
  fr: {
    title: "Facture de séance", invoiceNo: "N° de facture", issueDate: "Date d'émission",
    client: "Client", clientPhone: "Tél. du client", specialist: "Spécialiste",
    service: "Service", sessionDate: "Date de la séance", mode: "Mode de séance",
    remote: "À distance (vidéo)", onsite: "Présentielle au centre",
    description: "Désignation", amount: "Montant",
    sessionPrice: "Prix de la séance", discount: "Remise", netDue: "Net à payer",
    paymentStatus: "Statut de paiement", paid: "Payé", unpaid: "Non payé",
    footer1: "Cette facture est émise électroniquement par le système du Centre Ait Tegrine et constitue un document officiel.",
    footer2: "Merci de votre confiance — nous vous souhaitons santé et bien-être",
    psych: "Séance psychologique", art: "Séance d'art-thérapie", currency: "DA",
  },
  en: {
    title: "Session Invoice", invoiceNo: "Invoice no.", issueDate: "Issue date",
    client: "Client", clientPhone: "Client phone", specialist: "Specialist",
    service: "Service", sessionDate: "Session date", mode: "Session mode",
    remote: "Remote (video)", onsite: "In-person at the center",
    description: "Description", amount: "Amount",
    sessionPrice: "Session price", discount: "Discount", netDue: "Net due",
    paymentStatus: "Payment status", paid: "Paid", unpaid: "Unpaid",
    footer1: "This invoice is issued electronically by the Ait Tegrine Center system and is considered an official document.",
    footer2: "Thank you for your trust — we wish you health and well-being",
    psych: "Psychological session", art: "Art therapy session", currency: "DA",
  },
  tr: {
    title: "Seans Faturası", invoiceNo: "Fatura no", issueDate: "Düzenleme tarihi",
    client: "Danışan", clientPhone: "Danışan telefonu", specialist: "Uzman",
    service: "Hizmet", sessionDate: "Seans tarihi", mode: "Seans yöntemi",
    remote: "Uzaktan (görüntülü)", onsite: "Merkezde yüz yüze",
    description: "Açıklama", amount: "Tutar",
    sessionPrice: "Seans ücreti", discount: "İndirim", netDue: "Ödenecek net",
    paymentStatus: "Ödeme durumu", paid: "Ödendi", unpaid: "Ödenmedi",
    footer1: "Bu fatura, Ait Tegrine Merkezi sistemi tarafından elektronik olarak düzenlenir ve resmi bir belge sayılır.",
    footer2: "Güveniniz için teşekkürler — sağlık ve iyi dileklerimizle",
    psych: "Psikolojik seans", art: "Sanat terapisi seansı", currency: "DA",
  },
  es: {
    title: "Factura de sesión", invoiceNo: "N.º de factura", issueDate: "Fecha de emisión",
    client: "Cliente", clientPhone: "Tel. del cliente", specialist: "Especialista",
    service: "Servicio", sessionDate: "Fecha de la sesión", mode: "Modalidad",
    remote: "A distancia (vídeo)", onsite: "Presencial en el centro",
    description: "Concepto", amount: "Importe",
    sessionPrice: "Precio de la sesión", discount: "Descuento", netDue: "Neto a pagar",
    paymentStatus: "Estado del pago", paid: "Pagado", unpaid: "No pagado",
    footer1: "Esta factura se emite electrónicamente por el sistema del Centro Ait Tegrine y se considera un documento oficial.",
    footer2: "Gracias por su confianza — le deseamos salud y bienestar",
    psych: "Sesión psicológica", art: "Sesión de arteterapia", currency: "DA",
  },
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

/** التاريخ بتوقيت الجزائر GMT+1 */
function algiersDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Algiers", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * ★ v3.8.1 — تثبيت المسافات العربية: NBSP فقط بين حرفين عربيين
 * يمنع طي المسافات في bidi الداخلي لـ fontkit دون عكس الأرقام/اللاتيني
 */
function arLine(s: string): string {
  return s.replace(/(?<=[\u0600-\u06FF\u0640])\u0020+(?=[\u0600-\u06FF\u0640])/g, "\u00A0");
}

/** توليد بايتات PDF من بيانات الفاتورة — لغة واعية */
export function renderInvoicePdf(d: InvoiceData, lang: InvoiceLang = "ar"): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const L = LABELS[lang] || LABELS.ar;
    const rtl = lang === "ar";
    const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: `Invoice ${d.number}` } });
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

    const money = (n: number) => `${Number(n || 0).toLocaleString("fr-DZ")} ${L.currency}`;
    /** نص معروض: عند العربية نثبّت المسافات بين الكلمات العربية */
    const T = (s: string) => (rtl ? arLine(String(s ?? "")) : String(s ?? ""));

    /* الشعار + اسم المركز — دائماً في الزاوية حسب الاتجاه */
    const logo = d.logoBase64?.startsWith("data:image")
      ? Buffer.from(d.logoBase64.slice(d.logoBase64.indexOf(",") + 1), "base64")
      : null;
    if (logo) {
      try {
        doc.image(logo, rtl ? 475 : 50, 40, { fit: [70, 70] });
      } catch {}
    }
    /* بلا شعار: الاسم أعلى الصفحة بسطر مستقل كامل العرض — لا تراكب مع العنوان */
    const headX = logo ? (rtl ? 400 : 135) : 50;
    const headW = logo ? 260 : 495;
    const headAlign = logo ? (rtl ? "right" : "left") : rtl ? "right" : "left";
    const nameY = logo ? 48 : 40;
    const addrY = logo ? 74 : 62;
    const phoneY = logo ? 90 : 76;
    doc.font("bodyb").fontSize(16).fillColor("#111827");
    doc.text(T(d.centerName || "Centre Aitigrine"), headX, nameY, { align: headAlign, width: headW });
    doc.font("body").fontSize(10).fillColor("#6b7280");
    doc.text(T(d.centerAddress || ""), headX, addrY, { align: headAlign, width: headW });
    doc.text(T(`${rtl ? "الهاتف" : "Tél"}: ${d.centerPhone || "—"}`), headX, phoneY, { align: headAlign, width: headW });

    /* عنوان الفاتورة + الرقم والتاريخ في الجهة المقابلة (بلا شعار: أسطر مستقلة تحت الاسم) */
    const titleY = logo ? 46 : 104;
    const invY = logo ? 80 : 140;
    const invDateY = logo ? 98 : 156;
    const titleW = logo ? 495 : headW;
    doc.font("bodyb").fontSize(22).fillColor("#0f766e");
    doc.text(T(L.title), 50, titleY, { align: rtl ? "left" : "right", width: titleW });
    doc.font("body").fontSize(11).fillColor("#374151");
    doc.text(T(`${L.invoiceNo}: ${d.number}`), 50, invY, { align: rtl ? "left" : "right", width: titleW });
    doc.text(T(`${L.issueDate}: ${algiersDate(d.createdAt)}`), 50, invDateY, { align: rtl ? "left" : "right", width: titleW });

    doc.moveTo(50, invDateY + 26).lineTo(545, invDateY + 26).strokeColor("#0f766e").lineWidth(2).stroke();

    /* بيانات الجلسة — تسمية قرب الحافة (يمين للعربية، يسار للبقية) والقيمة في الجهة الأخرى */
    let y = invDateY + 46;
    const kv = (label: string, value: string) => {
      doc.font("bodyb").fontSize(11).fillColor("#374151");
      doc.text(T(label), 50, y, { align: rtl ? "right" : "left", width: 495 });
      doc.font("body").fontSize(11).fillColor("#111827");
      doc.text(T(value), 50, y, { align: rtl ? "left" : "right", width: 495 });
      y += 22;
    };
    kv(L.client, d.clientName || "—");
    kv(L.clientPhone, d.clientPhone || "—");
    kv(L.specialist, d.specialistName || "—");
    kv(L.service, d.serviceTitle || L.psych);
    kv(L.sessionDate, `${d.date} ${d.time}`);
    kv(L.mode, d.mode === "remote" ? L.remote : L.onsite);

    /* جدول المبالغ — رسم بمواضع محسوبة يدوياً (widthOfString) بدل align:
       يتجاوز سلوك pdfkit الداخلي غير المستقر مع align المزدوج للعربية */
    const drawCell = (s: string, edge: number, side: "start" | "end", yOff = 0) => {
      const txt = T(s);
      const x = side === "end" ? edge - doc.widthOfString(txt) : edge;
      doc.text(txt, x, y + yOff, { lineGap: 0 });
    };
    const DESC_END = rtl ? 360 : 60;   /* نهاية عمود البيان (يمين للعربية، يسار للبقية) */
    const AMT_EDGE = rtl ? 365 : 535;  /* بداية عمود المبلغ */

    doc.rect(50, y, 495, 26).fill("#0f766e");
    doc.strokeColor("#0f766e").lineWidth(0.5).rect(50, y, 495, 26).stroke();
    doc.font("bodyb").fontSize(11).fillColor("#ffffff");
    drawCell(L.description, DESC_END, "end", 3);
    /* ★ رأس عمود المبلغ: align center — النمط الوحيد الذي أثبت pdfkit أنه يرسم العربية بشكل موثوق في هذا السياق */
    doc.text(T(L.amount), 365, y + 7, { align: "center", width: 170 });
    y += 26;

    const row = (label: string, value: string, bold = false) => {
      doc.rect(50, y, 495, 24).fill(bold ? "#e6f5f3" : "#ffffff");
      doc.strokeColor("#e5e7eb").lineWidth(0.5).rect(50, y, 495, 24).stroke();
      doc.font(bold ? "bodyb" : "body").fontSize(11).fillColor("#111827");
      drawCell(label, DESC_END, "end");
      drawCell(value, AMT_EDGE, "start");
      y += 24;
    };
    row(L.sessionPrice, money(d.price));
    if (d.discount > 0) {
      row(`${L.discount}${d.couponCode ? ` (${d.couponCode})` : ""}`, `- ${money(d.discount)}`);
    }
    row(L.netDue, money(d.total), true);
    row(L.paymentStatus, d.paymentStatus === "paid" ? L.paid : L.unpaid);

    /* تذييل */
    doc.font("body").fontSize(9).fillColor("#6b7280");
    doc.text(T(L.footer1), 50, 720, { align: "center", width: 495 });
    doc.text(T(L.footer2), 50, 736, { align: "center", width: 495 });

    doc.end();
  });
}

/**
 * ضمان وجود فاتورة للجلسة باللغة المطلوبة
 * ★ لكل لغة ملفها الخاص: invoice-<num>.pdf للعربية و invoice-<num>-fr.pdf للفرنسية...
 *   يُنشأ مرة واحدة لكل لغة (idempotent) ويُعاد من GridFS في الطلبات التالية
 * returns { number, file } أو null إن فشل
 */
export async function ensureInvoice(appointmentId: string, lang: InvoiceLang = "ar"): Promise<{ number: string; file: string } | null> {
  const appt = await Appointment.findById(appointmentId).lean<Record<string, unknown> | null>();
  if (!appt) return null;

  const safeLang: InvoiceLang = ["ar", "fr", "en", "tr", "es"].includes(lang) ? (lang as InvoiceLang) : "ar";
  const number = String(appt.invoiceNumber || "");
  if (number) {
    const langFile = safeLang === "ar" ? `invoice-${number}.pdf` : `invoice-${number}-${safeLang}.pdf`;
    const meta = await mediaMeta(langFile).catch(() => null);
    if (meta) return { number, file: langFile };
  }

  const [st, client, spec] = await Promise.all([
    Settings.findOne({ key: "center" }).lean<{ centerName?: string; centerNameFr?: string; phone?: string; address?: string; logoBase64?: string } | null>(),
    User.findById(appt.clientId).select("name phone").lean<{ name?: string; phone?: string } | null>(),
    User.findById(appt.specialistId).select("name").lean<{ name?: string } | null>(),
  ]);

  const price = Number(appt.price || 0);
  const discount = Number(appt.discount || 0);
  const now = new Date();
  const invNumber = number || `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(appt._id).slice(-6).toUpperCase()}`;
  const L = LABELS[safeLang];
  const data: InvoiceData = {
    number: invNumber,
    createdAt: now,
    centerName: st?.centerName || "Centre Aitigrine — مركز آيت تقرين",
    centerPhone: st?.phone || "",
    centerAddress: st?.address || "",
    logoBase64: st?.logoBase64 || "",
    clientName: client?.name || "",
    clientPhone: client?.phone || "",
    specialistName: spec?.name || "",
    serviceTitle: String(appt.serviceTitle || (appt.kind === "art_therapy" ? L.art : L.psych)),
    date: String(appt.date || ""),
    time: String(appt.time || ""),
    mode: String(appt.mode || "onsite"),
    price,
    discount,
    couponCode: String(appt.couponCode || ""),
    total: Math.max(0, price - discount),
    paymentStatus: String(appt.paymentStatus || "unpaid"),
  };

  const buf = await renderInvoicePdf(data, safeLang);
  const file = safeLang === "ar" ? `invoice-${invNumber}.pdf` : `invoice-${invNumber}-${safeLang}.pdf`;
  await putMedia(file, buf, "application/pdf");

  /* نربط الرقم والملف الافتراضي بالموعد (مرة واحدة) — ملفات اللغات مشتقة */
  if (!number) {
    await Appointment.findByIdAndUpdate(appointmentId, {
      invoiceNumber: invNumber,
      invoiceFile: file,
      invoiceAt: now,
    });
  }

  /* تجنب أي تراكم: مرجع للحاوية في مكان واحد */
  void mediaBucket;
  return { number: invNumber, file };
}

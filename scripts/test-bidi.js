/** اختبار دالة bidi البصرية للفاتورة العربية قبل الدمج — ينتج PDF + PNG للفحص */
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { ArabicShaper } = require("arabic-persian-reshaper");

/* ═══ دالة bidi البصرية — المرشحة للدمج في invoice.ts ═══ */
const LTR = /[A-Za-z0-9@#$%^&*+=_~`|'"<>\[\]{}.,:;%/\\\-+()№№°§¶†‡•…–—«»“”‘’]+/;
/** تحويل سطر منطقي عربي إلى سطر بصري صحيح يرسمه pdfkit (الذي يرسم LTR حرفاً حرفاً) */
function bidiVisual(line) {
  const shaped = ArabicShaper.convertArabic(line); // تشكيل سياقي جاهز
  const tokens = shaped.match(new RegExp(LTR.source + "|[^" + LTR.source.slice(1, -2) + "]+", "g")) || [shaped];
  return tokens
    .reverse()
    .map((t) => (new RegExp("^" + LTR.source + "$").test(t) ? t : [...t].reverse().join("")))
    .join("");
}

/* ═══ توليد PDF تجريبي بمقارنة: خام / bidi ═══ */
const doc = new PDFDocument({ size: "A4", margin: 50 });
const chunks = [];
doc.on("data", (c) => chunks.push(c));
doc.on("end", () => {
  fs.writeFileSync("/tmp/bidi-test.pdf", Buffer.concat(chunks));
  console.log("✓ /tmp/bidi-test.pdf written");
});
doc.registerFont("b", path.join(process.cwd(), "/public/fonts/DejaVuSans.ttf"));
doc.registerFont("bb", path.join(process.cwd(), "/public/fonts/DejaVuSans-Bold.ttf"));

const samples = [
  "فاتورة جلسة",
  "مركز آيت تقرين للعناية النفسية",
  "رقم الفاتورة: INV-202609-C7E773",
  "تاريخ الإصدار: 2026-09-24",
  "سعر الجلسة: 2 000 دج",
  "الصافي المستحق: 1 800 دج",
  "حضورية في المركز — الجزائر العاصمة، بيرخادم",
  "هذه الفاتورة صادرة إلكترونياً عن نظام مركز آيت تقرين وتُعتبر وثيقة رسمية.",
];
let y = 50;
doc.fontSize(9).fillColor("#999").text("1) RAW (معكوس — الخطأ الحالي):", 50, y, { align: "left" }); y += 14;
doc.font("bb").fontSize(16).fillColor("#111");
for (const s of samples.slice(0, 2)) { doc.text(s, 50, y, { align: "right", width: 495 }); y += 24; }
y += 10;
doc.font("b").fontSize(9).fillColor("#999").text("2) bidiVisual (المرشح):", 50, y, { align: "left" }); y += 14;
doc.font("bb").fontSize(16).fillColor("#0f766e");
for (const s of samples.slice(0, 2)) { doc.text(bidiVisual(s), 50, y, { align: "right", width: 495 }); y += 24; }
y += 14;
doc.font("b").fontSize(9).fillColor("#999").text("3) أسطر مختلطة أرقام/لاتيني عبر bidiVisual:", 50, y, { align: "left" }); y += 14;
doc.font("b").fontSize(12).fillColor("#111");
for (const s of samples.slice(2)) { doc.text(bidiVisual(s), 50, y, { align: "right", width: 495 }); y += 20; }
doc.end();

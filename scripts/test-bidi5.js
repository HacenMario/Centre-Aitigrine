const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

/** E: المسافات → NBSP فقط. بلا أي عكس — bidi الداخلي لـ fontkit يتكفل */
const E = (s) => s.replace(/ /g, "\u00A0");

const doc = new PDFDocument({ size: "A4", margin: 50 });
const chunks = [];
doc.on("data", (c) => chunks.push(c));
doc.on("end", () => { fs.writeFileSync("/tmp/bidi5.pdf", Buffer.concat(chunks)); console.log("✓"); });
doc.registerFont("b", path.join(process.cwd(), "/public/fonts/DejaVuSans.ttf"));
doc.registerFont("bb", path.join(process.cwd(), "/public/fonts/DejaVuSans-Bold.ttf"));

const samples = [
  "فاتورة جلسة",
  "مركز آيت تقرين للعناية النفسية، الأرطفونية والتكوين",
  "رقم الفاتورة: INV-202609-C7E773",
  "تاريخ الإصدار: 2026-09-24",
  "سعر الجلسة: 2 000 دج",
  "الصافي المستحق: 1 800 دج",
  "حالة الدفع: غير مدفوع",
  "حضورية في المركز — الجزائر العاصمة، بيرخادم",
  "هذه الفاتورة صادرة إلكترونياً عن نظام مركز آيت تقرين وتُعتبر وثيقة رسمية.",
  "شكراً لثقتكم — نتمنى لكم دوام الصحة والعافية",
];
let y = 40;
doc.font("bb").fontSize(9).fillColor("#999").text("E raw+NBSP (بلا عكس):", 50, y); y += 6;
doc.font("b").fontSize(13).fillColor("#111");
for (const s of samples) { y += 22; doc.text(E(s), 50, y, { align: "right", width: 495 }); }
y += 26;
doc.font("bb").fontSize(22).fillColor("#0f766e");
doc.text(E("فاتورة جلسة"), 50, y, { align: "right", width: 495 });
doc.end();

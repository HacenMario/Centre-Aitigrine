const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

/** عكس ترتيب الكلمات + NBSP لمنع انهيار المسافات في bidi الداخلي لـ fontkit */
function bidiNbsp(line) {
  return line.split(" ").reverse().join("\u00A0").replace(/(\u00A0)(?=\S)/g, "\u00A0");
}

const doc = new PDFDocument({ size: "A4", margin: 50 });
const chunks = [];
doc.on("data", (c) => chunks.push(c));
doc.on("end", () => { fs.writeFileSync("/tmp/bidi3.pdf", Buffer.concat(chunks)); console.log("✓ pdf"); });
doc.registerFont("b", path.join(process.cwd(), "/public/fonts/DejaVuSans.ttf"));
doc.registerFont("bb", path.join(process.cwd(), "/public/fonts/DejaVuSans-Bold.ttf"));

const samples = [
  "فاتورة جلسة",
  "مركز آيت تقرين للعناية النفسية، الأرطفونية والتكوين",
  "رقم الفاتورة: INV-202609-C7E773",
  "تاريخ الإصدار: 2026-09-24",
  "سعر الجلسة: 2 000 دج",
  "الصافي المستحق: 1 800 دج",
  "حضورية في المركز — الجزائر العاصمة، بيرخادم",
  "هذه الفاتورة صادرة إلكترونياً عن نظام مركز آيت تقرين وتُعتبر وثيقة رسمية.",
];
let y = 46;
doc.font("bb").fontSize(10).fillColor("#999").text("bidiNbsp:", 50, y); y += 6;
doc.font("b").fontSize(13).fillColor("#111");
for (const s of samples) { y += 22; doc.text(bidiNbsp(s), 50, y, { align: "right", width: 495 }); }
y += 30;
doc.font("bb").fontSize(20).fillColor("#0f766e");
doc.text(bidiNbsp("فاتورة جلسة"), 50, y, { align: "right", width: 495 });
doc.end();

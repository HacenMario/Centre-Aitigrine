/** اختبار bidi v2: عكس ترتيب الكلمات فقط — fontkit يشكّل كل كلمة تلقائياً */
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const LTR_RUN = /^[A-Za-z0-9@#$_~.,:;%/\\+\-()«»"“”°№]+$/;

/** عكس ترتيب الكلمات لسطر عربي (bidi بصرية مبسطة: fontkit يشكّل ويقلب الأحرف داخل الـ run) */
function bidiWords(line) {
  const tokens = line.split(/(\s+)/); // نحافظ على المسافات
  return tokens.slice().reverse().join("");
}

/** نسخة أدق: تعكس الكلمات العربية فقط وتعزل الـ LTR runs بترتيبها */
function bidiSmart(line) {
  // مقسمة إلى runs: لاتيني/أرقام متتالية = run LTR، البقية = run RTL
  const parts = line.match(/[A-Za-z0-9@#$_~.,:;%/\\+\-()]+|[^A-Za-z0-9@#$_~.,:;%/\\+\-()]+/g) || [];
  return parts
    .reverse()
    .map((p) =>
      /^[A-Za-z0-9@#$_~.,:;%/\\+\-()]+$/.test(p)
        ? p // run لاتيني/أرقام: بترتيبه الطبيعي
        : p.split(/(\s+)/).reverse().join("") // run عربي: عكس ترتيب كلماته فقط
    )
    .join("");
}

const doc = new PDFDocument({ size: "A4", margin: 50 });
const chunks = [];
doc.on("data", (c) => chunks.push(c));
doc.on("end", () => {
  fs.writeFileSync("/tmp/bidi2.pdf", Buffer.concat(chunks));
  console.log("✓ /tmp/bidi2.pdf");
});
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
doc.font("bb").fontSize(11).fillColor("#999").text("bidiWords (عكس كلمات):", 50, y, { align: "left" }); y += 6;
doc.font("b").fontSize(13).fillColor("#111");
for (const s of samples) { y += 22; doc.text(bidiWords(s), 50, y, { align: "right", width: 495 }); }

y += 34;
doc.font("bb").fontSize(11).fillColor("#999").text("bidiSmart (عزل LTR + عكس كلمات):", 50, y); y += 6;
doc.font("b").fontSize(13).fillColor("#0f766e");
for (const s of samples) { y += 22; doc.text(bidiSmart(s), 50, y, { align: "right", width: 495 }); }

y += 34;
doc.font("bb").fontSize(11).fillColor("#999").text("عناوين كبيرة (bidiSmart):", 50, y); y += 6;
doc.font("bb").fontSize(18).fillColor("#0f766e");
doc.text(bidiSmart("فاتورة جلسة"), 50, y + 24, { align: "right", width: 495 });

doc.end();

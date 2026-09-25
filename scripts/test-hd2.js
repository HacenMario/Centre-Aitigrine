const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
function arLine(s){return s.replace(/(?<=[\u0600-\u06FF\u0640])\u0020+(?=[\u0600-\u06FF\u0640])/g,"\u00A0");}
const T = (s)=>arLine(String(s??""));
const doc = new PDFDocument({ size: "A4", margin: 50 });
const chunks = [];
doc.on("data", c => chunks.push(c));
doc.on("end", () => { fs.writeFileSync("/tmp/hd2.pdf", Buffer.concat(chunks)); console.log("✓"); });
doc.registerFont("b", path.join(process.cwd(), "/public/fonts/DejaVuSans.ttf"));
doc.registerFont("bb", path.join(process.cwd(), "/public/fonts/DejaVuSans-Bold.ttf"));
/* محاكاة تسلسل الفاتورة: نصوص قبل الجدول */
doc.font("b").fontSize(11);
doc.text(T("العميل"), 50, 150, { align: "right", width: 495 });
doc.text(T("Client Test"), 50, 150, { align: "left", width: 495 });
doc.text(T("هاتف العميل"), 50, 172, { align: "right", width: 495 });
doc.text(T("0555777666"), 50, 172, { align: "left", width: 495 });
/* الرأس */
let y = 230;
doc.rect(50, y, 495, 26).fill("#0f766e");
doc.font("bb").fontSize(11).fillColor("#ffffff");
doc.text(T("البيان"), 60, y + 7, { align: "right", width: 300 });
doc.text(T("المبلغ"), 365, y + 7, { align: "left", width: 170 });
y += 26;
/* صفوف */
const row=(label, value, bold=false)=>{
  doc.rect(50, y, 495, 24).fill(bold ? "#e6f5f3" : "#ffffff");
  doc.strokeColor("#e5e7eb").lineWidth(0.5).rect(50, y, 495, 24).stroke();
  doc.font(bold?"bb":"b").fontSize(11).fillColor("#111827");
  doc.text(T(label), 60, y + 6, { align: "right", width: 300 });
  doc.text(T(value), 365, y + 6, { align: "left", width: 170 });
  y += 24;
};
row("سعر الجلسة", "2 000 دج");
row("الصافي المستحق", "2 000 دج", true);
row("حالة الدفع", "غير مدفوع");
doc.end();

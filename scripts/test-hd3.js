const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
function arLine(s){return s.replace(/(?<=[\u0600-\u06FF\u0640])\u0020+(?=[\u0600-\u06FF\u0640])/g,"\u00A0");}
const T = (s)=>arLine(String(s??""));
const doc = new PDFDocument({ size: "A4", margin: 50 });
const chunks = [];
doc.on("data", c => chunks.push(c));
doc.on("end", () => { fs.writeFileSync("/tmp/hd3.pdf", Buffer.concat(chunks)); console.log("✓"); });
doc.registerFont("bb", path.join(process.cwd(), "/public/fonts/DejaVuSans-Bold.ttf"));
doc.font("bb").fontSize(11).fillColor("#ffffff");
/* ترتيب معكوس: المبلغ أولاً */
doc.rect(50, 40, 495, 26).fill("#0f766e");
doc.text(T("المبلغ"), 365, 47, { align: "left", width: 170 });
doc.text(T("البيان"), 60, 47, { align: "right", width: 300 });
/* محاولة 2: قسمان بصناديق مستقلة + right لكليهما */
doc.rect(50, 90, 495, 26).fill("#0f766e");
doc.text(T("المبلغ"), 335, 97, { align: "right", width: 200 });
doc.text(T("البيان"), 60, 97, { align: "right", width: 270 });
doc.end();

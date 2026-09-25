const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const S = "فاتورة جلسة — مركز آيت تقرين 2026";

const A = (s) => s; // raw
const B = (s) => s.split(/(\s+)/).reverse().join(""); // عكس كلمات+مسافات
const C = (s) => s.split(" ").reverse().join(" "); // عكس كلمات فقط
const D = (s) => s.split(/(\s+)/).reverse().join("").replace(/ /g, "\u00A0"); // عكس ثم NBSP

const doc = new PDFDocument({ size: "A4", margin: 50 });
const chunks = [];
doc.on("data", (c) => chunks.push(c));
doc.on("end", () => { fs.writeFileSync("/tmp/bidi4.pdf", Buffer.concat(chunks)); console.log("✓ pdf"); });
doc.registerFont("b", path.join(process.cwd(), "/public/fonts/DejaVuSans.ttf"));
doc.registerFont("bb", path.join(process.cwd(), "/public/fonts/DejaVuSans-Bold.ttf"));

const tests = [["A raw", A], ["B rev-ws", B], ["C rev-words", C], ["D rev+NBSP", D]];
let y = 40;
for (const [name, fn] of tests) {
  doc.font("bb").fontSize(10).fillColor("#999");
  doc.text(`${name} — INPUT: ${S}`, 50, y, { width: 495 });
  y += 16;
  doc.font("b").fontSize(15).fillColor("#0f766e");
  doc.text(fn(S), 50, y, { align: "right", width: 495 });
  y += 40;
}
doc.end();

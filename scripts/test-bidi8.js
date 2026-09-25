const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
function E(s){return s.replace(/ /g,"\u00A0");}
function F(s){
  const runs=s.match(/[A-Za-z0-9]+(?:[.,:@_/\-+()№°%][A-Za-z0-9]+)*|[^A-Za-z0-9]+/g)||[];
  return runs.map(r=>/^[A-Za-z0-9]/.test(r)?"\u202A"+r+"\u202C":r).join("").replace(/ /g,"\u00A0");
}
const doc = new PDFDocument({ size: "A4", margin: 50 });
const chunks = [];
doc.on("data", c => chunks.push(c));
doc.on("end", () => { fs.writeFileSync("/tmp/bidi8.pdf", Buffer.concat(chunks)); console.log("✓"); });
doc.registerFont("b", path.join(process.cwd(), "/public/fonts/DejaVuSans.ttf"));
const S = "رقم الفاتورة: INV-202609-C7E773";
doc.font("b").fontSize(22).fillColor("#111");
doc.text("A raw:", 50, 40, { width: 495 }); doc.text(S, 50, 70, { align: "right", width: 495 });
doc.text("E nbsp:", 50, 130, { width: 495 }); doc.text(E(S), 50, 160, { align: "right", width: 495 });
doc.text("F nbsp+isolate:", 50, 220, { width: 495 }); doc.text(F(S), 50, 250, { align: "right", width: 495 });
doc.end();

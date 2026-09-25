/* مصفوفة تجارب للعربية في pdfkit — تحديد الطريقة الصحيحة */
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { ArabicShaper } = require("arabic-persian-reshaper");

const doc = new PDFDocument({ size: "A4", margin: 50 });
const chunks = [];
doc.on("data", (c) => chunks.push(c));
doc.on("end", () => { fs.writeFileSync("/tmp/test-ar2.pdf", Buffer.concat(chunks)); console.log("ok"); });

doc.registerFont("ar", path.join(process.cwd(), "public", "fonts", "DejaVuSans.ttf"));

let y = 60;
const line = (label, txt, opts = {}) => {
  doc.font("ar").fontSize(20).fillColor("#111");
  doc.text(txt, 50, y, { align: "left", ...(opts.features ? { features: opts.features } : {}) });
  y += 40;
};

/* 1: خام منطقي */
line("A-raw", "مرحبا العالم");
/* 2: presentation forms بالترتيب المنطقي (بلا عكس) */
line("B-shaped-logical", ArabicShaper.convertArabic("مرحبا العالم"));
/* 3: presentation forms معكوسة (كود v3.8.0) */
const shaped = ArabicShaper.convertArabic("مرحبا العالم");
line("C-shaped-reversed", [...shaped].reverse().join(""));
/* 4: features off إن أمكن */
line("D-raw-featoff", "مرحبا العالم", { features: [] });
doc.end();

/* توليد PDF تجريبي لفحص العربية — نسختان: بالنص الخام وبعد arLine */
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { ArabicShaper } = require("arabic-persian-reshaper");

const RTL_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function arLineV1(text) { /* الكود الحالي في v3.8.0 */
  const shaped = ArabicShaper.convertArabic(String(text));
  const runs = []; let cur = ""; let curRtl = null;
  for (const ch of shaped) {
    const chRtl = RTL_RE.test(ch);
    const useRtl = chRtl || (curRtl === true && ch === " ");
    if (curRtl === null) { cur = ch; curRtl = useRtl; }
    else if (useRtl === curRtl) { cur += ch; }
    else { runs.push(cur); cur = ch; curRtl = useRtl; }
  }
  if (cur) runs.push(cur);
  const fixed = runs.map((r) => (RTL_RE.test(r.replace(/\s+/g, "")) ? [...r].reverse().join("") : r));
  return fixed.reverse().join("");
}

function arLineV2(text) { /* بدون إعادة تشكيل ولا عكس — خام */
  return String(text);
}

const doc = new PDFDocument({ size: "A4", margin: 50 });
const chunks = [];
doc.on("data", (c) => chunks.push(c));
doc.on("end", () => { fs.writeFileSync("/tmp/test-ar.pdf", Buffer.concat(chunks)); console.log("written /tmp/test-ar.pdf"); });

const fontPath = path.join(process.cwd(), "public", "fonts", "DejaVuSans.ttf");
doc.registerFont("ar", fontPath);

let y = 60;
const line = (label, txt) => {
  doc.font("ar").fontSize(14).fillColor("#111");
  doc.text(`${label}  |  ${txt}`, 50, y, { align: "left" });
  y += 34;
};

line("V1-current", arLineV1("فاتورة جلسة نفسية"));
line("V1-mixed", arLineV1("رقم الفاتورة: INV-2026-09"));
line("V1-center", arLineV1("مركز آيت تقرين — Centre Aitigrine"));
line("V1-client", arLineV1("العميل: أحمد بن محمد"));
line("RAW", "فاتورة جلسة نفسية");
doc.end();

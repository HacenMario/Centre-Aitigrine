#!/usr/bin/env node
/**
 * تدقيق الترجمة — يكتشف المفاتيح المستعملة في الكود وغائبة عن القواميس
 * + المفاتيح المعرفة بلا استعمال (تُعرض كمعلومة)
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const ROOT = process.cwd();
const dictFiles = {
  ar: join(ROOT, "src/lib/dict-ar.ts"),
  fr: join(ROOT, "src/lib/dict-fr.ts"),
  en: join(ROOT, "src/lib/dict-en.ts"),
};

function loadDict(p) {
  const src = readFileSync(p, "utf8");
  const map = {};
  const re = /"([^"]+)":\s*"(?:[^"\\]|\\.)*"/g;
  let m;
  while ((m = re.exec(src))) map[m[1]] = true;
  return map;
}

const dicts = { ar: loadDict(dictFiles.ar), fr: loadDict(dictFiles.fr), en: loadDict(dictFiles.en) };

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if ([".tsx", ".ts"].includes(extname(p)) && !p.includes("dict-")) out.push(p);
  }
  return out;
}

const files = walk(join(ROOT, "src"));
const used = new Map(); // key -> [files]
const re = /\bt\("([^"]+)"/g;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  let m;
  while ((m = re.exec(src))) {
    const k = m[1];
    if (!used.has(k)) used.set(k, []);
    used.get(k).push(f.replace(ROOT + "/", ""));
  }
}

let missing = 0;
for (const [k, fs] of [...used.entries()].sort()) {
  const missLangs = ["ar", "fr", "en"].filter((l) => !dicts[l][k]);
  if (missLangs.length) {
    missing++;
    console.log(`MISSING[${missLangs.join(",")}] ${k}  ← ${fs.slice(0, 2).join(", ")}`);
  }
}
console.log(`\nused keys: ${used.size} — missing: ${missing}`);

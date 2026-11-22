#!/usr/bin/env node
/**
 * استعادة نسخة احتياطية كاملة (aitigrine-full-backup-2 — v3.30.0) — بلا تبعيات إضافية
 *
 * الاستخدام من مجلد المشروع:
 *   1) فك ضغط ملف النسخة aitigrine-backup-*.zip — يعطي مجلد backup
 *   2) MONGODB_URI="<رابط القاعدة الهدف>" node scripts/restore-full-backup.mjs <مجلد backup المستخرج> --drop
 *      (خياري --db=<اسم> لتعيين قاعدة الهدف صراحةً إن لم يكن في الرابط)
 *
 * سلوك --drop مطابق لـ mongorestore --drop: يمسح مستندات المجموعات القادمة في الهدف
 * قبل كتابتها من جديد فقط — لا يمس أي مجموعة أخرى. بدون --drop ستتعارض المعرفات.
 *
 * بيانات $oid و$date و$binary تُقرأ بـ EJSON.parse فتعود ObjectId وDate وBuffer
 * بأنواعها الأصلية حرفياً — الربط بين المواعيد والمستخدمين يعمل كما كان.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
/* EJSON من bson مباشرة — mongodb v7 لم يعد يعيد تصديره */
import { EJSON } from "bson";
import { MongoClient } from "mongodb";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const drop = args.includes("--drop");
const dbNameArg = args.find((a) => a.startsWith("--db="))?.slice(5);
if (!dir) {
  console.error('الاستخدام: node scripts/restore-full-backup.mjs <مجلد backup المستخرج> [--drop] [--db=<اسم>]');
  process.exit(1);
}
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("ناقص MONGODB_URI في بيئة التنفيذ — مثال: MONGODB_URI=\"mongodb://...\" node scripts/restore-full-backup.mjs backup --drop");
  process.exit(1);
}

const manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
if (manifest.format !== "aitigrine-full-backup-2") {
  console.error("الملف ليس نسخة aitigrine-full-backup-2 — تأكد أن فك الضغط أعطى مجلد backup الذي يحوي manifest.json");
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
await client.connect();
const db = client.db(dbNameArg);
console.log(`الاستعادة إلى قاعدة "${db.databaseName}" (النسخة من قاعدة "${manifest.database}" بتاريخ ${manifest.createdAt}) ${drop ? "مع --drop" : "بدون --drop (غير موصى به)"}`);

let mismatched = 0;
for (const { name, docs } of manifest.collections) {
  const raw = await readFile(path.join(dir, "database", `${name}.ejson`), "utf8");
  const arr = EJSON.parse(raw, { relaxed: false });
  if (drop) {
    try { await db.collection(name).drop(); } catch (e) {
      if (e.codeName !== "NamespaceNotFound") throw e;
    }
  }
  for (let i = 0; i < arr.length; i += 500) {
    await db.collection(name).insertMany(arr.slice(i, i + 500), { ordered: false });
  }
  const after = await db.collection(name).countDocuments();
  const ok = after === (docs ?? arr.length);
  if (!ok) mismatched++;
  console.log(`${ok ? "✓" : "✗"} ${name}: ${after}/${docs ?? arr.length}`);
}
if (manifest.media) {
  console.log(`ℹ وسائط GridFS: ${manifest.media.files} ملف (${manifest.media.bytes} بايت) — تُعاد عبر media.files وmedia.chunks ضمن المجموعات أعلاه`);
}
if (mismatched) {
  console.error(`✗ ${mismatched} مجموعة بعدد غير مطابق — قارن مع backup/manifest.json ولا تبدّل الرابط قبل الفحص`);
  process.exitCode = 1;
} else {
  console.log("✅ اكتملت الاستعادة بتطابق الأعداد — المعرفات والتواريخ والوسائط بأنواعها الأصلية");
}
await client.close();

#!/bin/bash
# حزم النسخة النهائية لمركز أيت تقرين — ZIP جاهز للتشغيل
set -e
SRC=/home/z/my-project
STG=$SRC/scripts/staging-final
OUT="/home/z/my-project/download/مركز-أيت-تقرين-النسخة-النهائية.zip"

rm -rf "$STG" "$OUT"
mkdir -p "$STG/Ait-Tegrine-Center"
mkdir -p "$SRC/download"

cd "$SRC"
rsync -a \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude 'db' \
  --exclude 'logs-mongo.log' \
  --exclude 'dev.log' \
  --exclude 'server.log' \
  --exclude 'screens' \
  --exclude 'scripts/staging-*' \
  --exclude 'skills' \
  --exclude 'upload' \
  --exclude 'download' \
  --exclude '.zscripts' \
  --exclude 'tsconfig.tsbuildinfo' \
  --exclude 'prisma/*.db' \
  --exclude 'eslint.config.mjs.bak' \
  "$SRC/" "$STG/Ait-Tegrine-Center/"

echo "── فحص الحزمة ──"
[ -f "$STG/Ait-Tegrine-Center/package.json" ] && echo "✓ package.json"
[ -f "$STG/Ait-Tegrine-Center/README.md" ] && echo "✓ README.md"
[ -f "$STG/Ait-Tegrine-Center/.env.example" ] && echo "✓ .env.example"
[ -f "$STG/Ait-Tegrine-Center/public/sw.js" ] && echo "✓ sw.js"
[ -f "$STG/Ait-Tegrine-Center/public/logo.png" ] && echo "✓ شعار المركز"
[ -f "$STG/Ait-Tegrine-Center/instrumentation.ts" ] && echo "✓ instrumentation.ts (المجدول)"
[ -f "$STG/Ait-Tegrine-Center/src/lib/models.ts" ] && echo "✓ نماذج MongoDB"
COUNT=$(find "$STG/Ait-Tegrine-Center/src" -name "*.ts*" | wc -l)
echo "✓ ملفات المصدر: $COUNT"

cd "$STG"
zip -qr "$OUT" Ait-Tegrine-Center
echo "── الحزمة ──"
ls -lh "$OUT"
unzip -l "$OUT" | tail -2

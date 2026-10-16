#!/bin/bash
# حزم v3.20.1 — نفس سياسة الاستبعادات المعتمدة (مطابقة حزمة v3.20.0 + سكربت اختبار 321)
set -e
cd /home/z/my-project
OUT="/home/z/my-project/download/Aitigrine-Center-v3.20.1.zip"
rm -f "$OUT"
zip -r -q "$OUT" . \
  -x "node_modules/*" -x ".next/*" -x ".env" -x "*.log" -x "uploads/*" -x "data/*" \
  -x ".git/*" -x ".zscripts/*" -x "download/*" -x "upload/*" -x "skills/*" \
  -x "mini-services/*" -x "tests/*" -x "examples/*" -x "refs/*" -x "screens/*" -x "tool-results/*" \
  -x "scripts/package-v321.sh" -x "server.log" -x "dev.log" -x "bun.lock" -x "worklog.md"
echo "Packaged: $OUT"
unzip -l "$OUT" | tail -2

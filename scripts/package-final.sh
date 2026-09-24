#!/bin/bash
set -e
cd /home/z/my-project/scripts/work-v3.8
OUT="/home/z/my-project/download/Aitigrine-Center-v3.8.1.zip"
rm -f "$OUT"
cd Centre-Aitigrine-main
zip -r -q "$OUT" . \
  -x "node_modules/*" -x ".next/*" -x ".env" -x "*.log" -x "uploads/*" -x "data/*" \
  -x ".git/*" -x "mini-services/*" -x "tests/*" -x "examples/*" \
  -x "scripts/test-bidi*.js" -x "scripts/test-hd*.js" -x "scripts/test-arabic*.js"
echo "Packaged: $OUT"
unzip -l "$OUT" | tail -2

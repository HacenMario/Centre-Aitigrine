#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# v3.20.1 — اختبارات النسخة الاحتياطية المعاد بناؤها (مرحلتان GridFS + أجزاء)
# الدورة: بناء → أجزاء → لحم → فحص ZIP → صلاحيات → حدود → نظافة تلقائية
# ═══════════════════════════════════════════════════════════════════
set -u
BASE="http://127.0.0.1:3000"
PASS=0; FAIL=0
H_JSON='Content-Type: application/json'
T=/tmp/v321-body.json

code(){ curl -s -o "$T" -w "%{http_code}" "$@"; }
jqget(){ cat "$T" | python3 -c "import sys,json;d=json.load(sys.stdin);print(eval('d'+sys.argv[1]))" "$2" 2>/dev/null; }
ok(){ PASS=$((PASS+1)); echo "✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "✗ $1  ← $(head -c 150 "$T")"; }
expect(){ local label="$1" want="$2" got="$3"; if [ "$got" = "$want" ]; then ok "$label"; else bad "$label (توقعت $want صار $got)"; fi; }

echo "── 1) الصحة والدخول ──"
expect "health (200)" 200 "$(code $BASE/api/health)"
code -X POST $BASE/api/auth/admin-login -H "$H_JSON" -d '{"phone":"0550000001","password":"Pass1234!"}' >/dev/null
AT=$(jqget x "['token']")
expect "دخول الإدارة (توكن)" "116" "${#AT}"
AH="x-auth-token: $AT"

code -X POST $BASE/api/auth/login -H "$H_JSON" -d '{"phone":"0555123456","password":"client123"}' >/dev/null 2>&1
code -X POST $BASE/api/auth/register -H "$H_JSON" -d '{"name":"عميلة تجربة نسخ","phone":"0566778899","password":"client123","bloodType":"O+","recoveryPhrase":"استرجاع321"}' >/dev/null 2>&1
code -X POST $BASE/api/auth/login -H "$H_JSON" -d '{"phone":"0566778899","password":"client123"}'
CT=$(jqget x "['token']")
[ -n "$CT" ] && ok "عميل تجريبي جاهز" || bad "عميل تجريبي جاهز"
CH="x-auth-token: $CT"

echo "── 2) الصلاحيات ──"
expect "بناء بلا توكن (401)" 401 "$(code -X POST $BASE/api/backup)"
expect "بناء بعميل (403)" 403 "$(code -X POST $BASE/api/backup -H "$CH")"
expect "جزء بعميل (403)" 403 "$(code "$BASE/api/backup?file=000000000000000000000000&part=1" -H "$CH")"

echo "── 3) وسائط تجريبية داخل GridFS قبل البناء ──"
node - <<'EOF'
const { MongoClient, GridFSBucket } = require("mongodb");
(async () => {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
  const c = new MongoClient(uri);
  await c.connect();
  /* اسم القاعدة من URI — بيئة المعاينة تحمل ait_center */
  const dbName = (uri.match(/\/([a-zA-Z0-9_-]+)(\?|$)/) || [])[1] || "ait_center";
  const b = new GridFSBucket(c.db(dbName), { bucketName: "media" });
  const old = await b.find({ filename: "test-backup-media.png" }).toArray();
  for (const f of old) { try { await b.delete(f._id); } catch {} }
  await new Promise((res, rej) => {
    const up = b.openUploadStream("test-backup-media.png", { contentType: "image/png" });
    up.on("finish", res); up.on("error", rej);
    up.end(Buffer.from("PNG-backup-test-payload-aitigrine-321"));
  });
  await c.close();
  console.log("media seeded");
})();
EOF
[ $? -eq 0 ] && ok "زرع وسائط اختبار" || bad "زرع وسائط اختبار"

echo "── 4) البناء (المرحلة 1) ──"
expect "POST /api/backup (200)" 200 "$(code -X POST $BASE/api/backup -H "$AH")"
FID=$(jqget x "['fileId']")
BNAME=$(jqget x "['name']")
BSIZE=$(jqget x "['size']")
PARTS=$(jqget x "['parts']")
[ -n "$FID" ] && ok "fileId عاد: $FID" || bad "fileId عاد"
[ -n "$BNAME" ] && ok "اسم الملف: $BNAME" || bad "اسم الملف"
[ "$PARTS" -ge 1 ] 2>/dev/null && ok "عدد الأجزاء: $PARTS (الحجم $BSIZE)" || bad "عدد الأجزاء: $PARTS"

echo "── 5) حدود الجلب ──"
expect "جزء بلا معرف (400)" 400 "$(code "$BASE/api/backup" -H "$AH")"
expect "معرف مشوه (400)" 400 "$(code "$BASE/api/backup?file=xyz&part=1" -H "$AH")"
expect "معرف غير موجود (404)" 404 "$(code "$BASE/api/backup?file=000000000000000000000000&part=1" -H "$AH")"
expect "جزء خارج النطاق (400)" 400 "$(code "$BASE/api/backup?file=$FID&part=999" -H "$AH")"
expect "جزء صفر (400)" 400 "$(code "$BASE/api/backup?file=$FID&part=0" -H "$AH")"

echo "── 6) لحم الأجزاء (المرحلة 2) ──"
rm -rf /tmp/v321-parts && mkdir -p /tmp/v321-parts
ALL_OK=1
for p in $(seq 1 "$PARTS"); do
  c=$(code "$BASE/api/backup?file=$FID&part=$p" -H "$AH")
  if [ "$c" != "200" ]; then ALL_OK=0; bad "جزء $p (صار $c)"; break; fi
  jqget x "['data']" | base64 -d > /tmp/v321-parts/part-$p.bin 2>/dev/null
done
if [ "$ALL_OK" = "1" ]; then ok "كل الأجزاء 200"; fi
cat /tmp/v321-parts/part-*.bin > /tmp/v321-backup.zip
GOT=$(stat -c%s /tmp/v321-backup.zip 2>/dev/null || echo 0)
if [ "$GOT" = "$BSIZE" ]; then ok "الحجم الملحم = المعلن ($GOT بايت)"; else bad "الحجم الملحم $GOT ≠ المعلن $BSIZE"; fi
SIG=$(head -c 2 /tmp/v321-backup.zip)
[ "$SIG" = "PK" ] && ok "بصمة ZIP صحيحة (PK)" || bad "بصمة ZIP: $SIG"

echo "── 7) فحص محتوى النسخة ──"
unzip -t /tmp/v321-backup.zip > /tmp/v321-unzip.txt 2>&1
if rg -q "No errors detected" /tmp/v321-unzip.txt; then ok "سلامة الأرشيف (unzip -t)"; else bad "سلامة الأرشيف ← $(tail -2 /tmp/v321-unzip.txt | head -1)"; fi
unzip -l /tmp/v321-backup.zip | rg -q "backup/database/settings.json" && ok "قاعدة البيانات: settings.json" || bad "settings.json"
unzip -l /tmp/v321-backup.zip | rg -q "backup/database/users.json" && ok "قاعدة البيانات: users.json" || bad "accounts.json"
unzip -l /tmp/v321-backup.zip | rg -q "backup/README.txt" && ok "تقرير النسخة موجود" || bad "تقرير النسخة"
unzip -l /tmp/v321-backup.zip | rg -q "backup/media/test-backup-media.png" && ok "وسائط GridFS داخل النسخة" || bad "وسائط GridFS"
unzip -l /tmp/v321-backup.zip | rg -q "backup/media/index.json" && ok "فهرس الوسائط" || bad "فهرس الوسائط"
unzip -p /tmp/v321-backup.zip backup/README.txt | rg -q "3.20.1" && ok "تقرير يحمل الإصدار 3.20.1" || bad "إصدار التقرير"
# مصفوفة JSON صالحة لمجموعة على الأقل
unzip -p /tmp/v321-backup.zip backup/database/settings.json | python3 -c "import sys,json;json.load(sys.stdin)" 2>/dev/null && ok "settings.json مصفوفة JSON صالحة" || bad "settings.json صالحة"
# لا تدخل نسخ backups نفسها في النسخة
unzip -l /tmp/v321-backup.zip | rg -q "backups\." && bad "نسخ backups تسربت للمدخلات" || ok "حاوية backups مستثناة"

echo "── 8) سجل التدقيق ──"
code "$BASE/api/audit?limit=50" -H "$AH" >/dev/null 2>&1
if cat "$T" | rg -q "backup.create"; then ok "audit: backup.create مسجل"; else bad "audit: backup.create"; fi

echo "── 9) النظافة التلقائية (آخر نسختين فقط) ──"
code -X POST $BASE/api/backup -H "$AH" >/dev/null; FID2=$(jqget x "['fileId']")
code -X POST $BASE/api/backup -H "$AH" >/dev/null; FID3=$(jqget x "['fileId']")
expect "الأقدم حُذف تلقائياً (404)" 404 "$(code "$BASE/api/backup?file=$FID&part=1" -H "$AH")"
c2=$(code "$BASE/api/backup?file=$FID2&part=1" -H "$AH")
c3=$(code "$BASE/api/backup?file=$FID3&part=1" -H "$AH")
[ "$c2" = "200" ] && [ "$c3" = "200" ] && ok "آخر نسختين حيّتان (200)" || bad "آخر نسختين ($c2/$c3)"

echo "── 10) انحدار سريع ──"
expect "health (200)" 200 "$(code $BASE/api/health)"
expect "دخول الإدارة مجدداً (200)" 200 "$(code -X POST $BASE/api/auth/admin-login -H "$H_JSON" -d '{"phone":"0550000001","password":"Pass1234!"}')"
expect "قائمة الزوار (200)" 200 "$(code $BASE/api/specialists)"
expect "كتب الزوار (200)" 200 "$(code $BASE/api/ebooks)"

echo "══════════════════════════════"
echo "النتيجة: نجح $PASS — فشل $FAIL"
[ "$FAIL" = "0" ] && echo "ALL TESTS PASSED ✓" || echo "SOME TESTS FAILED ✗"
exit $FAIL

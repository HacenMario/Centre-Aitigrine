#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# scripts/test-v3210.sh — اختبارات v3.21.0
# النشر على انستغرام/فايسبوك: صورة المشاركة الخادمية + معاينة OG
# + عناصر اختبار كاملة (مقال/كتاب/تكوين/إعلان) ثم تنظيفها
# ═══════════════════════════════════════════════════════════════
set -u
BASE="http://localhost:3000"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (متوقع=$2 فعلي=$3)"; fi; }
has()  { if echo "$2" | grep -q "$3"; then ok "$1"; else bad "$1 — لا يحتوي: $3"; fi; }
lacks(){ if echo "$2" | grep -q "$3"; then bad "$1 — يجب ألا يحتوي: $3"; else ok "$1"; fi; }

IMG="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q=="
J() { python3 -c "import json,sys;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1"; }

echo "── 1) المصادقة ──"
TOKEN=$(curl -s -X POST "$BASE/api/auth/admin-login" -H 'Content-Type: application/json' \
  -d '{"phone":"0550000001","password":"Pass1234!"}' | J 'd.get("token","")')
check "دخول الإدارة" "yes" "$([ -n "$TOKEN" ] && echo yes || echo no)"
AH="x-auth-token: $TOKEN"

echo "── 2) إنشاء عناصر اختبار بغلاف ──"
ART=$(curl -s -X POST "$BASE/api/articles" -H "$AH" -H 'Content-Type: application/json' \
  -d "{\"title\":\"مقال اختبار المشاركة 321\",\"summary\":\"نبذة اختبار المشاركة الاجتماعية\",\"content\":\"متن اختباري للمقال\",\"category\":\"general\",\"coverBase64\":\"$IMG\",\"active\":true}" \
  | J 'str(d.get("article",{}).get("_id",""))')
check "إنشاء مقال" "24" "${#ART}"

EB=$(curl -s -X POST "$BASE/api/ebooks" -H "$AH" -H 'Content-Type: application/json' \
  -d "{\"title\":\"كتاب اختبار المشاركة 321\",\"summary\":\"نبذة كتاب اختبارية\",\"author\":\"فريق الاختبار\",\"coverBase64\":\"$IMG\",\"price\":0,\"active\":true}" \
  | J 'str(d.get("ebook",{}).get("_id",""))')
check "إنشاء كتاب" "24" "${#EB}"

CRS=$(curl -s -X POST "$BASE/api/courses" -H "$AH" -H 'Content-Type: application/json' \
  -d "{\"title\":\"تكوين اختبار المشاركة 321\",\"description\":\"وصف اختباري للتكوين\",\"price\":0,\"capacity\":0,\"coverBase64\":\"$IMG\",\"sessions\":[],\"active\":true}" \
  | J 'str(d.get("course",{}).get("_id",""))')
check "إنشاء تكوين" "24" "${#CRS}"

AD=$(curl -s -X POST "$BASE/api/ads" -H "$AH" -H 'Content-Type: application/json' \
  -d "{\"action\":\"create\",\"title\":\"إعلان اختبار المشاركة 321\",\"body\":\"نص إعلان اختباري للمشاركة\",\"media\":[\"$IMG\"],\"publish\":true}" \
  | J 'str(d.get("ad",{}).get("_id","") or d.get("id","") or d.get("_id",""))')
check "إنشاء+نشر إعلان" "24" "${#AD}"

echo "── 3) /api/share-image — صورة كل نوع ──"
for pair in "articles:$ART" "ebooks:$EB" "courses:$CRS" "ads:$AD"; do
  v="${pair%%:*}"; id="${pair##*:}"
  hdr=$(curl -s -o /dev/null -D - -w "" "$BASE/api/share-image?view=$v&id=$id" --max-time 15 | tr -d '\r')
  ct=$(echo "$hdr" | grep -i "^content-type:" | cut -d' ' -f2)
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/share-image?view=$v&id=$id" --max-time 15)
  check "share-image $v → 200" "200" "$code"
  has "share-image $v → image/*" "$ct" "image/"
done

echo "── 4) share-image الحالات الهامشية ──"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/share-image?view=articles&id=zzzz" --max-time 10)
check "معرف غير صالح → 302 للشعار" "302" "$code"
loc=$(curl -s -o /dev/null -D - -w "" "$BASE/api/share-image?view=articles&id=zzzz" --max-time 10 | grep -i "^location:" | tr -d '\r')
has "التحويل إلى /logo.png" "$loc" "/logo.png"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/share-image?view=nonsense&id=$ART" --max-time 10)
check "view غير معروف → 302" "302" "$code"
FAKE="aaaaaaaaaaaaaaaaaaaaaaaa"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/share-image?view=articles&id=$FAKE" --max-time 10)
check "معرف صالح غير موجود → 302" "302" "$code"

echo "── 5) معاينة OG في HTML الروابط المباشرة ──"
for pair in "articles:$ART:مقال اختبار المشاركة" "ebooks:$EB:كتاب اختبار المشاركة" "courses:$CRS:تكوين اختبار المشاركة" "ads:$AD:إعلان اختبار المشاركة"; do
  v=$(echo "$pair" | cut -d: -f1); id=$(echo "$pair" | cut -d: -f2); ttl=$(echo "$pair" | cut -d: -f3)
  html=$(curl -s "$BASE/?view=$v&id=$id" --max-time 20)
  has "og:title يعرض العنوان ($v)" "$html" "og:title"
  has "عنوان العنصر في الميتا ($v)" "$html" "$ttl"
  has "og:image يشير لـ share-image ($v)" "$html" "api/share-image?view=$v"
done

echo "── 6) الواجهة الافتراضية بلا معاينة ──"
html=$(curl -s "$BASE/" --max-time 15)
lacks "بلا og:title في الرئيسية" "$html" "og:title"
has "العنوان الافتراضي محفوظ" "$html" "مركز آيت تقرين"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/" --max-time 15)
check "الرئيسية 200" "200" "$code"

echo "── 7) صحة القوائم بعد التعديلات ──"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/articles" --max-time 10); check "GET /api/articles" "200" "$code"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/ebooks" --max-time 10);  check "GET /api/ebooks"  "200" "$code"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/courses" --max-time 10); check "GET /api/courses" "200" "$code"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/ads" --max-time 10);     check "GET /api/ads"     "200" "$code"

echo "── 8) التنظيف (حذف عناصر الاختبار) ──"
for d in "articles/$ART" "ebooks/$EB" "courses/$CRS"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/$d" -H "$AH" --max-time 10)
  check "حذف $d" "200" "$code"
done
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/ads" -H "$AH" -H 'Content-Type: application/json' \
  -d "{\"action\":\"delete\",\"id\":\"$AD\"}" --max-time 10)
check "حذف الإعلان" "200" "$code"

echo "════════════════════════════"
echo "النتيجة: ناجح=$PASS فاشل=$FAIL"
[ "$FAIL" = "0" ] && echo "ALL GREEN ✓" || echo "HAS FAILURES ✗"
exit "$FAIL"

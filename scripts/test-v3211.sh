#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# scripts/test-v3211.sh — اختبارات v3.21.1
# /api/share-author: اسم وصورة المؤلف/المكوِّن لصورة المشاركة
# (مقال بالكاتب، تكوين بالمكوِّن وصورته، كتاب بمؤلفه النصي، إعلان بلا مؤلف)
# + عناصر اختبار كاملة ثم تنظيفها
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

echo "── 2) /api/share-author — الحالات الهامشية أولاً ──"
R=$(curl -s "$BASE/api/share-author?view=articles&id=zzzz" --max-time 10)
check "معرف غير صالح → فارغ" '{"name": "","photo": ""}' "{\"name\": \"$(echo "$R" | J 'd.get("name","")')\",\"photo\": \"$(echo "$R" | J 'd.get("photo","")')\"}"
R=$(curl -s "$BASE/api/share-author?view=nonsense&id=aaaaaaaaaaaaaaaaaaaaaaaa" --max-time 10)
check "view غير معروف → فارغ" "" "$(echo "$R" | J 'd.get("name","")+d.get("photo","")')"
R=$(curl -s "$BASE/api/share-author?view=articles&id=aaaaaaaaaaaaaaaaaaaaaaaa" --max-time 10)
check "معرف صالح غير موجود → فارغ" "" "$(echo "$R" | J 'd.get("name","")+d.get("photo","")')"

echo "── 3) الإعلانات بلا مؤلف — بلا استعلام ──"
AD=$(curl -s -X POST "$BASE/api/ads" -H "$AH" -H 'Content-Type: application/json' \
  -d "{\"action\":\"create\",\"title\":\"إعلان اختبار 3211\",\"body\":\"نص إعلان اختباري\",\"media\":[\"$IMG\"],\"publish\":true}" \
  | J 'str(d.get("ad",{}).get("_id","") or d.get("id","") or d.get("_id",""))')
check "إنشاء+نشر إعلان" "24" "${#AD}"
R=$(curl -s "$BASE/api/share-author?view=ads&id=$AD" --max-time 10)
check "إعلان → name فارغ" "" "$(echo "$R" | J 'd.get("name","")')"
check "إعلان → photo فارغ" "" "$(echo "$R" | J 'd.get("photo","")')"

echo "── 4) المقال: الكاتب لقطة من جلسة النشر ──"
ART=$(curl -s -X POST "$BASE/api/articles" -H "$AH" -H 'Content-Type: application/json' \
  -d "{\"title\":\"مقال اختبار 3211\",\"summary\":\"نبذة اختبارية\",\"content\":\"متن اختباري\",\"category\":\"general\",\"coverBase64\":\"$IMG\",\"active\":true}" \
  | J 'str(d.get("article",{}).get("_id",""))')
check "إنشاء مقال" "24" "${#ART}"
R=$(curl -s "$BASE/api/share-author?view=articles&id=$ART" --max-time 10)
check "اسم كاتب المقال = إدارة المركز" "إدارة المركز" "$(echo "$R" | J 'd.get("name","")')"
check "صورة الإدارة فارغة → يُرسم الحرف الأول" "" "$(echo "$R" | J 'd.get("photo","")')"

echo "── 5) الكتاب: مؤلف نصي حر ──"
EB=$(curl -s -X POST "$BASE/api/ebooks" -H "$AH" -H 'Content-Type: application/json' \
  -d "{\"title\":\"كتاب اختبار 3211\",\"summary\":\"نبذة كتاب اختبارية\",\"author\":\"كاتب الاختبار الحر\",\"coverBase64\":\"$IMG\",\"price\":0,\"active\":true}" \
  | J 'str(d.get("ebook",{}).get("_id",""))')
check "إنشاء كتاب" "24" "${#EB}"
R=$(curl -s "$BASE/api/share-author?view=ebooks&id=$EB" --max-time 10)
check "اسم مؤلف الكتاب" "كاتب الاختبار الحر" "$(echo "$R" | J 'd.get("name","")')"
check "الكتاب بلا صورة حساب" "" "$(echo "$R" | J 'd.get("photo","")')"

echo "── 6) التكوين: المكوِّن بصورته من حسابه ──"
TR=$(curl -s -X POST "$BASE/api/accounts" -H "$AH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"مكون اختبار 3211\",\"phone\":\"0550000331\",\"password\":\"Test3211!\",\"role\":\"trainer\",\"photoBase64\":\"$IMG\"}" \
  | J 'str(d.get("user",{}).get("_id","") or d.get("_id",""))')
check "إنشاء حساب مكوِّن بصورة" "24" "${#TR}"
CRS=$(curl -s -X POST "$BASE/api/courses" -H "$AH" -H 'Content-Type: application/json' \
  -d "{\"title\":\"تكوين اختبار 3211\",\"description\":\"وصف اختباري\",\"price\":0,\"capacity\":0,\"coverBase64\":\"$IMG\",\"sessions\":[],\"active\":true,\"trainerId\":\"$TR\"}" \
  | J 'str(d.get("course",{}).get("_id",""))')
check "إنشاء تكوين بمكوِّن" "24" "${#CRS}"
R=$(curl -s "$BASE/api/share-author?view=courses&id=$CRS" --max-time 10)
check "اسم المكوِّن" "مكون اختبار 3211" "$(echo "$R" | J 'd.get("name","")')"
has "صورة المكوِّن data:image" "$(echo "$R" | J 'd.get("photo","")')" "data:image/jpeg;base64,"

echo "── 7) تكوين بلا مكوِّن ──"
CRS2=$(curl -s -X POST "$BASE/api/courses" -H "$AH" -H 'Content-Type: application/json' \
  -d "{\"title\":\"تكوين بلا مكوِّن 3211\",\"description\":\"وصف\",\"price\":0,\"capacity\":0,\"coverBase64\":\"$IMG\",\"sessions\":[],\"active\":true}" \
  | J 'str(d.get("course",{}).get("_id",""))')
check "إنشاء تكوين ثانٍ" "24" "${#CRS2}"
R=$(curl -s "$BASE/api/share-author?view=courses&id=$CRS2" --max-time 10)
check "بلا مكوِّن → فارغ" "" "$(echo "$R" | J 'd.get("name","")+d.get("photo","")')"

echo "── 8) العنصر المحذوف → فارغ ──"
code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/articles/$ART" -H "$AH" --max-time 10)
check "حذف المقال" "200" "$code"
R=$(curl -s "$BASE/api/share-author?view=articles&id=$ART" --max-time 10)
check "مقال محذوف → فارغ" "" "$(echo "$R" | J 'd.get("name","")+d.get("photo","")')"

echo "── 9) share-image ما زال يعمل (انحدار سريع) ──"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/share-image?view=courses&id=$CRS" --max-time 15)
check "share-image courses → 200" "200" "$code"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/share-image?view=ads&id=$AD" --max-time 15)
check "share-image ads → 200" "200" "$code"

echo "── 10) قوائم عامة سليمة ──"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/articles" --max-time 10); check "GET /api/articles" "200" "$code"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/ebooks" --max-time 10);  check "GET /api/ebooks"  "200" "$code"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/courses" --max-time 10); check "GET /api/courses" "200" "$code"

echo "── 11) التنظيف ──"
code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/ebooks/$EB" -H "$AH" --max-time 10)
check "حذف الكتاب" "200" "$code"
for c in "$CRS" "$CRS2"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/courses/$c" -H "$AH" --max-time 10)
  check "حذف تكوين" "200" "$code"
done
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/ads" -H "$AH" -H 'Content-Type: application/json' \
  -d "{\"action\":\"delete\",\"id\":\"$AD\"}" --max-time 10)
check "حذف الإعلان" "200" "$code"
code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/accounts/$TR" -H "$AH" --max-time 10)
check "حذف حساب المكوِّن" "200" "$code"

echo "════════════════════════════"
echo "النتيجة: ناجح=$PASS فاشل=$FAIL"
[ "$FAIL" = "0" ] && echo "ALL GREEN ✓" || echo "HAS FAILURES ✗"
exit "$FAIL"

#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# اختبار v3.17 — تحسينات استهلاك النطاق (Fast Origin Transfer)
# يتحقق من: كاش الوسائط، كاش الحافة العام، تقليم الإعدادات، robots،
# وبقاء الوظائف الأساسية سليمة (دخول/إعدادات/خدمات/رفع وسائط/Range)
# ═══════════════════════════════════════════════════════════════
set -u
BASE="http://localhost:3000"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
check(){ if [ "$1" = "$2" ]; then ok "$3"; else bad "$3 (متوقع: $2 — فعلي: $1)"; fi; }
has(){ echo "$1" | grep -q "$2" && ok "$3" || bad "$3 — الناقص: $2"; }
not_has(){ echo "$1" | grep -q "$2" && bad "$3 — يجب ألا يحتوي: $2" || ok "$3"; }

echo "── 1) دخول الإدارة (bootstrap) ──"
R=$(curl -s -X POST "$BASE/api/auth/admin-login" -H "Content-Type: application/json" \
  -d '{"phone":"0550000001","password":"Pass1234!"}')
TOKEN=$(echo "$R" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$TOKEN" ] && ok "توكن الإدارة" || { bad "فشل دخول الإدارة: $R"; exit 1; }
AH="x-auth-token: $TOKEN"

echo "── 2) robots.txt — منع /api/ مع بقاء الرئيسية ──"
RB=$(curl -s "$BASE/robots.txt")
has "$RB" "Disallow: /api/" "robots يمنع /api/"
not_has "$RB" "User-agent: Googlebot" "robots بلا مجموعات خاصة (الجميع تحت *)"

echo "── 3) كاش الوسائط (s-maxage على الحافة) ──"
# صورة اختبار 1×1 JPEG صالحة
printf '\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\x09\x09\x08\x0a\x0c\x14\x0d\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1c\x1a\x1c\x18\x16\x1c\x1e\x1f\x18\x17\x1f\x1c\x1b\x17\x18\x20\x25\x21\x1e\x24\x1b\x1f\x1b\x18\xff\xc9\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xcc\x00\x06\x00\x10\x10\x05\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xd2\xcf \xff\xd9' > /tmp/t317.jpg
UP=$(curl -s -X POST "$BASE/api/media" -H "$AH" -F "file=@/tmp/t317.jpg;type=image/jpeg")
MURL=$(echo "$UP" | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$MURL" ] && ok "رفع صورة اختبار → $MURL" || { bad "فشل الرفع: $UP"; exit 1; }
MH=$(curl -sI "$BASE$MURL")
has "$MH" "s-maxage=31536000" "وسائط: s-maxage حافة Vercel"
has "$MH" "immutable" "وسائط: immutable"
has "$MH" "200" "وسائط: GET كامل 200"
RH=$(curl -s -o /dev/null -D - -H "Range: bytes=0-9" "$BASE$MURL")
check "$(echo "$RH" | head -1 | grep -o '206')" "206" "وسائط: Range → 206 Partial"
has "$RH" "accept-ranges: bytes" "وسائط: Accept-Ranges للتمرير داخل الفيديو"
check "$(echo "$RH" | grep -io 'content-length: 10' | head -1)" "content-length: 10" "وسائط: طول المقطع صحيح (10 بايتات)"

echo "── 4) كاش الحافة على المسارات العامة ──"
SH=$(curl -sI "$BASE/api/services")
has "$SH" "s-maxage=60" "services: كاش حافة"
has "$SH" "stale-while-revalidate=300" "services: SWR"
SH=$(curl -sI "$BASE/api/specialists")
has "$SH" "s-maxage=60" "specialists: كاش حافة"
SH=$(curl -sI "$BASE/api/articles")
has "$SH" "s-maxage=60" "articles: كاش حافة"
AH_ALL=$(curl -s -o /dev/null -D - -H "$AH" "$BASE/api/articles?all=1")
not_has "$AH_ALL" "s-maxage=60" "articles?all=1 (إدارة): بلا كاش كما يجب"
SH=$(curl -sI "$BASE/api/pages?key=faq&lang=fr")
has "$SH" "s-maxage=60" "pages?key=faq&lang=fr: كاش حافة"
CH=$(curl -sI "$BASE/api/courses")
not_has "$CH" "s-maxage=60" "courses: بلا كاش (بيانات حسب المستخدم) كما يجب"
TH=$(curl -sI "$BASE/api/testimonials")
not_has "$TH" "s-maxage=60" "testimonials: بلا كاش (أسماء حسب الدور) كما يجب"

echo "── 5) تقليم حمولة /api/settings من base64 المهدور ──"
BIGDATA="data:image/jpeg;base64,$(head -c 3000 /dev/urandom | base64 | tr -d '\n')"
PUT=$(curl -s -X PUT "$BASE/api/settings" -H "$AH" -H "Content-Type: application/json" -d "{
  \"sliderMedia\": [
    {\"type\":\"image\",\"url\":\"$MURL\",\"data\":\"$BIGDATA\",\"title\":\"حديث برابط\"},
    {\"type\":\"image\",\"url\":\"\",\"data\":\"data:image/png;base64,QUJD\",\"title\":\"قديم بلا رابط\"}
  ]}")
echo "$PUT" | grep -q '"ok":true\|ok' && ok "حفظ الإعدادات بعنصرين (برابط + قديم)" || bad "فشل PUT الإعدادات: $PUT"
# فحص دقيق عبر تحليل JSON (ترتيب الحقول لا يؤثر)
J=$(curl -s "$BASE/api/settings")
D1=$(echo "$J" | python3 -c "import json,sys; sm=json.load(sys.stdin)['settings']['sliderMedia']; print(next((len(m.get('data') or '') for m in sm if m.get('title')=='حديث برابط'), -1))")
check "$D1" "0" "العنصر الحديث برابط: data أُفرغ (توفير النقل)"
D2=$(echo "$J" | python3 -c "import json,sys; sm=json.load(sys.stdin)['settings']['sliderMedia']; print(next((len(m.get('data') or '') for m in sm if m.get('title')=='قديم بلا رابط'), -1))")
[ "$D2" -gt 0 ] && ok "العنصر القديم بلا رابط: data محفوظ (توافق رجعي، $D2 حرفاً)" || bad "العنصر القديم فُقد data"
echo "$J" | grep -q "$MURL" && ok "رابط الوسائط موجود كما هو" || bad "رابط الوسائط فُقد!"
echo "$J" | grep -q "vapidPrivate" && bad "vapidPrivate مسرب!" || ok "vapidPrivate مخفي كما هو"

echo "── 6) بقاء الوظائف الأساسية (انحدار سريع) ──"
SVC=$(curl -s -X POST "$BASE/api/services" -H "$AH" -H "Content-Type: application/json" \
  -d '{"title":"جلسة اختبار v3.17","price":100,"active":true}')
echo "$SVC" | grep -q '"_id"' && ok "إنشاء خدمة يعمل" || bad "فشل إنشاء خدمة: $SVC"
SL=$(curl -s "$BASE/api/services")
echo "$SL" | grep -q "جلسة اختبار v3.17" && ok "الخدمة تظهر في القائمة العامة" || bad "الخدمة غائبة"
LG=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" \
  -d '{"phone":"0550000001","password":"Pass1234!"}')
echo "$LG" | grep -q '"token"' && ok "دخول عام يعمل" || bad "فشل الدخول العام"
HP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/")
check "$HP" "200" "الرئيسية تُقدَّم"
HH=$(curl -sI "$BASE/api/health")
check "$(echo "$HH" | head -1 | grep -o '200')" "200" "health يعمل"

echo "════════════════════════════════"
echo "النتيجة: ناجح=$PASS فاشل=$FAIL"
[ $FAIL -eq 0 ] && echo "🎉 كل الفحوصات ناجحة" || echo "⚠️ توجد إخفاقات"

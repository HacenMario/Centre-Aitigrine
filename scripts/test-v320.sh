#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# v3.20.0 — اختبارات الكتب المدفوعة + طلبات الشراء + الأنشطة العامة
# الدورة الكاملة: إنشاء كتاب مدفوع → طلب عميل → إشعار إدارة → قبول →
# إشعار واتساب → تأكيد الدفع → تفعيل → وصول المحتوى وDrive → إشعار تفعيل
# ═══════════════════════════════════════════════════════════════════
set -u
BASE="http://127.0.0.1:3000"
PASS=0; FAIL=0
H_JSON='Content-Type: application/json'
T=/tmp/v320-body.json

code(){ curl -s -o "$T" -w "%{http_code}" "$@"; }
jqget(){ cat "$T" | python3 -c "import sys,json;d=json.load(sys.stdin);print(eval('d'+sys.argv[1]))" "$2" 2>/dev/null; }
ok(){ PASS=$((PASS+1)); echo "✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "✗ $1  ← $(head -c 150 "$T")"; }
expect(){ local label="$1" want="$2" got="$3"; if [ "$got" = "$want" ]; then ok "$label"; else bad "$label (توقعت $want صار $got)"; fi; }
contains(){ local label="$1" pat="$2"; if rg -q "$pat" "$T" 2>/dev/null; then ok "$label"; else bad "$label ← $(head -c 150 "$T")"; fi; }
not_contains(){ local label="$1" pat="$2"; if rg -q "$pat" "$T" 2>/dev/null; then bad "$label (وجِد المحظور)"; else ok "$label"; fi; }

echo "── 1) جلسات الاختبار ──"
C=$(code -X POST $BASE/api/auth/login -H "$H_JSON" -d '{"phone":"0550000001","password":"Pass1234!","name":"إدارة المركز"}')
expect "دخول الإدارة (200)" "200" "$C"
AH="x-auth-token: $(jqget x "['token']")"

C=$(code -X POST $BASE/api/auth/register -H "$H_JSON" -d '{"name":"نادية المشترية","phone":"0550000221","password":"Secret1!","recoveryPhrase":"عبارة استرجاع طويلة","bloodType":"O+"}')
expect "تسجيل عميلة (200)" "200" "$C"
CH="x-auth-token: $(jqget x "['token']")"
C=$(code -X POST $BASE/api/auth/register -H "$H_JSON" -d '{"name":"سعيد المشتري الثاني","phone":"0550000222","password":"Secret1!","recoveryPhrase":"عبارة استرجاع طويلة","bloodType":"A+"}')
expect "تسجيل عميل ثانٍ (200)" "200" "$C"
CH2="x-auth-token: $(jqget x "['token']")"

echo "── 2) إنشاء كتب: مجاني + مدفوع بسعر ورابط Drive ──"
C=$(code -X POST $BASE/api/ebooks -H "$AH" -H "$H_JSON" -d '{"title":"دليل الاسترخاء المجاني","summary":"كتاب تمهيدي","blocks":[{"type":"text","text":"فقرة تجريبية مجانية"}],"active":true}')
expect "إنشاء كتاب مجاني (200)" "200" "$C"
FREE_ID=$(jqget x "['ebook']['_id']")
C=$(code -X POST $BASE/api/ebooks -H "$AH" -H "$H_JSON" -d '{"title":"فن الطمأنينة المدفوع","summary":"كتاب متقدم بالصور والجداول","price":1500,"driveLink":"https://drive.google.com/file/d/TEST123/view","blocks":[{"type":"text","text":"محتوى سري مدفوع"}],"active":true}')
expect "إنشاء كتاب مدفوع 1500 دج (200)" "200" "$C"
PAID_ID=$(jqget x "['ebook']['_id']")
contains "الرابط محفوظ كما هو" "drive\.google\.com/file/d/TEST123"

C=$(code -X POST $BASE/api/ebooks -H "$AH" -H "$H_JSON" -d '{"title":"رابط شاذ","driveLink":"javascript:alert(1)","price":100}')
expect "رفض رابط غير http (رابط يُطبَّع فارغاً — إنشاء يعمل 200)" "200" "$C"
BAD_ID=$(jqget x "['ebook']['_id']")
C=$(code -X GET $BASE/api/ebooks/$BAD_ID -H "$AH")
not_contains "الرابط الشاذ لم يُخزَّن (تطبيع)" "javascript:"

echo "── 3) حماية القائمة: بلا محتوى وبلا رابط Drive ──"
C=$(code -X GET $BASE/api/ebooks -H "$CH")
not_contains "قائمة العميل بلا blocks الكتاب المدفوع" "محتوى سري مدفوع"
not_contains "قائمة العميل بلا رابط Drive" "drive\.google\.com"
contains "بطاقة المدفوع تحمل السعر" '"price":1500'
contains "حالة الطلب myOrder=null" '"myOrder":null'

C=$(code -X GET $BASE/api/ebooks?all=1 -H "$AH")
contains "قائمة الإدارة ترى driveHas" '"driveHas":true'

echo "── 4) الوصول للقراءة: القفل قبل الدفع ──"
C=$(code -X GET $BASE/api/ebooks/$PAID_ID -H "$CH")
not_contains "عميل بلا دفع: بلا محتوى" "محتوى سري مدفوع"
not_contains "عميل بلا دفع: بلا Drive" "drive\.google\.com"
contains "لكن يرى السعر وmyOrder" '"myOrder":null'
C=$(code -X GET $BASE/api/ebooks/$PAID_ID -H "$AH")
contains "الإدارة ترى المحتوى دائماً" "محتوى سري مدفوع"
C=$(code -X GET $BASE/api/ebooks/$FREE_ID -H "$CH")
contains "الكتاب المجاني محتواه للجميع" "فقرة تجريبية مجانية"

echo "── 5) الشراء: التحقق الصارم ──"
C=$(code -X POST $BASE/api/ebook-orders -H "$H_JSON" -d "{\"ebookId\":\"$FREE_ID\"}")
expect "زائر بلا توكن مرفوض (401)" "401" "$C"
C=$(code -X POST $BASE/api/ebook-orders -H "$CH" -H "$H_JSON" -d "{\"ebookId\":\"$FREE_ID\"}")
expect "شراء كتاب مجاني مرفوض (400)" "400" "$C"
C=$(code -X POST $BASE/api/ebook-orders -H "$AH" -H "$H_JSON" -d "{\"ebookId\":\"$PAID_ID\"}")
expect "الإدارة لا تشتري (403)" "403" "$C"
C=$(code -X POST $BASE/api/ebook-orders -H "$CH" -H "$H_JSON" -d "{\"ebookId\":\"$PAID_ID\"}")
expect "عميلة تطلب الكتاب المدفوع (200)" "200" "$C"
ORDER_ID=$(jqget x "['order']['_id']")
contains "سعر الطلب موثق 1500" '"price":1500'
C=$(code -X POST $BASE/api/ebook-orders -H "$CH" -H "$H_JSON" -d "{\"ebookId\":\"$PAID_ID\"}")
expect "طلب مكرر مرفوض (409)" "409" "$C"

echo "── 6) الطلب يصل للإدارة: قائمة + إشعار ──"
C=$(code -X GET "$BASE/api/ebook-orders?status=pending" -H "$AH")
contains "قائمة معلقات الإدارة تحمل الطلب" "$ORDER_ID"
contains "الطلب يحمل اسم العميلة" "نادية المشترية"
C=$(code -X GET "$BASE/api/notifications" -H "$AH")
contains "إشعار الإدارة: طلب شراء" "طلب شراء كتاب إلكتروني"
contains "الإشعار يوجه لصفحة الطلبات orders" '"link":"orders"'

echo "── 7) القبول → إشعار العميل بالواتساب ──"
C=$(code -X PATCH $BASE/api/ebook-orders/$ORDER_ID -H "$AH" -H "$H_JSON" -d '{"action":"accept"}')
expect "قبول الطلب (200)" "200" "$C"
contains "الحالة صارت accepted" '"status":"accepted"'
C=$(code -X GET "$BASE/api/notifications" -H "$CH")
contains "إشعار العميلة بالتواصل عبر واتساب" "واتساب"
contains "توجيه الإشعار لصفحة الكتب مع معرف الكتاب" "ebooks:"
C=$(code -X PATCH $BASE/api/ebook-orders/$ORDER_ID -H "$AH" -H "$H_JSON" -d '{"action":"accept"}')
expect "قبول ثانٍ مرفوض (409)" "409" "$C"

echo "── 8) تأكيد الدفع → تفعيل + نبضة نشاط ──"
C=$(code -X PATCH $BASE/api/ebook-orders/$ORDER_ID -H "$AH" -H "$H_JSON" -d '{"action":"paid"}')
expect "تأكيد الدفع (200)" "200" "$C"
contains "الحالة صارت paid" '"status":"paid"'
C=$(code -X GET $BASE/api/ebooks/$PAID_ID -H "$CH")
contains "العميلة المفعلة ترى المحتوى الآن" "محتوى سري مدفوع"
contains "وترى رابط Drive" "drive\.google\.com"
contains "unlocked=true" '"unlocked":true'
C=$(code -X GET $BASE/api/ebooks/$PAID_ID -H "$CH2")
not_contains "العميل الآخر ما يزال مقفولاً" "محتوى سري مدفوع"
C=$(code -X GET "$BASE/api/activities")
contains "الأنشطة العامة تشمل شراء الكتاب" '"kind":"ebook"'
contains "الاسم الأول فقط (خصوصية)" '"name":"نادية"'

echo "── 9) إشعار التفعيل + صلاحيات ──"
C=$(code -X GET "$BASE/api/notifications" -H "$CH")
contains "إشعار التفعيل وصل للعميلة" "تفعيل كتابك الإلكتروني"
C=$(code -X PATCH $BASE/api/ebook-orders/$ORDER_ID -H "$CH" -H "$H_JSON" -d '{"action":"cancel"}')
expect "العميلة لا تلغي طلبات (403)" "403" "$C"
C=$(code -X PATCH $BASE/api/ebook-orders/$ORDER_ID -H "$CH2" -H "$H_JSON" -d '{"action":"accept"}')
expect "عميل لا يقبل طلبات (403)" "403" "$C"
C=$(code -X PATCH $BASE/api/ebook-orders/$ORDER_ID -H "$AH" -H "$H_JSON" -d '{"action":"cancel"}')
expect "الإدارة تلغي الطلب (200)" "200" "$C"
C=$(code -X GET $BASE/api/ebooks/$PAID_ID -H "$CH")
not_contains "بعد إلغاء الطلب انغلق القفل مجدداً" "محتوى سري مدفوع"

echo "── 10) انحدار سريع ──"
C=$(code -X GET $BASE/api/health)
expect "health (200)" "200" "$C"
C=$(code -X POST $BASE/api/auth/login -H "$H_JSON" -d '{"phone":"0550000221","password":"Secret1!"}')
expect "دخول العميلة بعد كل شيء (200)" "200" "$C"
C=$(code -X GET $BASE/api/ebooks)
expect "القائمة العامة للزوار (200)" "200" "$C"
not_contains "قائمة الزوار بلا محتوى المدفوع" "محتوى سري مدفوع"

echo "══════════════════════════════"
echo "النتيجة: نجح $PASS — فشل $FAIL"
[ "$FAIL" = "0" ] && echo "ALL TESTS PASSED ✓" || echo "FAILURES ✗"

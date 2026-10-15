#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# v3.19.0 — اختبارات زمرة الدم الشاملة (فحص برموز HTTP + حقول فعلية)
# الإلزام عند التسجيل + صلاحيات (أدمين/مساعد/أخصائي معالج) + العرض في الملف والوثائق
# ═══════════════════════════════════════════════════════════════════
set -u
BASE="http://127.0.0.1:3000"
PASS=0; FAIL=0
H_JSON='Content-Type: application/json'
T=/tmp/v319-body.json

code(){ curl -s -o "$T" -w "%{http_code}" "$@"; }
jqget(){ cat "$T" | python3 -c "import sys,json;d=json.load(sys.stdin);print(eval('d'+sys.argv[1]))" "$2" 2>/dev/null; }
ok(){ PASS=$((PASS+1)); echo "✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "✗ $1  ← $(head -c 120 "$T")"; }
expect(){ local label="$1" want="$2" got="$3"; if [ "$got" = "$want" ]; then ok "$label"; else bad "$label (توقعت $want صار $got)"; fi; }
contains(){ local label="$1" pat="$2"; if rg -q "$pat" "$T" 2>/dev/null; then ok "$label"; else bad "$label ← $(head -c 120 "$T")"; fi; }

echo "── 1) تشغيل أول: إنشاء حساب الإدارة ──"
C=$(code -X POST $BASE/api/auth/login -H "$H_JSON" -d '{"phone":"0550000001","password":"Pass1234!","name":"إدارة المركز"}')
expect "bootstrap الإدارة (200)" "200" "$C"
ADMIN_TOKEN=$(jqget x "['token']")
AH="x-auth-token: $ADMIN_TOKEN"

echo "── 2) حسابات الاختبار: مساعد + أخصائي ──"
C=$(code -X POST $BASE/api/accounts -H "$AH" -H "$H_JSON" -d '{"name":"المساعدة أمينة","phone":"0550000004","password":"Pass1234!","role":"assistant","active":true}')
expect "إنشاء المساعد (200)" "200" "$C"
C=$(code -X POST $BASE/api/accounts -H "$AH" -H "$H_JSON" -d '{"name":"الدكتور كريم","phone":"0550000002","password":"Pass1234!","role":"specialist","specialty":"psychological","active":true}')
expect "إنشاء الأخصائي (200)" "200" "$C"
SPEC_ID=$(jqget x "['user']['_id']")

C=$(code -X POST $BASE/api/auth/login -H "$H_JSON" -d '{"phone":"0550000004","password":"Pass1234!"}')
expect "دخول المساعد (200)" "200" "$C"; MH="x-auth-token: $(jqget x "['token']")"
C=$(code -X POST $BASE/api/auth/login -H "$H_JSON" -d '{"phone":"0550000002","password":"Pass1234!"}')
expect "دخول الأخصائي (200)" "200" "$C"; SH="x-auth-token: $(jqget x "['token']")"

echo "── 3) عميل قديم (بلا زمرة دم) + تعيين معالج ──"
C=$(code -X POST $BASE/api/accounts -H "$AH" -H "$H_JSON" -d '{"name":"عميل قديم يوسف","phone":"0550000003","password":"Pass1234!","role":"client","active":true}')
expect "إنشاء العميل القديم (200)" "200" "$C"
OLD_ID=$(jqget x "['user']['_id']")
C=$(code -X PATCH $BASE/api/accounts/$OLD_ID -H "$AH" -H "$H_JSON" -d "{\"assignedSpecialistId\":\"$SPEC_ID\"}")
expect "تعيين الأخصائي المعالج (200)" "200" "$C"

echo "── 4) التسجيل الذاتي: الإلزام الصارم ──"
C=$(code -X POST $BASE/api/auth/register -H "$H_JSON" -d '{"name":"عميل بلا زمرة","phone":"0550000111","password":"Secret1!","recoveryPhrase":"عبارة استرجاع طويلة"}')
expect "رفض التسجيل بدون زمرة دم (400)" "400" "$C"
contains "رسالة الخطأ واضحة" "زمرة الدم إلزامية"
C=$(code -X POST $BASE/api/auth/register -H "$H_JSON" -d '{"name":"عميل قيمة خاطئة","phone":"0550000112","password":"Secret1!","recoveryPhrase":"عبارة استرجاع طويلة","bloodType":"XX"}')
expect "رفض قيمة غير صحيحة XX (400)" "400" "$C"
C=$(code -X POST $BASE/api/auth/register -H "$H_JSON" -d '{"name":"سارة العميل","phone":"0550000113","password":"Secret1!","recoveryPhrase":"عبارة استرجاع طويلة","bloodType":"O+"}')
expect "نجاح التسجيل بـ O+ (200)" "200" "$C"
contains "الاستجابة تحمل bloodType=O+" '"bloodType":"O\+"'

echo "── 5) الإدارة تعدّل زمرة عميل ──"
C=$(code -X PATCH $BASE/api/accounts/$OLD_ID -H "$AH" -H "$H_JSON" -d '{"bloodType":"A-"}')
expect "الأدمين يضيف A- (200)" "200" "$C"
contains "القيمة محفوظة A-" '"bloodType":"A-"'
C=$(code -X PATCH $BASE/api/accounts/$OLD_ID -H "$AH" -H "$H_JSON" -d '{"bloodType":"ZZ"}')
expect "رفض قيمة خاطئة (400)" "400" "$C"

echo "── 6) المساعد: زمرة نعم، الباقي لا ──"
C=$(code -X PATCH $BASE/api/accounts/$OLD_ID -H "$MH" -H "$H_JSON" -d '{"bloodType":"B+"}')
expect "المساعد يضيف B+ (200)" "200" "$C"
contains "القيمة محفوظة B+" '"bloodType":"B\+"'
C=$(code -X PATCH $BASE/api/accounts/$OLD_ID -H "$MH" -H "$H_JSON" -d '{"name":"تعديل ممنوع"}')
expect "المساعد: رفض تعديل الاسم (403)" "403" "$C"

echo "── 7) الأخصائي المعالج من الملف الطلبي ──"
C=$(code -X PUT $BASE/api/records -H "$SH" -H "$H_JSON" -d "{\"patientId\":\"$OLD_ID\",\"bloodType\":\"AB+\",\"birthDate\":\"2015-03-10\"}")
expect "الأخصائي يضبط AB+ لملف مريضه (200)" "200" "$C"
C=$(code -X GET "$BASE/api/records?patientId=$OLD_ID" -H "$SH")
contains "قراءة الملف تُرجع AB+ من حساب العميل" '"bloodType":"AB\+"'

echo "── 8) حماية الأخصائي: مريض ليس من ملفاته ──"
C=$(code -X POST $BASE/api/auth/login -H "$H_JSON" -d '{"phone":"0550000113","password":"Secret1!"}')
NEW_TOKEN=$(jqget x "['token']")
NEW_ID=$(jqget x "['user']['_id']")
C=$(code -X PUT $BASE/api/records -H "$SH" -H "$H_JSON" -d "{\"patientId\":\"$NEW_ID\",\"bloodType\":\"O-\"}")
expect "رفض زمرة عميل ليس مريضه (403)" "403" "$C"

echo "── 9) العميل لا يعدّل زمرة دمه بنفسه ──"
C=$(code -X PATCH $BASE/api/auth/me -H "x-auth-token: $NEW_TOKEN" -H "$H_JSON" -d '{"bloodType":"O-"}')
expect "رفض التعديل الذاتي (403)" "403" "$C"
contains "رسالة من يملك التعديل" "الإدارة أو المساعد أو الأخصائي المعالج"

echo "── 10) القوائم تُظهر زمرة الدم ──"
C=$(code -X GET "$BASE/api/records" -H "$AH")
contains "قائمة المرضى (إدارة) تتضمن AB+" '"bloodType":"AB\+"'
C=$(code -X GET "$BASE/api/accounts" -H "$AH")
contains "قائمة الحسابات تتضمن O+" '"bloodType":"O\+"'

echo "── 11) انحدار سريع ──"
C=$(code $BASE/api/health)
expect "health (200)" "200" "$C"
C=$(code -X POST $BASE/api/auth/login -H "$H_JSON" -d '{"phone":"0550000003","password":"Pass1234!"}')
expect "دخول العميل القديم (200)" "200" "$C"
C=$(code -X POST $BASE/api/auth/login -H "$H_JSON" -d '{"phone":"0550000113","password":"Secret1!"}')
expect "دخول العميل الجديد (200)" "200" "$C"
C=$(code "$BASE/api/records" -H "$SH")
contains "قائمة مرضى الأخصائي تعمل" "عميل قديم يوسف"

echo "══════════════════════════════"
echo "النتيجة: نجح $PASS — فشل $FAIL"
[ $FAIL -eq 0 ] && echo "ALL TESTS PASSED ✓" || echo "SOME TESTS FAILED ✗"

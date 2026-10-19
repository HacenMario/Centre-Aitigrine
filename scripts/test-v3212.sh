#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# scripts/test-v3212.sh — اختبارات v3.21.2
# 1) إصلاح إنذار زمرة الدم الكاذب: تعديل مواقيت توفر الأخصائي يعمل
#    (النموذج يرسل bloodType:null ضمن الكائن الشامل → لا عملية، لا رفض)
#    وقيمة فعلية على غير العميل تُرفض كما هي (المواصفة حصّينة)
# 2) زمرة الدم للعملاء كما هي حرفياً: ضبط + حذف (فراغ) من المساعد والإدارة
# 3) صلاحية النشر: مؤشرات /api/share-author عامة تعمل (الأزرار تظهر
#    للأخصائي/المكوِّن واجهوياً — اختبار المتصفح خارج هذا السكربت)
# + عناصر اختبار كاملة ثم تنظيفها
# ═══════════════════════════════════════════════════════════════
set -u
BASE="http://localhost:3000"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (متوقع=$2 فعلي=$3)"; fi; }
has()  { if echo "$2" | grep -q "$3"; then ok "$1"; else bad "$1 — لا يحتوي: $3"; fi; }
J() { python3 -c "import json,sys;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1"; }

echo "── 1) المصادقة ──"
TOKEN=$(curl -s -X POST "$BASE/api/auth/admin-login" -H 'Content-Type: application/json' \
  -d '{"phone":"0550000001","password":"Pass1234!"}' | J 'd.get("token","")')
check "دخول الإدارة" "yes" "$([ -n "$TOKEN" ] && echo yes || echo no)"
AH="x-auth-token: $TOKEN"

echo "── 2) ★ إصلاح الخطأ: تعديل الأخصائي بكائن شامل (كما يرسله النموذج) ──"
SPEC=$(curl -s -X POST "$BASE/api/accounts" -H "$AH" -H 'Content-Type: application/json' \
  -d '{"name":"أخصائي اختبار 3212","phone":"0559321201","password":"Test3212!","role":"specialist","langs":["ar"],"weeklyHours":{}}')
SID=$(echo "$SPEC" | J 'd["user"]["_id"]')
check "إنشاء حساب أخصائي" "yes" "$([ -n "$SID" ] && echo yes || echo no)"
# ★ الجسم يحمل bloodType:null مثل ما يرسله نموذج الحسابات دائماً من toSafeUser
R=$(curl -s -X PATCH "$BASE/api/accounts/$SID" -H "$AH" -H 'Content-Type: application/json' \
  -d '{"name":"أخصائي اختبار 3212","phone":"0559321201","role":"specialist","langs":["ar"],"bio":"","title":"","yearsExperience":0,"specialties":[],"serviceIds":[],"photoBase64":"","weeklyHours":{"sun":["10:00","11:00"]},"assignedSpecialistId":null,"bloodType":null,"active":true}')
has "★ PATCH مواقيت التوفر مع bloodType:null → نجاح" "$R" '"weeklyHours"'
has "★ المواقيت حُفظت فعلاً (sun في المستند المحدّث)" "$R" '"sun"'

echo "── 3) المواصفة حصّينة: قيمة فعلية على غير العميل تُرفض ──"
R=$(curl -s -X PATCH "$BASE/api/accounts/$SID" -H "$AH" -H 'Content-Type: application/json' \
  -d '{"bloodType":"O+"}')
has "bloodType=O+ على أخصائي → رفض 400" "$R" "زمرة الدم تُضبط لحسابات العملاء فقط"

echo "── 4) العملاء كما هم حرفياً: ضبط وحذف زمرة الدم ──"
CLI=$(curl -s -X POST "$BASE/api/accounts" -H "$AH" -H 'Content-Type: application/json' \
  -d '{"name":"عميل اختبار 3212","phone":"0559321202","password":"Test3212!","role":"client","langs":["ar"],"bloodType":"A+"}')
CID=$(echo "$CLI" | J 'd["user"]["_id"]')
check "إنشاء حساب عميل (بزمرة A+)" "yes" "$([ -n "$CID" ] && echo yes || echo no)"
ATOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"phone":"0559321203","password":"Assist3212!"}' | J 'd.get("token","")' 2>/dev/null)
# إنشاء حساب مساعد للتجربة
ASST=$(curl -s -X POST "$BASE/api/accounts" -H "$AH" -H 'Content-Type: application/json' \
  -d '{"name":"مساعد اختبار 3212","phone":"0559321203","password":"Assist3212!","role":"assistant","langs":["ar"]}')
AID=$(echo "$ASST" | J 'd["user"]["_id"]')
ATOKEN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"phone":"0559321203","password":"Assist3212!"}' | J 'd.get("token","")')
check "دخول المساعد" "yes" "$([ -n "$ATOKEN" ] && echo yes || echo no)"
R=$(curl -s -X PATCH "$BASE/api/accounts/$CID" -H "x-auth-token: $ATOKEN" -H 'Content-Type: application/json' \
  -d '{"bloodType":"B+"}')
check "المساعد يضبط B+ للعميل" "B+" "$(echo "$R" | J 'd["user"]["bloodType"]')"
R=$(curl -s -X PATCH "$BASE/api/accounts/$CID" -H "x-auth-token: $ATOKEN" -H 'Content-Type: application/json' \
  -d '{"bloodType":null}')
check "المساعد يحذف زمرة العميل (null)" "None" "$(echo "$R" | J 'd["user"]["bloodType"]')"
R=$(curl -s -X PATCH "$BASE/api/accounts/$CID" -H "x-auth-token: $ATOKEN" -H 'Content-Type: application/json' \
  -d '{"bloodType":"O-"}')
check "المساعد يعيد ضبط O-" "O-" "$(echo "$R" | J 'd["user"]["bloodType"]')"

echo "── 5) صلاحية النشر — نظافة النقاط العامة ──"
R=$(curl -s "$BASE/api/share-author?view=articles&id=aaaaaaaaaaaaaaaaaaaaaaaa" --max-time 10)
has "share-author يبقى عاماً وسليماً" "$R" '"name"'

echo "── 6) التنظيف ──"
for id in "$CID" "$SID" "$AID"; do
  R=$(curl -s -X DELETE "$BASE/api/accounts/$id" -H "$AH")
  check "حذف حساب اختبار ($id)" "True" "$(echo "$R" | J 'd.get("ok")')"
done

echo "════════════════════════════"
echo "النتيجة: ناجح=$PASS فاشل=$FAIL"
[ "$FAIL" = "0" ] && echo "ALL GREEN ✓" || echo "FAILED ✗"
exit "$FAIL"

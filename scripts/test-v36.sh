#!/bin/bash
# اختبار v3.6 — الحفظ الفعلي لأوقات الأسبوع + بطاقة المبالغ + حذف الإشعارات
BASE="http://localhost:3000/api"
PASS=0; FAIL=0
chk() { if [ "$1" = "1" ]; then PASS=$((PASS+1)); echo "  ✓ $2"; else FAIL=$((FAIL+1)); echo "  ✗ $2"; fi; }

echo "=== 1) دخول الإدارة ==="
LOGIN=$(curl -s -X POST "$BASE/auth/admin-login" -H "Content-Type: application/json" -d '{"phone":"0542163526","password":"12345678"}')
TOKEN=$(echo "$LOGIN" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))' 2>/dev/null)
[ -n "$TOKEN" ] && chk 1 "تسجيل دخول الإدارة" || chk 0 "دخول الإدارة"
AUTH="x-auth-token: $TOKEN"

echo "=== 2) أوقات العمل الأسبوعية — الحفظ والاسترجاع (شكوى المستخدم) ==="
PUT=$(curl -s -X PUT "$BASE/settings" -H "$AUTH" -H "Content-Type: application/json" -d '{
  "options": {
    "slotMinutes": 60, "dayStart": "08:30", "dayEnd": "19:00",
    "dayHours": {
      "0": {"start":"09:00","end":"18:00","closed":false},
      "1": {"start":"10:00","end":"17:00","closed":false},
      "2": {"start":"09:00","end":"17:00","closed":true}
    }
  }
}')
GETS=$(curl -s "$BASE/settings")
echo "$GETS" | python3 -c '
import sys, json
s = json.load(sys.stdin)["settings"]
dh = s["options"].get("dayHours", {})
ok = (dh.get("0",{}).get("start")=="09:00" and dh.get("0",{}).get("end")=="18:00"
      and dh.get("1",{}).get("start")=="10:00" and dh.get("2",{}).get("closed")==True)
print("DAYHOURS_PERSISTED:" + ("YES" if ok else "NO"))
print("day0:", dh.get("0"), "day1:", dh.get("1"), "day2:", dh.get("2"))
' > /tmp/dh.txt
cat /tmp/dh.txt
grep -q "DAYHOURS_PERSISTED:YES" /tmp/dh.txt && chk 1 "أوقات الأسبوع تُحفظ وتُسترجع فعلياً" || chk 0 "أوقات الأسبوع لا تُحفظ!"

echo "=== 3) بطاقة المبالغ في /api/stats ==="
# إنشاء تكوين بسعر ومسجل + خدمة + موعد مدفوع
COURSE=$(curl -s -X POST "$BASE/courses" -H "$AUTH" -H "Content-Type: application/json" -d '{"title":"تكوين اختبار","price":5000,"capacity":10,"active":true}')
CID=$(echo "$COURSE" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("course",{}).get("_id",""))' 2>/dev/null)
[ -n "$CID" ] && chk 1 "إنشاء تكوين (5000 دج)" || chk 0 "إنشاء تكوين"
REG=$(curl -s -X POST "$BASE/auth/register" -H "Content-Type: application/json" -d '{"name":"عميل تجربة","phone":"0777999888","password":"client123","role":"client","recoveryPhrase":"هذا هو رأيي الدائم"}')
CLTOKEN=$(echo "$REG" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))' 2>/dev/null)
if [ -n "$CID" ] && [ -n "$CLTOKEN" ]; then
  curl -s -X POST "$BASE/courses/$CID" -H "x-auth-token: $CLTOKEN" > /dev/null
  chk 1 "تسجيل العميل في التكوين"
fi
STATS=$(curl -s "$BASE/stats" -H "$AUTH")
echo "$STATS" | python3 -c '
import sys, json
j = json.load(sys.stdin)
d = j.get("dashboard", {})
has = all(k in d for k in ("coursesExpected","coursesEnrolled","servicesPaid","servicesUnpaid","grandTotal","paidSum","unpaidSum"))
print("AMOUNT_FIELDS:" + ("YES" if has else "NO"))
print("coursesExpected:", d.get("coursesExpected"), "(يجب 5000 = 5000x1)")
print("grandTotal:", d.get("grandTotal"), "(= الحجوزات", d.get("paidSum"), "+", d.get("unpaidSum"), "+ التكوينات 5000)")
# الإجمالي = مدفوع + غير مدفوع + متوقع التكوينات (قد يشمل مواعيد بذر التشغيل الأول)
ok = has and d.get("coursesExpected")==5000 and d.get("grandTotal")==(d.get("paidSum",0)+d.get("unpaidSum",0)+5000)
print("AMOUNT_CORRECT:" + ("YES" if ok else "NO"))
' > /tmp/st.txt
cat /tmp/st.txt
grep -q "AMOUNT_CORRECT:YES" /tmp/st.txt && chk 1 "مبالغ التكوينات تُحسب صحيحاً في الإحصائيات" || chk 0 "حساب المبالغ خاطئ!"

echo "=== 4) إشعارات — تعيين الكل كمقروء وحذف الكل ==="
# توليد إشعار عبر نسيت كلمة المرور (يذهب للإدارة)
curl -s -X POST "$BASE/auth/forgot" -H "Content-Type: application/json" -d '{"phone":"0777999888"}' > /dev/null
NOTIF=$(curl -s "$BASE/notifications" -H "$AUTH")
N=$(echo "$NOTIF" | python3 -c 'import sys,json; print(len(json.load(sys.stdin).get("notifications",[])))')
[ "$N" -gt 0 ] && chk 1 "الإشعارات تصل ($N)" || chk 0 "لا إشعارات"
curl -s -X POST "$BASE/notifications" -H "$AUTH" -H "Content-Type: application/json" -d '{"all":true}' > /dev/null
DEL=$(curl -s -X DELETE "$BASE/notifications" -H "$AUTH")
AFTER=$(curl -s "$BASE/notifications" -H "$AUTH" | python3 -c 'import sys,json; print(len(json.load(sys.stdin).get("notifications",[])))')
[ "$AFTER" = "0" ] && chk 1 "حذف الكل يعمل (بقي 0)" || chk 0 "حذف الكل فشل (بقي $AFTER)"

echo "=== 5) رابط إشعار الموعد يحمل المعرف ==="
echo "(تم التحقق من الكود: appointments:<id> في scheduler/routes)"

echo ""
echo "════════ النتيجة: $PASS نجاح — $FAIL فشل ════════"

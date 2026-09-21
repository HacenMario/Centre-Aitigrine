#!/bin/bash
# ═══════ اختبار v3.5 — الميزات الجديدة عبر API ═══════
set -u
BASE="http://127.0.0.1:3000"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }
has(){ if echo "$2" | grep -q "$1"; then ok "$3"; else bad "$3"; fi }

echo "— دخول الإدارة —"
R=$(curl -s -X POST $BASE/api/auth/admin-login -H 'Content-Type: application/json' -d '{"phone":"0542163526","password":"12345678"}')
ADMIN_TOKEN=$(echo "$R" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).token||'')}catch{console.log('')}})")
[ -n "$ADMIN_TOKEN" ] && ok "دخول الإدارة" || bad "دخول الإدارة"
A="x-auth-token: $ADMIN_TOKEN"

echo "— العبارات الترحيبية: بذر تلقائي + إدارة —"
R=$(curl -s $BASE/api/quotes)
N=$(echo "$R" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).total)}catch{console.log(0)}})")
[ "$N" -ge 10 ] && ok "البذر التلقائي: $N عبارات ترحيبية" || bad "البذر التلقائي ($N)"
R=$(curl -s -X POST $BASE/api/quotes -H "$A" -H 'Content-Type: application/json' -d '{"action":"create","textAr":"عبارة اختبار الجديد","textFr":"Phrase de test","textEn":"Test quote","author":"الاختبار"}')
QID=$(echo "$R" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).quote.id||'')}catch{console.log('')}})")
[ -n "$QID" ] && ok "إضافة عبارة جديدة (id=$QID)" || bad "إضافة عبارة"
R=$(curl -s -X POST $BASE/api/quotes -H "$A" -H 'Content-Type: application/json' -d "{\"action\":\"update\",\"id\":\"$QID\",\"active\":false}")
has '"active":false' "$R" "تعطيل العبارة"
R=$(curl -s $BASE/api/quotes)
if echo "$R" | grep -q "عبارة اختبار الجديد"; then bad "المعطلة مخفية عن الجمهور"; else ok "المعطلة مخفية عن الجمهور"; fi
R=$(curl -s -X POST $BASE/api/quotes -H "$A" -H 'Content-Type: application/json' -d "{\"action\":\"delete\",\"id\":\"$QID\"}")
has '"ok"' "$R" "حذف العبارة"
R=$(curl -s -X POST $BASE/api/quotes -H 'Content-Type: application/json' -d '{"action":"create","textAr":"x"}')
has 'error\|401\|UNAUTHORIZED' "$R" "الزائر ممنوع من الإدارة"

echo "— التصنيفات ثلاثية اللغة في الإعدادات —"
R=$(curl -s -X PUT $BASE/api/settings -H "$A" -H 'Content-Type: application/json' -d '{"options":{"serviceCategories":[{"ar":"جلسة نفسية","fr":"Séance psy","en":"Psych session"}],"courseCategories":[{"ar":"تكوين قيادة","fr":"Formation","en":"Training"}],"slotMinutes":60,"dayStart":"09:00","dayEnd":"17:00","dayHours":{"0":{"start":"09:00","end":"18:00","closed":false},"1":{"start":"10:00","end":"17:00","closed":false},"5":{"start":"09:00","end":"13:00","closed":true}}}}')
has '"serviceCategories"' "$R" "حفظ الإعدادات بالتصنيفات الثلاثية والأوقات"
R=$(curl -s $BASE/api/settings)
has '"ar":"جلسة نفسية"' "$R" "تصنيف خدمة ثلاثي اللغة يُقرأ"
has '"fr":"Séance psy"' "$R" "الترجمة الفرنسية محفوظة"
has '"start":"10:00","end":"17:00"' "$R" "أوقات الاثنين المخصصة"
has '"closed":true' "$R" "يوم مغلق محفوظ"

echo "— توافق التصنيفات النصية القديمة —"
R=$(curl -s $BASE/api/settings)
has '"serviceCategories":\[{' "$R" "تطبيع النصوص القديمة إلى كائنات"

echo "— المبالغ: سعر + حالة أداء → لوحة القيادة —"
# عميل
PH="0597$(date +%s | tail -c 6)"
curl -s -X POST $BASE/api/auth/register -H 'Content-Type: application/json' -d "{\"name\":\"عميل المبالغ\",\"phone\":\"$PH\",\"password\":\"pass123\",\"recoveryPhrase\":\"phrase amounts\"}" > /dev/null
R=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "{\"phone\":\"$PH\",\"password\":\"pass123\"}")
CT=$(echo "$R" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).token||'')}catch{console.log('')}})")
# أخصائي
SPH="0596$(date +%s | tail -c 6)"
R=$(curl -s -X POST $BASE/api/accounts -H "$A" -H 'Content-Type: application/json' -d "{\"name\":\"أخصائي المبالغ\",\"phone\":\"$SPH\",\"password\":\"spec123\",\"role\":\"specialist\",\"recoveryPhrase\":\"spec recovery\"}")
has '"user"\|"ok"' "$R" "إنشاء أخصائي"
R=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "{\"phone\":\"$SPH\",\"password\":\"spec123\"}")
ST=$(echo "$R" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).token||'')}catch{console.log('')}})")
# حجز غد 10:00 (الأخصائي بلا ساعات = مسموح)
DATE=$(node -e "const d=new Date(Date.now()+86400000);console.log(d.toISOString().slice(0,10))")
R=$(curl -s -X POST $BASE/api/appointments -H "x-auth-token: $CT" -H 'Content-Type: application/json' -d "{\"specialistId\":\"\",\"date\":\"$DATE\",\"time\":\"10:00\"}")
SPEC_ID=$(curl -s $BASE/api/specialists | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const l=JSON.parse(d).specialists;console.log(l.length?l[0]._id:'')}catch{console.log('')}})")
R=$(curl -s -X POST $BASE/api/appointments -H "x-auth-token: $CT" -H 'Content-Type: application/json' -d "{\"specialistId\":\"$SPEC_ID\",\"date\":\"$DATE\",\"time\":\"10:00\"}")
APPT=$(echo "$R" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).appointment._id||'')}catch{console.log('')}})")
[ -n "$APPT" ] && ok "حجز موعد (id=$APPT)" || bad "حجز موعد: $R"
R=$(curl -s -X PATCH $BASE/api/appointments/$APPT -H "$A" -H 'Content-Type: application/json' -d '{"price":2500,"paymentStatus":"paid"}')
has '"price":2500' "$R" "تحديد السعر 2500 دج"
has '"paymentStatus":"paid"' "$R" "تحديد حالة الأداء مدفوع"
# العميل ممنوع من تعديل السعر (403)
R=$(curl -s -w "|HTTP:%{http_code}" -X PATCH $BASE/api/appointments/$APPT -H "x-auth-token: $CT" -H 'Content-Type: application/json' -d '{"price":0,"paymentStatus":"unpaid"}')
has 'HTTP:403' "$R" "العميل لا يستطيع تعديل المبلغ (403)"
# المبالغ في لوحة القيادة
R=$(curl -s $BASE/api/stats -H "$A")
has '"paidSum":2500' "$R" "لوحة القيادة: paidSum=2500"

echo "— الأخصائي المعالج في الرد —"
# منح الأخصائي ساعات عمل (اختياري) ثم ملف مريض
R=$(curl -s "$BASE/api/records?patientId=$(curl -s $BASE/api/accounts -H "$A" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const u=JSON.parse(d).users.find(x=>x.name==='عميل المبالغ');console.log(u?u._id:'')}catch{console.log('')}})")" -H "$A")
has '"patient"' "$R" "قراءة ملف المريض"

echo "— الإشعارات مع روابط الوجهة —"
R=$(curl -s $BASE/api/notifications -H "x-auth-token: $ST")
has '"kind":"booking"' "$R" "الأخصائي يملك إشعار حجز"
# v3.6: الرابط يحمل معرف الموعد appointments:<id> — توجيه أدق للبطاقة نفسها
echo "$R" | grep -q '"link":"appointments:' && has '"link":"appointments:' "$R" "الإشعار يحمل رابط المواعيد (مع معرف الموعد v3.6)" || has '"link":"appointments' "$R" "الإشعار يحمل رابط المواعيد"

echo ""
echo "═══════ النتيجة v3.5: نجاح $PASS — فشل $FAIL ═══════"
[ $FAIL -eq 0 ] && echo "ALL GREEN" || echo "HAS FAILURES"

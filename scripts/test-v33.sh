#!/bin/bash
# ═══════ اختبار شامل حقيقي v3.3.0 — عبر API على خادم مبني ═══════
# يغطي: الإدارة، التسجيل بعبارة استرجاع، الاسترجاع الفوري، الإعلانات كاملة،
# الإشعارات للإدارة، التكوينات والمقاعد، الصلاحيات، الترجمات، عدم تكسّر القديم
set -u
BASE="http://127.0.0.1:3000"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }
check(){ if [ "$1" = "$2" ]; then ok "$3"; else bad "$3 (expected=$2 got=$1)"; fi }
has(){ if echo "$2" | grep -q "$1"; then ok "$3"; else bad "$3"; fi }

echo "— health —"
H=$(curl -s $BASE/api/health)
has '"ok":true\|"ok": true\|db' "$H" "health"

echo "— بوابة الإدارة —"
R=$(curl -s -X POST $BASE/api/auth/admin-login -H 'Content-Type: application/json' -d '{"phone":"0542163526","password":"12345678"}')
ADMIN_TOKEN=$(echo "$R" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).token||'')}catch{console.log('')}})")
[ -n "$ADMIN_TOKEN" ] && ok "دخول الإدارة + توكن" || bad "دخول الإدارة"

echo "— التسجيل بعبارة استرجاع (عميل جديد) —"
PH="0599$(date +%s | tail -c 6)"
R=$(curl -s -X POST $BASE/api/auth/register -H 'Content-Type: application/json' -d "{\"name\":\"عميل الاسترجاع\",\"phone\":\"$PH\",\"password\":\"pass123\",\"recoveryPhrase\":\"my secret phrase 2026\"}")
has '"user"' "$R" "تسجيل عميل مع عبارة الاسترجاع"

echo "— عبارة الاسترجاع إلزامية —"
PH2="0598$(date +%s | tail -c 6)"
R=$(curl -s -X POST $BASE/api/auth/register -H 'Content-Type: application/json' -d "{\"name\":\"بلا عبارة\",\"phone\":\"$PH2\",\"password\":\"pass123\"}")
has 'عبارة الاسترجاع' "$R" "رفض التسجيل دون عبارة استرجاع"

echo "— الإشعار الترحيبي للعميل + إشعار الإدارة —"
R=$(curl -s $BASE/api/notifications -H "x-auth-token: $ADMIN_TOKEN")
has "عميل جديد انضم للمركز" "$R" "الإدارة تُبلَّغ بعميل جديد"

echo "— الاسترجاع الفوري (نمط طمأنينة) —"
R=$(curl -s -X POST $BASE/api/auth/recover -H 'Content-Type: application/json' -d "{\"phone\":\"$PH\",\"recoveryPhrase\":\"my secret phrase 2026\",\"newPassword\":\"newpass99\"}")
has '"token"' "$R" "استرجاع فوري + توكن مباشر"
R2=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "{\"phone\":\"$PH\",\"password\":\"newpass99\"}")
has '"token"' "$R2" "الدخول بالكلمة الجديدة فوراً"
R3=$(curl -s -X POST $BASE/api/auth/recover -H 'Content-Type: application/json' -d "{\"phone\":\"$PH\",\"recoveryPhrase\":\"wrong phrase x\",\"newPassword\":\"hacked99\"}")
has 'غير صحيحة' "$R3" "رفض عبارة خاطئة"
R=$(curl -s $BASE/api/notifications -H "x-auth-token: $ADMIN_TOKEN")
has "استرجاع حساب بعبارة الاسترجاع" "$R" "الإدارة تُبلَّغ بالاسترجاع الذاتي"

echo "— الإعلانات: إنشاء/نشر/عرض/إعجاب/تعليق/رد —"
R=$(curl -s -X POST $BASE/api/ads -H 'Content-Type: application/json' -H "x-auth-token: $ADMIN_TOKEN" -d '{"action":"create","title":"إعلان افتتاح التسجيل","body":"التسجيل مفتوح في تكوين التنشئة السمعية — المقاعد محدودة.","media":[],"float":true,"floatPerUser":3,"floatDays":7,"publish":true}')
has '"ad"' "$R" "إنشاء ونشر إعلان"
AD_ID=$(echo "$R" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).ad._id)}catch{console.log('')}})")
R=$(curl -s -X POST $BASE/api/ads -H 'Content-Type: application/json' -H "x-auth-token: $ADMIN_TOKEN" -d "{\"action\":\"create\",\"title\":\"مسودة داخلية\",\"body\":\"نص مسودة\",\"media\":[],\"publish\":false}")
has '"ad"' "$R" "إنشاء مسودة"
DRAFT_ID=$(echo "$R" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).ad._id)}catch{console.log('')}})")
R=$(curl -s "$BASE/api/ads")
has "إعلان افتتاح التسجيل" "$R" "الإعلان المنشور يظهر للجميع"
if echo "$R" | grep -q "مسودة داخلية"; then bad "المسودة يجب ألا تظهر للجميع"; else ok "المسودة مخفية عن الجميع"; fi
# إعجاب العميل
CL_TOKEN=$(echo "$R2" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).token||'')}catch{console.log('')}})")
R=$(curl -s -X POST $BASE/api/ads -H 'Content-Type: application/json' -H "x-auth-token: $CL_TOKEN" -d "{\"action\":\"like\",\"id\":\"$AD_ID\"}")
has '"likedByMe":true' "$R" "إعجاب العميل بالإعلان"
R=$(curl -s -X POST $BASE/api/ads -H 'Content-Type: application/json' -H "x-auth-token: $CL_TOKEN" -d "{\"action\":\"comment\",\"id\":\"$AD_ID\",\"text\":\"هل التكوين مسائي متاح؟\"}")
has '"sent":true' "$R" "تعليق العميل"
R=$(curl -s $BASE/api/notifications -H "x-auth-token: $ADMIN_TOKEN")
has "تعليق جديد على إعلان المركز" "$R" "الإدارة تُبلَّغ بالتعليق"
has "إعجاب جديد بإعلان المركز" "$R" "الإدارة تُبلَّغ بالإعجاب"
# رد الإدارة على التعليق
R=$(curl -s "$BASE/api/ads?staff=1" -H "x-auth-token: $ADMIN_TOKEN")
CI=$(echo "$R" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const a=JSON.parse(d).ads.find(x=>x.commentsCount>0);console.log(a?a._id+':'+a.comments[0].id:'')}catch{console.log('')}})")
AD2="${CI%%:*}"; CI2="${CI##*:}"
R=$(curl -s -X POST $BASE/api/ads -H 'Content-Type: application/json' -H "x-auth-token: $ADMIN_TOKEN" -d "{\"action\":\"comment-reply\",\"id\":\"$AD2\",\"commentIndex\":$CI2,\"text\":\"نعم، جلسة مسائية متاحة كل ثلاثاء\"}")
has '"ok":true\|ok' "$R" "رد الإدارة على التعليق"
R=$(curl -s "$BASE/api/ads")
has "جلسة مسائية متاحة" "$R" "الرد يظهر في العرض العمومي"
# حجب تعليق
R=$(curl -s -X POST $BASE/api/ads -H 'Content-Type: application/json' -H "x-auth-token: $ADMIN_TOKEN" -d "{\"action\":\"comment-hide\",\"id\":\"$AD2\",\"commentIndex\":$CI2,\"hidden\":true}")
has ok "$R" "حجب التعليق"
# منع غير المخوّل
R=$(curl -s -X POST $BASE/api/ads -H 'Content-Type: application/json' -d "{\"action\":\"create\",\"title\":\"تلاعب\",\"body\":\"محاولة\",\"media\":[],\"publish\":true}")
has 'غير\|401\|error' "$R" "منع الزوار من إنشاء إعلانات"
# الإعلان العائم
R=$(curl -s $BASE/api/ads/floating -H "x-auth-token: $CL_TOKEN")
has "إعلان افتتاح التسجيل" "$R" "الإعلان العائم يظهر للعميل"
R=$(curl -s $BASE/api/ads/floating -H "x-auth-token: $ADMIN_TOKEN")
if echo "$R" | grep -q "إعلان افتتاح"; then bad "الإعلان العائم لا يظهر للإدارة"; else ok "الإعلان العائم محجوب عن الإدارة"; fi

echo "— التكوينات: تسجيل + مقاعد + إشعار الإدارة —"
R=$(curl -s -X POST $BASE/api/courses -H 'Content-Type: application/json' -H "x-auth-token: $ADMIN_TOKEN" -d '{"title":"تكوين الاختبار","titleFr":"Formation test","titleEn":"Test course","description":"وصف","capacity":2,"active":true}')
COURSE_ID=$(echo "$R" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).course._id)}catch{console.log('')}})")
[ -n "$COURSE_ID" ] && ok "إنشاء تكوين بمقاعد=2" || bad "إنشاء تكوين"
R=$(curl -s -X POST "$BASE/api/courses/$COURSE_ID" -H "x-auth-token: $CL_TOKEN")
has '"enrolled":true' "$R" "تسجيل العميل في التكوين"
R=$(curl -s $BASE/api/notifications -H "x-auth-token: $ADMIN_TOKEN")
has "طلب تسجيل في تكوين" "$R" "الإدارة تُبلَّغ بطلب تسجيل التكوين"
R=$(curl -s -X POST "$BASE/api/courses/$COURSE_ID" -H "x-auth-token: $CL_TOKEN")
has 'مسبقاً' "$R" "منع التسجيل المزدوج"

echo "— طلب استعادة الأخصائي يصل للإدارة إشعاراً —"
R=$(curl -s -X POST $BASE/api/auth/forgot -H 'Content-Type: application/json' -d '{"phone":"0542163526"}')
has '"sent":true' "$R" "طلب الاستعادة يُسجل"
sleep 1
R=$(curl -s $BASE/api/notifications -H "x-auth-token: $ADMIN_TOKEN")
has "طلب استعادة كلمة مرور" "$R" "الإدارة تُبلَّغ بطلب استعادة (كان مفقوداً)"

echo "— الاقتراحات: إشعار الإدارة —"
R=$(curl -s -X POST $BASE/api/feedback -H 'Content-Type: application/json' -d '{"type":"suggestion","message":"اقتراح توسيع مواقيت المسائي","name":"زائر"}')
has '"sent":true' "$R" "إرسال اقتراح"
sleep 1
R=$(curl -s $BASE/api/notifications -H "x-auth-token: $ADMIN_TOKEN")
has "اقتراح جديد من الزوار" "$R" "الإدارة تُبلَّغ بالاقتراح"

echo "— الصلاحيات: عميل ممنوع من لوحة الإعلانات الإدارية —"
R=$(curl -s "$BASE/api/ads?staff=1" -H "x-auth-token: $CL_TOKEN")
has 'صلاحية\|403' "$R" "منع العميل من لوحة الإدارة"

echo ""
echo "═══════ النتيجة: نجاح $PASS — فشل $FAIL ═══════"
[ $FAIL -eq 0 ] && echo "ALL GREEN" || echo "HAS FAILURES"

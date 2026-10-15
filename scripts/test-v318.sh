#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# اختبار v3.18 — الوسائط المخزنة: فحص الاستخدام + الحماية + التنظيف
# 28 فحصاً فعلياً عبر API على خادم مبني
# ═══════════════════════════════════════════════════════════════════
set -u
BASE="http://127.0.0.1:3000"
PASS=0; FAIL=0
ck() { # ck <وصف> <المتوقع> <الفعلي>
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "✓ $1";
  else FAIL=$((FAIL+1)); echo "✗ $1 — متوقع: [$2] فعلي: [$3]"; fi
}
jget() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$2" 2>/dev/null; }

# ── صور اختبارية صغيرة (JPEG magic حقيقي) ──
python3 -c "import base64;open('/tmp/m1.jpg','wb').write(base64.b64decode('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDs0NDT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='))"
python3 -c "import base64;open('/tmp/m2.jpg','wb').write(base64.b64decode('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDs0NDT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='))"

# ═══ 1) الدخول: الإدارة ═══
ADMIN_TOKEN=$(curl -s -X POST "$BASE/api/auth/admin-login" -H 'Content-Type: application/json' \
  -d '{"phone":"0550000001","password":"Pass1234!"}' | jget - "d['token']")
ck "دخول الإدارة (توكن سليم)" "OK" "$([ "${#ADMIN_TOKEN}" -ge 40 ] && echo OK || echo NO)"
AH="x-auth-token: $ADMIN_TOKEN"

# ═══ 2) رفع وسائط ═══
UP1=$(curl -s -X POST "$BASE/api/media" -H "$AH" -F "file=@/tmp/m1.jpg;type=image/jpeg")
UP2=$(curl -s -X POST "$BASE/api/media" -H "$AH" -F "file=@/tmp/m2.jpg;type=image/jpeg")
IMG1=$(echo "$UP1" | jget - "d['url']")
IMG2=$(echo "$UP2" | jget - "d['url']")
N1=$(basename "$IMG1"); N2=$(basename "$IMG2")
ck "رفع img1" "/api/media/" "${IMG1:0:11}"
ck "رفع img2" "/api/media/" "${IMG2:0:11}"

# ═══ 3) القائمة: كلاهما غير مستخدم ═══
L=$(curl -s "$BASE/api/media" -H "$AH")
U1=$(echo "$L" | jget - "[f['used'] for f in d['files'] if f['name']=='$N1'][0]")
U2=$(echo "$L" | jget - "[f['used'] for f in d['files'] if f['name']=='$N2'][0]")
CNT=$(echo "$L" | jget - "d['stats']['count']")
ck "img1 يتيمة قبل الربط" "False" "$U1"
ck "img2 يتيمة" "False" "$U2"
ck "العدد ≥ 2" "OK" "$([ "$CNT" -ge 2 ] 2>/dev/null && echo OK || echo NO)"

# ═══ 4) ربط img1 بالسلايدر ═══
ST=$(curl -s "$BASE/api/settings" -H "$AH")
echo "$ST" | python3 -c "
import sys, json
d = json.load(sys.stdin)
s = d.get('settings') or d
s['sliderMedia'] = [{'type': 'image', 'url': '$IMG1', 'data': '', 'title': 'اختبار'}]
print(json.dumps(s))" > /tmp/settings-put.json
PUTC=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/settings" -H "$AH" -H 'Content-Type: application/json' -d @/tmp/settings-put.json)
ck "حفظ السلايدر" "200" "$PUTC"

L=$(curl -s "$BASE/api/media" -H "$AH")
U1=$(echo "$L" | jget - "[f['used'] for f in d['files'] if f['name']=='$N1'][0]")
K1=$(echo "$L" | jget - "','.join([f['usage'] for f in d['files'] if f['name']=='$N1'][0])")
ck "img1 مستخدمة بعد الربط" "True" "$U1"
ck "نوع الاستخدام = slider" "slider" "$K1"

# ═══ 5) الحماية: حذف المستخدم يُرفض ═══
D1=$(curl -s -o /tmp/d1.json -w "%{http_code}" -X DELETE "$BASE/api/media/$N1" -H "$AH")
ck "حذف img1 → 409" "409" "$D1"
ck "سبب الرفض MEDIA_IN_USE" "MEDIA_IN_USE" "$(cat /tmp/d1.json | jget - "d['error']")"
ck "موضع الاستخدام يُعاد" "slider" "$(cat /tmp/d1.json | jget - "','.join(d['usage'])")"

# ═══ 6) حذف اليتيمة ينجح ═══
D2=$(curl -s -X DELETE "$BASE/api/media/$N2" -H "$AH")
F2=$(echo "$D2" | jget - "d['freed']")
ck "حذف img2 → ok" "True" "$(echo "$D2" | jget - "d['ok']")"
ck "البايتات المحررة > 0" "OK" "$([ "${F2:-0}" -gt 0 ] 2>/dev/null && echo OK || echo NO)"

# ═══ 7) التدفق الحقيقي: موعد ← إتمام ← فاتورة تلقائية ═══
SPEC=$(curl -s -X POST "$BASE/api/accounts" -H "$AH" -H 'Content-Type: application/json' \
  -d '{"name":"أخصائي الوسائط","phone":"0550000091","password":"Pass1234!","role":"specialist","specialty":"psychological","weeklyHours":{"6":["10:00","11:00"]}}')
SPEC_ID=$(echo "$SPEC" | jget - "d['user']['_id']" 2>/dev/null || echo "$SPEC" | jget - "d['_id']")
ck "إنشاء أخصائي" "OK" "$([ "${#SPEC_ID}" -eq 24 ] && echo OK || echo NO)"
SRV=$(curl -s -X POST "$BASE/api/services" -H "$AH" -H 'Content-Type: application/json' \
  -d '{"title":"جلسة اختبار v318","price":1000,"durationMin":60,"icon":"✨"}')
SRV_ID=$(echo "$SRV" | jget - "d['service']['_id']" 2>/dev/null || echo "$SRV" | jget - "d['_id']")
ck "إنشاء خدمة" "24" "${#SRV_ID}"
REG=$(curl -s -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d '{"name":"عميل الفاتورة","phone":"0550000092","password":"Pass1234!","recoveryPhrase":"phrase123"}')
CT=$(echo "$REG" | jget - "d['token']")
ck "تسجيل عميل (توكن سليم)" "OK" "$([ "${#CT}" -ge 40 ] && echo OK || echo NO)"
APPT=$(curl -s -X POST "$BASE/api/appointments" -H "x-auth-token: $CT" -H 'Content-Type: application/json' \
  -d "{\"specialistId\":\"$SPEC_ID\",\"serviceId\":\"$SRV_ID\",\"date\":\"2026-10-17\",\"time\":\"10:00\",\"mode\":\"onsite\",\"price\":1000}")
APT_ID=$(echo "$APPT" | jget - "d['appointment']['_id']" 2>/dev/null || echo "$APPT" | jget - "d['_id']" 2>/dev/null || echo "$APPT" | jget - "d['id']")
ck "حجز موعد" "OK" "$([ "${#APT_ID}" -eq 24 ] && echo OK || echo NO)"
INV_STATUS=$(curl -s -o /tmp/inv.json -w "%{http_code}" -X PATCH "$BASE/api/appointments/$APT_ID" -H "$AH" -H 'Content-Type: application/json' -d '{"status":"completed"}')
ck "إتمام الموعد → فاتورة تلقائية" "200" "$INV_STATUS"
INV_FILE=$(cat /tmp/inv.json | jget - "d['invoice']['file']" 2>/dev/null || cat /tmp/inv.json | jget - "d['appointment']['invoiceFile']" 2>/dev/null)
ck "اسم ملف الفاتورة facture-" "OK" "$(case "$INV_FILE" in facture-*) echo OK;; *) echo NO;; esac)"

# ═══ 8) الفاتورة محمية تلقائياً ═══
L=$(curl -s "$BASE/api/media" -H "$AH")
KINV=$(echo "$L" | jget - "','.join([','.join(f['usage']) for f in d['files'] if f['name']=='$INV_FILE'])")
ck "الفاتورة usage = invoice" "invoice" "$KINV"

# ═══ 9) رفع يتيمة جديدة ثم التنظيف الشامل ═══
UP3=$(curl -s -X POST "$BASE/api/media" -H "$AH" -F "file=@/tmp/m1.jpg;type=image/jpeg")
N3=$(basename "$(echo "$UP3" | jget - "d['url']")")
CL=$(curl -s -X POST "$BASE/api/media/cleanup" -H "$AH")
DELN=$(echo "$CL" | jget - "','.join(x['name'] for x in d['deleted'])")
CLEAN_OK="NO"
echo "$DELN" | grep -q "$N3" && case "$DELN" in *"$N1"*|*"$INV_FILE"*) : ;; *) CLEAN_OK="OK" ;; esac
[ -z "$INV_FILE" ] && case "$DELN" in *"$N1"*) : ;; *) CLEAN_OK="OK" ;; esac
case "$DELN" in *"$N1"*) CLEAN_OK="NO" ;; esac
ck "التنظيف حذف اليتيمة فقط" "OK" "$CLEAN_OK"
FREED=$(echo "$CL" | jget - "d['freed']")
ck "المساحة المحررة > 0" "OK" "$([ "${FREED:-0}" -gt 0 ] 2>/dev/null && echo OK || echo NO)"

# ═══ 10) البث العام يعمل بعد كل شيء ═══
SRV_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/media/$N1")
ck "بث img1 عام 200" "200" "$SRV_CODE"
CC=$(curl -sI "$BASE/api/media/$N1" | grep -i "cache-control" | head -1)
ck "كاش الحافة سليم" "OK" "$(echo "$CC" | grep -q "s-maxage=31536000" && echo OK || echo NO)"

# ═══ 11) صلاحيات الأدوار ═══
ASST=$(curl -s -X POST "$BASE/api/accounts" -H "$AH" -H 'Content-Type: application/json' \
  -d '{"name":"مساعدة الوسائط","phone":"0550000093","password":"Pass1234!","role":"assistant"}')
AT=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"phone":"0550000093","password":"Pass1234!"}' | jget - "d['token']")
ck "إنشاء مساعدة + دخولها من البوابة العامة" "OK" "$([ "${#AT}" -ge 40 ] && echo OK || echo NO)"
AG=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/media" -H "x-auth-token: $AT")
ck "المساعدة تدخل القائمة" "200" "$AG"
CLIENT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/media" -H "x-auth-token: $CT")
ck "العميل مرفوض 403" "403" "$CLIENT_CODE"
ANON=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/media")
ck "مجهول مرفوض 401" "401" "$ANON"

# ═══ 12) انحدار سريع ═══
ck "/api/health" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/health")"
ck "الرئيسية" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")"
ck "الإعدادات العامة" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/settings")"
SL=$(curl -s "$BASE/api/settings" | jget - "len([m for m in (d.get('settings') or d).get('sliderMedia',[]) if m.get('url')])")
ck "السلايدر يعرض img1" "1" "$SL"

echo "══════════════════════════"
echo "النتيجة: $PASS ناجح — $FAIL فاشل"
exit $([ "$FAIL" = "0" ] && echo 0 || echo 1)

/**
 * scripts/test-fix-e11000.js — التحقق E2E من إصلاح خطأ E11000 عند تأكيد الحجز (v3.21.2)
 * السيناريو المُبلَّغ: فتحة فيها موعد مكتمل/ملغى تظهر متاحة في الواجهة
 * ثم يُقتل الحجز الجديد بخطأ MongoDB خام. الإصلاح = فهرس جزئي + مزامنة إقلاع + 409 ودّي.
 * الاستعمال: node scripts/test-fix-e11000.js  (الخادم يعمل على :3000)
 */
const BASE = "http://localhost:3000";
let PASS = 0, FAIL = 0;
const ok = (m) => { PASS++; console.log("  ✓ " + m); };
const bad = (m) => { FAIL++; console.log("  ✗ " + m); };

async function api(path, { method = "GET", token, body } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { "x-auth-token": token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = {};
  try { j = await r.json(); } catch {}
  return { status: r.status, j };
}

(async () => {
  console.log("── 1) المصادقة والتجهيز ──");
  const adm = await api("/api/auth/admin-login", { method: "POST", body: { phone: "0550000001", password: "Pass1234!" } });
  adm.j.token ? ok("دخول الإدارة") : bad("دخول الإدارة: " + JSON.stringify(adm.j));
  const T = adm.j.token;

  /* أرقام فريدة لكل تشغيل — تفادي بقايا تشغيل سابق على نفس القاعدة */
  const U = String(Date.now()).slice(-4);
  const spec = await api("/api/accounts", { method: "POST", token: T, body: { name: "د. أخصائي اختبار E11000", phone: `0557${U}001`, password: "spec12345", role: "specialist", specialty: "both", title: "أخصائي نفسي" } });
  const SPEC = spec.j.user?._id;
  SPEC ? ok("إنشاء أخصائي") : bad("إنشاء أخصائي: " + JSON.stringify(spec.j));

  /* غداً + توقيت 14:00 داخل ساعات الأخصائي */
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  const DATE = d.toISOString().slice(0, 10);
  const DOW = String(d.getDay());
  const wh = await api(`/api/accounts/${SPEC}`, { method: "PATCH", token: T, body: { weeklyHours: { [DOW]: ["09:00", "14:00", "16:00"] } } });
  wh.j.user || wh.j.ok ? ok(`ساعات الأخصائي (يوم ${DOW} يشمل 14:00)`) : bad("ساعات: " + JSON.stringify(wh.j));

  const regA = await api("/api/auth/register", { method: "POST", body: { name: "عميل أول", phone: `0557${U}002`, password: "client123", bloodType: "O+", recoveryPhrase: "عميل أول للاختبار" } });
  const TA = regA.j.token;
  regA.j.token ? ok("عميل أول (تسجيل ذاتي)") : bad("عميل أول: " + JSON.stringify(regA.j));
  const regB = await api("/api/auth/register", { method: "POST", body: { name: "عميل ثانٍ", phone: `0557${U}003`, password: "client123", bloodType: "A+", recoveryPhrase: "عميل ثان للاختبار" } });
  const TB = regB.j.token;
  TB ? ok("عميل ثانٍ") : bad("عميل ثانٍ: " + JSON.stringify(regB.j));

  const book = (token, extra = {}) =>
    api("/api/appointments", { method: "POST", token, body: { specialistId: SPEC, date: DATE, time: "14:00", serviceTitle: "استشارة نفسية عن بُعد", mode: "remote", price: 3000, ...extra } });

  console.log("── 2) السيناريو المُبلَّغ: حجز → إنهاء → إعادة الحجز لنفس الفتحة ──");
  const r1 = await book(TA, { notes: "الجلسة الأولى" });
  r1.status === 200 && r1.j.appointment ? ok("حجز أول عادي → pending") : bad("حجز أول: " + r1.status + " " + JSON.stringify(r1.j));
  const APPT = r1.j.appointment?._id;

  const done = await api(`/api/appointments/${APPT}`, { method: "PATCH", token: T, body: { status: "completed" } });
  done.j.appointment?.status === "completed" ? ok("إنهاء الجلسة (completed)") : bad("إنهاء: " + JSON.stringify(done.j));

  /* ★ الاختبار الحاسم — كان يُقتل بـ E11000 خام */
  const r2 = await book(TB, { notes: "حجز فوق موعد مكتمل — سيناريو التذكرة" });
  if (r2.status === 200 && r2.j.appointment) ok("★★ حجز فوق موعد مكتمل → نجح (كان E11000 خام)");
  else bad(`★★ الحسم فشل: ${r2.status} ${JSON.stringify(r1.j).slice(0, 200)}`);

  console.log("── 3) حماية الفتحة النشطة تبقى قائمة ──");
  const r3 = await book(TA);
  if (r3.status === 409 && String(r3.j.error || "").includes("محجوز") && !String(r3.j.error).includes("E11000"))
    ok("حجز فوق فتحة نشطة → 409 برسالة ودّية «محجوز» بلا خطأ DB");
  else bad("تعارض نشط: " + r3.status + " " + JSON.stringify(r3.j));

  console.log("── 4) الإلغاء يحرّر الفتحة ──");
  const APPT2 = r2.j.appointment?._id;
  const cancel = await api(`/api/appointments/${APPT2}`, { method: "PATCH", token: TB, body: { status: "cancelled" } });
  cancel.j.appointment?.status === "cancelled" ? ok("العميل الثاني ألغى حجزه") : bad("إلغاء: " + JSON.stringify(cancel.j));
  const r4 = await book(TA, { notes: "حجز فوق موعد ملغى" });
  r4.status === 200 && r4.j.appointment ? ok("★★ حجز فوق موعد ملغى → نجح") : bad("حجز فوق ملغى: " + r4.status + " " + JSON.stringify(r4.j));

  console.log("── 5) النقل إلى فتحة فيها مكتمل ──");
  /* حجز 16:00 (يصبح completed) ثم نقل موعد 09:00 غير موجود... نبسّط: أنشئ 16:00 ثم أكمله ثم انقل موعد TA (14:00) إلى 16:00 */
  const r5 = await api("/api/appointments", { method: "POST", token: TB, body: { specialistId: SPEC, date: DATE, time: "16:00", serviceTitle: "جلسة", price: 0 } });
  if (r5.status !== 200) { bad("تحضير 16:00: " + JSON.stringify(r5.j)); }
  else {
    const done2 = await api(`/api/appointments/${r5.j.appointment._id}`, { method: "PATCH", token: T, body: { status: "completed" } });
    const mv = await api(`/api/appointments/${r4.j.appointment._id}`, { method: "PATCH", token: T, body: { date: DATE, time: "16:00" } });
    mv.status === 200 && mv.j.appointment?.time === "16:00"
      ? ok("★★ نقل موعد إلى فتحة فيها مكتمل → نجح (كان سينفجر)")
      : bad("النقل: " + mv.status + " " + JSON.stringify(mv.j));
  }

  console.log("── 6) taken mode متسق ──");
  const tk = await api(`/api/appointments?mode=taken&specialistId=${SPEC}&date=${DATE}`, { token: T });
  const want = ["16:00"].sort().join(",");
  (tk.j.taken || []).join(",") === want ? ok(`taken=${want} (النشط فقط)`): bad("taken: " + JSON.stringify(tk.j));

  console.log(`\n═══ النتيجة: ${PASS} نجح / ${FAIL} فشل ═══`);
  process.exit(FAIL ? 1 : 0);
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });

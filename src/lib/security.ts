/**
 * حماية متقدمة (v3.8) — صد الهجمات على نقاط الدخول والكتابة
 * ─────────────────────────────────────────────────────────
 * 1) حجب محاولات الدخول المتكررة: 5 فشلات في 10 دقائق → حجب 15 دقيقة
 *    (لكل هاتف ولكل IP على حدة — تُفرغ تلقائياً بعد انقضاء الحجب)
 * 2) حد أدنى من الفاصل بين طلبات الكتابة الحساسة (صد السبام)
 * 3) نظّف المدخلات من محاولات الحقن الشهيرة ($gt, $ne, $where...)
 *
 * ملاحظة معمارية: العدادات في الذاكرة — تكفي لحماية خادم واحد
 * (نشر المركز حاليّاً خادم واحد؛ لو انتقل لسحابة موزعة تُنقل لـ Redis).
 */
import type { NextRequest } from "next/server";

type Attempt = { count: number; firstAt: number; blockedUntil: number };

const FAIL_LIMIT = 5; // عدد المحاولات المسموح لكل هاتف
const IP_FAIL_LIMIT = 20; // عتبة العنوان الواحد أعلى — لا تعاقب شبكة مشتركة (مكتب/مقهى)
const FAIL_WINDOW_MS = 10 * 60 * 1000; // نافذة العد: 10 دقائق
const BLOCK_MS = 15 * 60 * 1000; // مدة الحجب: 15 دقيقة

const loginFails = new Map<string, Attempt>();
const lastWrite = new Map<string, number>();

/* تنظيف دوري للذاكرة — كل 10 دقائق */
function gc() {
  const now = Date.now();
  for (const [k, v] of loginFails) {
    if (now - v.firstAt > FAIL_WINDOW_MS && v.blockedUntil < now) loginFails.delete(k);
  }
  for (const [k, t] of lastWrite) if (now - t > 60_000) lastWrite.delete(k);
}
setInterval(gc, 10 * 60 * 1000).unref?.();

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

function nowClean(a: Attempt): boolean {
  return Date.now() - a.firstAt > FAIL_WINDOW_MS;
}

/** هل هذا الهاتف/العنوان محجوب الآن؟ يرجع ثواني الحجب المتبقية (0 = غير محجوب) */
export function loginBlockRemaining(phone: string, ip: string): number {
  const now = Date.now();
  for (const key of [`phone:${phone}`, `ip:${ip}`]) {
    const a = loginFails.get(key);
    if (a && a.blockedUntil > now) return Math.ceil((a.blockedUntil - now) / 1000);
  }
  return 0;
}

/** تسجيل فشل دخول — يعيد true إذا أُطلق الحجب الآن */
export function recordLoginFail(phone: string, ip: string): boolean {
  const now = Date.now();
  let launched = false;
  /* الهاتف: 5 فشلات → حجب */
  const pKey = `phone:${phone}`;
  const pa = loginFails.get(pKey) || { count: 0, firstAt: now, blockedUntil: 0 };
  if (nowClean(pa)) {
    pa.count = 0;
    pa.firstAt = now;
  }
  pa.count += 1;
  if (pa.count >= FAIL_LIMIT) {
    pa.blockedUntil = now + BLOCK_MS;
    launched = true;
  }
  loginFails.set(pKey, pa);
  /* العنوان: 20 فشلاً → حجب (صد الهجمات الآلية دون الإضرار بالمستخدمين المشتركين) */
  const iKey = `ip:${ip}`;
  const ia = loginFails.get(iKey) || { count: 0, firstAt: now, blockedUntil: 0 };
  if (nowClean(ia)) {
    ia.count = 0;
    ia.firstAt = now;
  }
  ia.count += 1;
  if (ia.count >= IP_FAIL_LIMIT) {
    ia.blockedUntil = now + BLOCK_MS;
    launched = true;
  }
  loginFails.set(iKey, ia);
  return launched;
}

/** مسح فشلات الهاتف بعد نجاح الدخول */
export function clearLoginFails(phone: string, ip: string): void {
  loginFails.delete(`phone:${phone}`);
  /* IP يُمسك فقط إن لم يشاركه مستخدمون آخرون نشطون — نسكت عنه هنا للبساطة */
  void ip;
}

/** حد معدل الكتابة: الأدنى فاصل بين طلبين حساسين من نفس المصدر (milliseconds) */
export function writeThrottled(req: NextRequest, minGapMs = 800): boolean {
  const key = clientIp(req);
  const now = Date.now();
  const last = lastWrite.get(key) || 0;
  if (now - last < minGapMs) return true; // مُخنق
  lastWrite.set(key, now);
  return false;
}

/** تنظيف مدخلات المستخدم من أنماط حقن MongoDB المشهورة */
export function sanitizeInput(v: unknown): string {
  const s = String(v ?? "");
  /* يمنع معاملات MongoDB داخل النص ($gt, $ne, $where...) — تُحفظ كنص فقط */
  return s.replace(/\$\w+/g, "").slice(0, 5000);
}

/** كلمات مرور قوية — تُفحص عند التسجيل وتغيير كلمة المرور */
export function passwordIssues(pw: string): string[] {
  const issues: string[] = [];
  if (pw.length < 8) issues.push("length");
  if (!/[A-Za-z]/.test(pw)) issues.push("letter");
  if (!/[0-9]/.test(pw)) issues.push("digit");
  return issues;
}

/**
 * مركز أيت تقرين — المصادقة (نمط طمأنينة الموثوق)
 * توكن HMAC-SHA256 في الهيدر x-auth-token — بلا كوكيز إطلاقاً
 * (الكوكيز تُحجب داخل iframe/المعاينة على الأجهزة → مصدر أخطاء 401 المتكررة سابقاً)
 *
 * - التسجيل: POST login → { ok, user, token } → يحفظ الواجهة التوكن في localStorage
 * - كل طلب API يُرفق الهيدر x-auth-token → requireUser يتحقق منه مركزياً
 * - التحقق: توقيع HMAC + صلاحية + تحميل المستخدم من DB + فحص active والدور
 */
import { headers } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "./mongo";
import { User, type UserDoc } from "./models";
import { mapToObj } from "./map";

export const TOKEN_HEADER = "x-auth-token";
const TOKEN_TTL_MS = 30 * 86400_000; // 30 يوماً

export type SafeUser = {
  _id: string;
  name: string;
  phone: string;
  role: "admin" | "assistant" | "specialist" | "trainer" | "client";
  specialty?: "psychological" | "art_therapy" | "both";
  langs: string[];
  title: string;
  titleFr?: string;
  titleEn?: string;
  bio: string;
  bioFr?: string;
  bioEn?: string;
  yearsExperience: number;
  specialties: string[];
  /** ★ v3.12: الخدمات التي يجيدها الأخصائي (معرفات) */
  serviceIds: string[];
  photoBase64: string;
  weeklyHours: Record<string, string[]>;
  assignedSpecialistId: string | null;
  active: boolean;
};

export function toSafeUser(u: UserDoc): SafeUser {
  /* weeklyHours قد تعود Map (mongoose) أو كائناً عادياً (lean) — نتعامل مع الحالتين */
  const rawWH: unknown = u.weeklyHours;
  let weeklyHours: Record<string, string[]> = {};
  weeklyHours = mapToObj(rawWH) as Record<string, string[]>;
  /* التخصصات: مراجع أوبجكت آيدية → نصوص */
  let specIds: string[] = [];
  const rawSpecs: unknown = (u as { specialties?: unknown }).specialties;
  if (Array.isArray(rawSpecs)) {
    specIds = rawSpecs.map((s) => (s && typeof s === "object" && "_id" in (s as object) ? String((s as { _id: unknown })._id) : String(s)));
  }
  /* ★ v3.12: الخدمات المرتبطة بالأخصائي — مراجع أوبجكت آيدية → نصوص */
  let svcIds: string[] = [];
  const rawSvcs: unknown = (u as { serviceIds?: unknown }).serviceIds;
  if (Array.isArray(rawSvcs)) {
    svcIds = rawSvcs.map((s) => (s && typeof s === "object" && "_id" in (s as object) ? String((s as { _id: unknown })._id) : String(s)));
  }
  return {
    _id: String(u._id),
    name: u.name,
    phone: u.phone,
    role: u.role,
    specialty: u.specialty ?? undefined,
    langs: u.langs ?? ["ar"],
    title: u.title ?? "",
    titleFr: (u as { titleFr?: string }).titleFr ?? "",
    titleEn: (u as { titleEn?: string }).titleEn ?? "",
    bio: u.bio ?? "",
    bioFr: (u as { bioFr?: string }).bioFr ?? "",
    bioEn: (u as { bioEn?: string }).bioEn ?? "",
    yearsExperience: (u as { yearsExperience?: number }).yearsExperience ?? 0,
    specialties: specIds,
    serviceIds: svcIds,
    photoBase64: u.photoBase64 ?? "",
    weeklyHours,
    assignedSpecialistId: u.assignedSpecialistId ? String(u.assignedSpecialistId) : null,
    active: u.active ?? true,
  };
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(plain, hash);
  } catch {
    return false;
  }
}

/* ─────────── عبارة الاسترجاع (نمط طمأنينة) ───────────
 * تُخزَّن SHA-256 + ملح عشوائي — لا تُرسل أبداً للواجهة.
 * العميل يسجّلها عند إنشاء الحساب ويستعيد حسابه بها فورياً. */

export function hashSecret(secret: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHash("sha256").update(`${salt}::${secret.trim()}`).digest("hex");
  return { hash, salt };
}

export function verifySecret(secret: string, hash?: string | null, salt?: string | null): boolean {
  if (!hash || !salt) return false;
  try {
    const candidate = crypto.createHash("sha256").update(`${salt}::${String(secret || "").trim()}`).digest("hex");
    const a = Buffer.from(candidate);
    const b = Buffer.from(String(hash));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/* ─────────── توكن HMAC (نمط طمأنينة) ─────────── */

function tokenSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.ADMIN_PASSCODE ||
    process.env.VAPID_SUBJECT ||
    "ait-tegrine-center-secret"
  );
}

function hmac(payload: string): string {
  return crypto.createHmac("sha256", tokenSecret()).update(payload).digest("base64url");
}

/** إصدار توكن موقّع للمستخدم */
export function issueToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: String(userId), exp: Date.now() + TOKEN_TTL_MS })
  ).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

/** التحقق من التوكن — يرجع userId أو null */
export function verifyToken(token: string): string | null {
  try {
    if (!token || !token.includes(".")) return null;
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = hmac(payload);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      uid?: string;
      exp?: number;
    };
    if (!parsed.uid || !parsed.exp || parsed.exp < Date.now()) return null;
    return String(parsed.uid);
  } catch {
    return null;
  }
}

/** قراءة التوكن من الهيدرات (x-auth-token أو Authorization Bearer) */
async function tokenFromHeaders(): Promise<string> {
  const h = await headers();
  const direct = h.get(TOKEN_HEADER);
  if (direct) return direct.trim();
  const auth = h.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return "";
}

/** المستخدم الحالي (أو null) — من توكن الهيدر */
export async function currentUser(): Promise<UserDoc | null> {
  try {
    const token = await tokenFromHeaders();
    if (!token) return null;
    const uid = verifyToken(token);
    if (!uid) return null;
    await connectDB();
    const u = await User.findById(uid).lean<UserDoc | null>();
    if (!u || u.active === false) return null;
    return u;
  } catch {
    return null;
  }
}

export type Role = "admin" | "assistant" | "specialist" | "trainer" | "client";

/** ★ v3.11: أدوار الطاقم الإكلينيكي (يستقبلون مواعيد): الأخصائي فقط — المكوّن لا يستقبل مواعيد */
export function isClinical(role: string): boolean {
  return role === "specialist";
}

/** ★ v3.11: أدوار الطاقم الكاملة (أدمين/مساعد/أخصائي/مكوّن) */
export function isCrew(role: string): boolean {
  return role === "admin" || role === "assistant" || role === "specialist" || role === "trainer";
}

/** حارس صلاحيات: يرمي Response جاهزاً عند عدم التخويل */
export async function requireUser(roles?: Role[]): Promise<UserDoc> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "انتهت الجلسة — سجّل الدخول من جديد");
  if (roles && !roles.includes(u.role)) throw new HttpError(403, "لا تملك صلاحية لهذا الإجراء");
  return u;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** هل المستخدم من فريق الإدارة (أدمين/مساعد) */
export function isStaff(role: string): boolean {
  return role === "admin" || role === "assistant";
}

/* ─── توافق مع بوابة الإدارة (admin-login): جلسة = توكن HMAC ─── */
export async function createSession(userId: string): Promise<string> {
  return issueToken(userId);
}

export async function destroySession(_token?: string): Promise<void> {
  /* التوكن موقّع ذاتياً بلا حالة — الخروج يمسحه من العميل فقط */
}

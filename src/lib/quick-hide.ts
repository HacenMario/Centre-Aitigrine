/**
 * مركز أيت تقرين — الإخفاء السريع (نمط طمأنينة)
 * ─────────────────────────────────────────────────
 * طبقة خصوصية محلية بالكامل: 3 ضغطات سريعة على شعار المركز
 * (أو زر «إخفاء سريع» في القائمة) تخفي كل شيء فوراً خلف حاسبة
 * حقيقية تعمل فعلاً، والعودة بإدخال الرمز السري ثم «=».
 *
 * - الرمز يُحفظ مشفّراً (SHA-256) في localStorage الجهاز فقط — لا يُرسل لأي خادم.
 * - حالة الاختباء في sessionStorage: تبقى عند تحديث الصفحة،
 *   وتنتهي بإغلاق التبويب (فتح تبويب جديد = منفذ طوارئ طبيعي إن نُسي الرمز).
 */

const CFG_KEY = "ait_quickhide";
const HIDDEN_KEY = "ait_quickhide_hidden";

export interface QuickHideConfig {
  enabled: boolean;
  hash: string | null;
}

/** SHA-256 تنفيذ خالص بجافاسكربت — يعمل حتى على HTTP (بلا crypto.subtle) */
function sha256Hex(ascii: string): string {
  const rightRotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = "";
  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += "\x80";
  while ((ascii.length % 64) - 56) ascii += "\x00";
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return ""; // ASCII فقط — النص يُحوَّل قبل الاستدعاء
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash[(i + 7) % 8] = (hash[(i + 7) % 8] + temp1) | 0;
      hash[3] = (hash[3] + temp1) | 0;
      hash[0] = (temp1 + temp2) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

/** تحويل النص (يدعم UTF-8) إلى بايتات ASCII آمنة قبل التجزئة */
function toUtf8BytesHex(input: string): string {
  const bytes: number[] = [];
  const data = new TextEncoder().encode(input);
  for (const b of data) bytes.push(b);
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

/** SHA-256 للرمز السري — يعمل في كل البيئات (HTTPS وHTTP) */
export async function hashPin(pin: string): Promise<string> {
  const payload = `ait-tegrine-quickhide::${pin}`;
  /* المحاولة الأولى: Web Crypto في السياقات الآمنة (HTTPS/localhost) */
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    /* سقوط تلقائي للتنفيذ الخالص */
  }
  return sha256Hex(toUtf8BytesHex(payload));
}

export function getQuickHideConfig(): QuickHideConfig {
  if (typeof window === "undefined") return { enabled: false, hash: null };
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (!raw) return { enabled: false, hash: null };
    const parsed = JSON.parse(raw) as Partial<QuickHideConfig>;
    return { enabled: !!parsed.enabled && !!parsed.hash, hash: parsed.hash || null };
  } catch {
    return { enabled: false, hash: null };
  }
}

/** تفعيل/تعطيل الإخفاء السريع — التفعيل يتطلب رمزاً من 4–8 أرقام */
export async function saveQuickHideConfig(enabled: boolean, pin?: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!enabled) {
    localStorage.removeItem(CFG_KEY);
    return;
  }
  if (!pin || !/^\d{4,8}$/.test(pin)) throw new Error("PIN_INVALID");
  const hash = await hashPin(pin);
  localStorage.setItem(CFG_KEY, JSON.stringify({ enabled: true, hash }));
}

export function isHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function setHidden(hidden: boolean): void {
  try {
    if (hidden) sessionStorage.setItem(HIDDEN_KEY, "1");
    else sessionStorage.removeItem(HIDDEN_KEY);
  } catch {
    /* وضع التصفح الخاص — الاختباء يعمل للجلسة الحالية فقط */
  }
}

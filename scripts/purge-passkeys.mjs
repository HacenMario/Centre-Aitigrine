/**
 * ★ v3.25.1 — منظّف مخلفات مفاتيح المرور (Passkeys/WebAuthn) — يُنفَّذ تلقائياً قبل كل بناء
 * (npm run build يشغّل prebuild أولاً — يعمل على Vercel وRailway وكل بيئة npm)
 *
 * الغاية الجذرية: عند دمج نسخة جديدة فوق مستودع قديم (GitHub → Vercel/Railway) تبقى
 * الملفات المحذوفة في النسخ القديمة موجودة في المستودع (الحذف لا ينتقل بالاستبدال)،
 * فيفشل البناء على import لا وجود له. هذا السكربت يزيل كل ملف/مجلد عتيق يخص
 * passkeys قبل تشغيل next build — فيمضي البناء دائماً أيّاً كانت حالة المستودع.
 *
 * الأمان: يمسح داخل src/ وapp/ حصراً، بالاسم المطابق فقط (passkey/webauthn)،
 * ولا يلمس أي ملف آخر ولا إعدادات ولا تبعيات.
 */
import { rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const NAME_RE = /passkey|webauthn/i;
/* مسارات معروفة من النسخ القديمة (v3.24.2 وأسبق) */
const EXACT = [
  "src/lib/passkey.ts",
  "src/lib/passkey.js",
  "src/lib/passkey.jsx",
  "src/app/api/auth/passkey",
  "src/components/views/passkeys.tsx",
  "src/components/passkeys.tsx",
];
/* الجذور المسموح مسحها — لا شيء خارجها يُلمس إطلاقاً */
const ROOTS = ["src", "app"];

let removed = 0;
const rm = (p) => {
  rmSync(p, { recursive: true, force: true });
  removed++;
  console.log(`purge-passkeys: أُزيل الملف العتيق ${p}`);
};

for (const p of EXACT) if (existsSync(p)) rm(p);

const walk = (dir) => {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const n of entries) {
    const p = join(dir, n);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (NAME_RE.test(n)) rm(p);
      else walk(p);
    } else if (NAME_RE.test(n)) {
      rm(p);
    }
  }
};

for (const r of ROOTS) if (existsSync(r)) walk(r);

console.log(
  removed
    ? `purge-passkeys: أُزيل ${removed} عنصر عتيق — البناء يتابع نظيفاً ✓`
    : "purge-passkeys: المشروع نظيف — لا مخلفات passkeys ✓"
);

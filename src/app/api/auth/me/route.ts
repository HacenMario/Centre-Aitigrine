/** GET: بياناتي — PATCH: تعديل الملف الشخصي وتغيير كلمة المرور */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { User } from "@/lib/models";
import { hashPassword, requireUser, toSafeUser, verifyPassword } from "@/lib/auth";
import { normalizeBloodType } from "@/lib/blood";

export async function GET() {
  return handle(async () => {
    const u = await requireUser();
    return ok({ user: toSafeUser(u) });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { oldPass, newPass, name, bio, title, langs, photoBase64, phone, bloodType, birthDate, age, gender } = body;

    const $set: Record<string, unknown> = {};
    const $unset: Record<string, string> = {};

    if (oldPass !== undefined || newPass !== undefined) {
      if (!oldPass || !newPass) return fail(400, "أدخل كلمة المرور الحالية والجديدة");
      if (String(newPass).length < 6) return fail(400, "كلمة المرور الجديدة قصيرة (6 أحرف على الأقل)");
      if (!verifyPassword(String(oldPass), me.passwordHash)) return fail(400, "كلمة المرور الحالية غير صحيحة");
      $set.passwordHash = hashPassword(String(newPass));
    }
    if (name) $set.name = String(name).trim();
    if (bio !== undefined) $set.bio = String(bio);
    if (title !== undefined) $set.title = String(title);
    if (Array.isArray(langs)) $set.langs = langs.map(String);
    if (typeof photoBase64 === "string" && photoBase64) $set.photoBase64 = photoBase64;
    else if (photoBase64 === "") $unset.photoBase64 = "";

    /* ★ v3.10: حفظ رقم الهاتف الحقيقي — يلزم حسابات Google (بدل الصيغة الداخلية g-<sub>)
       تحقق شامل: أرقام فقط 9-15 مع تطبيع المسافات + فحص التفرد (الهاتف فريد في القاعدة) */
    if (phone !== undefined) {
      const cleaned = String(phone).replace(/[\s.\-()]/g, "").trim();
      if (!/^\+?\d{9,15}$/.test(cleaned))
        return fail(400, "رقم الهاتف غير صحيح — أدخل 9 إلى 15 رقماً (مثال: 0555000111)");
      /* تطبيع جزائري شائع: 00213… → 0… / +213… → 0… */
      let normalized = cleaned;
      if (normalized.startsWith("+213")) normalized = "0" + normalized.slice(4);
      else if (normalized.startsWith("00213")) normalized = "0" + normalized.slice(5);
      if (normalized.startsWith("213") && normalized.length === 12) normalized = "0" + normalized.slice(3);
      const dup = await User.findOne({ phone: normalized, _id: { $ne: me._id } }).lean().catch(() => null);
      if (dup) return fail(409, "رقم الهاتف مستعمل مسبقاً بحساب آخر");
      $set.phone = normalized;
    }

    /* ★ v3.19: زمرة الدم — تُقبل ذاتياً فقط في نافذة إكمال حساب Google (الهاتف لا يزال g-<sub>)
       أي «إنشاء حساب عميل»؛ بعد اكتمال الملف يصبح التعديل من الإدارة/المساعد/الأخصائي المعالج حصراً */
    if (bloodType !== undefined) {
      const isGoogleCompletion = /^g-[A-Za-z0-9_-]{6,}$/.test(String(me.phone || ""));
      if (!isGoogleCompletion || me.role !== "client")
        return fail(403, "تعديل زمرة الدم يتم من الإدارة أو المساعد أو الأخصائي المعالج");
      try {
        $set.bloodType = normalizeBloodType(bloodType);
      } catch {
        return fail(400, "زمرة الدم غير صحيحة — اختر إحدى الفصائل الثماني");
      }
      if (!$set.bloodType) return fail(400, "زمرة الدم إلزامية عند إنشاء الحساب");
    }

    /* ★ v3.24.2: تاريخ الميلاد بدل السن اليدوي — يعدّله العميل من ملفه في أي وقت،
       والسن تُحسب لحظياً عند كل قراءة فيتحدّث عرضها ذاتياً كل سنة (ولا حاجة لأي تحديث يدوي) */
    if (birthDate !== undefined || age !== undefined || gender !== undefined) {
      if (me.role !== "client")
        return fail(403, "بيانات العميل (تاريخ الميلاد والجنس) تُضبط في حسابات العملاء فقط");
      if (birthDate !== undefined) {
        const bd = String(birthDate || "").trim();
        if (bd === "") {
          $set.birthDate = "";
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(bd)) {
          $set.birthDate = bd;
        } else {
          return fail(400, "تاريخ الميلاد غير صحيح — الصيغة يوم/شهر/سنة كاملة");
        }
      }
      if (age !== undefined) {
        const n = Number(age);
        $set.age = age === null || age === "" || !Number.isFinite(n) ? null : Math.max(0, Math.min(120, Math.round(n)));
      }
      if (gender !== undefined) {
        $set.gender = gender === "male" || gender === "female" ? gender : null;
      }
    }

    if (!Object.keys($set).length && !Object.keys($unset).length)
      return ok({ user: toSafeUser(me) });

    const u = await User.findOneAndUpdate(
      { _id: me._id },
      Object.keys($unset).length ? { $set, $unset } : { $set },
      { new: true }
    ).lean();
    return ok({ user: u ? toSafeUser(u) : toSafeUser(me) });
  });
}

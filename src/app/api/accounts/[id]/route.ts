/** تعديل/حذف/تفعيل حساب — الإدارة فقط (المساعد يفعّل/يعطّل فقط)
 * ★ v3.8: سجل تدقيق لكل تعديل أو حذف حساب
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Service, Specialty, User } from "@/lib/models";
import { hashPassword, requireUser, toSafeUser } from "@/lib/auth";
import { normalizeBloodType } from "@/lib/blood";
import { logAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await requireUser(["admin", "assistant"]);
    const { id } = await ctx.params;
    const target = await User.findById(id).lean<{ active?: boolean; role?: string } | null>();
    if (!target) return fail(404, "الحساب غير موجود");
    const b = await req.json().catch(() => ({}));
    /* ★ v3.19: زمرة الدم لحسابات العملاء فقط (مواصفة الميزة)
       ★ v3.21.2: إصلاح إنذار كاذب كان يمنع حفظ مواقيت توفر الأخصائي — نموذج تعديل
       الحسابات يرسل الكائن كاملاً فيحمل bloodType:null دائماً (من toSafeUser) رغم أن
       الحقل لا يظهر في إعدادات الأخصائي؛ على غير العميل: الفراغ = لا عملية → يُتجاهل
       بهدوء، والقيمة الفعلية تُرفض كما هي حصرياً للعملاء. */
    const isBloodValue = (v: unknown) => !(v === null || v === "" || v === "none");
    /* ★ v3.24.1: نفس منطق زمرة الدم للحقول المخصصة لدور واحد — نموذج تعديل الحسابات يرسل
       الكائن كاملاً فيحمل سن/جنس/نظام الأجر الرمزي دائماً (من toSafeUser) رغم أن الحقل
       لا يظهر لغير دور هدفه؛ على غير الهدف: الفراغ/القيمة الرمزية = لا عملية → تجاهل هادئ،
       والقيمة الفعلية وحدها تُرفض برسالة النطاق الصحيحة. */
    const isAgeValue = (v: unknown) => !(v === null || v === "" || v === undefined);
    const isGenderValue = (v: unknown) => v === "male" || v === "female";

    /* المساعد: يغيّر التفعيل فقط + ★ v3.19: إضافة/تعديل زمرة الدم لحساب العميل */
    if (me.role === "assistant") {
      const $setA: Record<string, unknown> = {};
      if (typeof b.active === "boolean") $setA.active = b.active;
      if (b.bloodType !== undefined) {
        if (target.role !== "client") {
          if (isBloodValue(b.bloodType)) return fail(400, "زمرة الدم تُضبط لحسابات العملاء فقط");
        } else {
          try {
            $setA.bloodType = normalizeBloodType(b.bloodType);
          } catch {
            return fail(400, "زمرة الدم غير صحيحة — اختر إحدى الفصائل الثماني");
          }
        }
      }
      /* ★ v3.24.2: تاريخ الميلاد الكامل — للمساعد أيضاً على حسابات العملاء (نفس نمط التسامح) */
      if (b.birthDate !== undefined) {
        const bd = String(b.birthDate || "").trim();
        if (target.role !== "client") {
          if (bd) return fail(400, "تاريخ الميلاد يُضبط لحسابات العملاء فقط");
        } else if (bd === "") {
          $setA.birthDate = "";
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(bd)) {
          $setA.birthDate = bd;
        } else {
          return fail(400, "تاريخ الميلاد غير صحيح — الصيغة يوم/شهر/سنة كاملة");
        }
      }
      /* ★ v3.24: سن وجنس العميل — للمساعد أيضاً على حسابات العملاء
         ★ v3.24.1: على غير العميل — الفراغ يُتجاهل بهدوء والقيمة الفعلية وحدها تُرفض */
      if (b.age !== undefined) {
        if (target.role !== "client") {
          if (isAgeValue(b.age)) return fail(400, "سن العميل يُضبط لحسابات العملاء فقط");
        } else {
          const n = Number(b.age);
          $setA.age = b.age === null || b.age === "" || !Number.isFinite(n) ? null : Math.max(0, Math.min(120, Math.round(n)));
        }
      }
      if (b.gender !== undefined) {
        if (target.role !== "client") {
          if (isGenderValue(b.gender)) return fail(400, "جنس العميل يُضبط لحسابات العملاء فقط");
        } else {
          $setA.gender = isGenderValue(b.gender) ? b.gender : null;
        }
      }
      if (!Object.keys($setA).length) return fail(403, "المساعد يغيّر التفعيل وزمرة الدم وبيانات العميل الأساسية فقط");
      const u = await User.findByIdAndUpdate(id, { $set: $setA }, { new: true }).lean();
      if ($setA.bloodType !== undefined) {
        await logAudit(
          { _id: me._id, name: me.name, role: me.role },
          "accounts.blood",
          `حساب: ${(u as { name?: string; phone?: string } | null)?.name || id}`,
          `زمرة الدم: ${String($setA.bloodType || "حذف")}`,
          id
        );
      }
      return ok({ user: u ? toSafeUser(u) : null });
    }

    /* الإدارة: تعديل شامل — findOneAndUpdate (u.save لا يحفظ تعيين Map بشكل موثوق) */
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, string> = {};
    if (b.name !== undefined) $set.name = String(b.name).trim();
    if (b.phone !== undefined) $set.phone = String(b.phone).trim();
    if (b.password) $set.passwordHash = hashPassword(String(b.password));
    if (b.role && ["admin", "assistant", "specialist", "trainer", "client"].includes(b.role)) $set.role = b.role;
    if (b.specialty !== undefined) $set.specialty = b.specialty;
    if (Array.isArray(b.langs)) $set.langs = b.langs.map(String);
    if (b.title !== undefined) $set.title = String(b.title);
    if (b.titleFr !== undefined) $set.titleFr = String(b.titleFr);
    if (b.titleEn !== undefined) $set.titleEn = String(b.titleEn);
    if (b.bio !== undefined) $set.bio = String(b.bio);
    if (b.bioFr !== undefined) $set.bioFr = String(b.bioFr);
    if (b.bioEn !== undefined) $set.bioEn = String(b.bioEn);
    if (b.yearsExperience !== undefined)
      $set.yearsExperience = Math.max(0, Math.min(70, Math.round(Number(b.yearsExperience) || 0)));
    if (b.specialties !== undefined) {
      /* مراجع تخصصات — نتحقق من وجودها ثم نجمع */
      const ids = Array.isArray(b.specialties) ? b.specialties.map(String).filter(Boolean) : [];
      const valid = await Specialty.find({ _id: { $in: ids } }).select("_id").lean<{ _id: unknown }[]>();
      $set.specialties = valid.map((s) => String(s._id));
    }
    /* ★ v3.12: الخدمات التي يجيدها الأخصائي — تحقق من وجودها ثم نجمع */
    if (b.serviceIds !== undefined) {
      const ids = Array.isArray(b.serviceIds) ? b.serviceIds.map(String).filter(Boolean) : [];
      const valid = ids.length
        ? await Service.find({ _id: { $in: ids } }).select("_id").lean<{ _id: unknown }[]>()
        : [];
      $set.serviceIds = valid.map((s) => String(s._id));
    }
    if (typeof b.photoBase64 === "string" && b.photoBase64) $set.photoBase64 = b.photoBase64;
    else if (b.photoBase64 === "") $unset.photoBase64 = "";
    if (b.weeklyHours !== undefined) $set.weeklyHours = b.weeklyHours;
    if (b.assignedSpecialistId !== undefined) $set.assignedSpecialistId = b.assignedSpecialistId || null;
    /* ★ v3.23: نسبة الأخصائي من كل جلسة (%) — للإدارة على حسابات الأخصائيين
       ★ v3.24.1: على غير الأخصائي — الصفر الرمزي يُتجاهل بهدوء والقيمة الفعلية وحدها تُرفض */
    if (b.commissionRate !== undefined) {
      const n = Math.max(0, Math.min(100, Math.round(Number(b.commissionRate) || 0)));
      if (target.role !== "specialist") {
        if (n > 0) return fail(400, "نسبة الأخصائي تُضبط لحسابات الأخصائيين فقط");
      } else {
        $set.commissionRate = n;
      }
    }
    /* ★ v3.24: نظام أجر الأخصائي — عمولة لكل جلسة أو راتب شهري ثابت عبر الموارد البشرية
       ★ v3.24.1: على غير الأخصائي — القيمة الرمزية commission تُتجاهل بهدوء */
    if (b.payModel !== undefined) {
      if (target.role !== "specialist") {
        if (b.payModel === "salary") return fail(400, "نظام الأجر يُضبط لحسابات الأخصائيين فقط");
      } else {
        $set.payModel = b.payModel === "salary" ? "salary" : "commission";
      }
    }
    if (b.salaryAmount !== undefined) {
      const n = Math.max(0, Math.round(Number(b.salaryAmount) || 0));
      if (target.role !== "specialist") {
        if (n > 0) return fail(400, "الراتب الثابت يُضبط لحسابات الأخصائيين فقط");
      } else {
        $set.salaryAmount = n;
      }
    }
    /* ★ v3.24.2: تاريخ الميلاد الكامل — للإدارة على حسابات العملاء (نفس نمط التسامح) */
    if (b.birthDate !== undefined) {
      const bd = String(b.birthDate || "").trim();
      if (target.role !== "client") {
        if (bd) return fail(400, "تاريخ الميلاد يُضبط لحسابات العملاء فقط");
      } else if (bd === "") {
        $set.birthDate = "";
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(bd)) {
        $set.birthDate = bd;
      } else {
        return fail(400, "تاريخ الميلاد غير صحيح — الصيغة يوم/شهر/سنة كاملة");
      }
    }
    /* ★ v3.24: سن وجنس العميل — للإدارة والمساعد على حسابات العملاء (اختياريان)
       ★ v3.24.1: على غير العميل — الفراغ يُتجاهل بهدوء والقيمة الفعلية وحدها تُرفض */
    if (b.age !== undefined) {
      if (target.role !== "client") {
        if (isAgeValue(b.age)) return fail(400, "سن العميل يُضبط لحسابات العملاء فقط");
      } else {
        const n = Number(b.age);
        $set.age = b.age === null || b.age === "" || !Number.isFinite(n) ? null : Math.max(0, Math.min(120, Math.round(n)));
      }
    }
    if (b.gender !== undefined) {
      if (target.role !== "client") {
        if (isGenderValue(b.gender)) return fail(400, "جنس العميل يُضبط لحسابات العملاء فقط");
      } else {
        $set.gender = isGenderValue(b.gender) ? b.gender : null;
      }
    }
    /* ★ v3.19: زمرة الدم — للإدارة على حسابات العملاء؛ الفراغ = حذف (غير محددة) */
    if (b.bloodType !== undefined) {
      if (target.role !== "client") {
        if (isBloodValue(b.bloodType)) return fail(400, "زمرة الدم تُضبط لحسابات العملاء فقط");
      } else {
        try {
          $set.bloodType = normalizeBloodType(b.bloodType);
        } catch {
          return fail(400, "زمرة الدم غير صحيحة — اختر إحدى الفصائل الثماني");
        }
      }
    }
    if (typeof b.active === "boolean") $set.active = b.active;

    if (!Object.keys($set).length && !Object.keys($unset).length)
      return ok({ user: toSafeUser(await User.findById(id).lean()) });

    const update: Record<string, unknown> = Object.keys($unset).length ? { $set, $unset } : { $set };
    const u = await User.findByIdAndUpdate(id, update, { new: true }).lean();
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "accounts.update", `حساب: ${String(b.name || target.phone || id)}`, Object.keys($set).concat(Object.keys($unset).map((k) => `-${k}`)).join(", ") || "تعديل", id);
    return ok({ user: u ? toSafeUser(u) : null });
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const me = await requireUser(["admin"]);
    const { id } = await ctx.params;
    if (String(me._id) === id) return fail(400, "لا يمكنك حذف حسابك");
    const u = await User.findByIdAndDelete(id);
    if (!u) return fail(404, "الحساب غير موجود");
    await logAudit({ _id: me._id, name: me.name, role: me.role }, "accounts.delete", `حساب: ${u.name || id}`, "حذف نهائي", id);
    return ok();
  });
}

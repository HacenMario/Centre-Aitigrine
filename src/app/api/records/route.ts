/**
 * الملفات الطبية والنفسية للمرضى
 * GET  → قائمة المرضى مع ملفهم (حسب الصلاحية: الأخصائي يرى مرضاه فقط)
 * GET ?patientId=xxx → ملف مريض واحد
 * PUT  → إنشاء/تحديث ملف (أخصائي مرتبط بالحالة أو إدارة)
 *
 * 🔒 السرية: الأخصائي يصل فقط لمرضاه (المعيَّنون له أو لهم مواعيد معه)
 */
import { NextRequest } from "next/server";
import { ok, fail, handle } from "@/lib/api-helpers";
import { Appointment, MedicalRecord, User } from "@/lib/models";
import { requireUser, toSafeUser } from "@/lib/auth";

/** معرّفات مرضى الأخصائي: المعيَّنون له + من لهم مواعيد معه */
async function patientsOfSpecialist(specialistId: string): Promise<string[]> {
  const [assigned, appts] = await Promise.all([
    User.find({ role: "client", assignedSpecialistId: specialistId }).select("_id").lean<{ _id: unknown }[]>(),
    Appointment.find({ specialistId }).select("clientId").lean<{ clientId: unknown }[]>(),
  ]);
  const ids = new Set<string>();
  assigned.forEach((u) => ids.add(String(u._id)));
  appts.forEach((a) => ids.add(String(a.clientId)));
  return [...ids];
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser(["admin", "assistant", "specialist"]);
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");

    /* ملف واحد */
    if (patientId) {
      const patient = await User.findById(patientId).lean();
      if (!patient || patient.role !== "client") return fail(404, "المريض غير موجود");
      if (me.role === "specialist") {
        const mine = await patientsOfSpecialist(String(me._id));
        if (!mine.includes(String(patientId))) return fail(403, "هذا المريض ليس ضمن ملفاتك — وصول مرفوض");
      }
      const record = await MedicalRecord.findOne({ patientId }).lean();
      /* v3.5: تفاصيل الأخصائي المعالج — تظهر في الوثائق المطبوعة (تقرير نفسي، شهادة متابعة…) */
      let specialist: {
        _id: string; name: string; title: string; titleFr: string; titleEn: string;
        bio: string; bioFr: string; bioEn: string; phone: string; photoBase64: string;
      } | null = null;
      const specId = (record as { specialistId?: unknown } | null)?.specialistId;
      if (specId) {
        const sp = await User.findById(specId)
          .select("name title titleFr titleEn bio bioFr bioEn phone photoBase64 role")
          .lean<{ name: string; title?: string; titleFr?: string; titleEn?: string; bio?: string; bioFr?: string; bioEn?: string; phone?: string; photoBase64?: string } | null>();
        if (sp && (sp.title || sp.name)) {
          specialist = {
            _id: String((sp as unknown as { _id: unknown })._id),
            name: sp.name,
            title: sp.title || "",
            titleFr: sp.titleFr || "",
            titleEn: sp.titleEn || "",
            bio: sp.bio || "",
            bioFr: sp.bioFr || "",
            bioEn: sp.bioEn || "",
            phone: sp.phone || "",
            photoBase64: sp.photoBase64 || "",
          };
        }
      }
      return ok({ patient: toSafeUser(patient), record: record || null, specialist });
    }

    /* قائمة المرضى */
    let patientIds: string[];
    if (me.role === "specialist") {
      patientIds = await patientsOfSpecialist(String(me._id));
    } else {
      const clients = await User.find({ role: "client" }).select("_id").lean<{ _id: unknown }[]>();
      patientIds = clients.map((c) => String(c._id));
    }
    if (patientIds.length === 0) return ok({ patients: [] });

    const users = await User.find({ _id: { $in: patientIds } }).lean();
    const records = await MedicalRecord.find({ patientId: { $in: patientIds } }).lean();
    const recMap = new Map(records.map((r) => [String(r.patientId), r]));

    const patients = users
      .map((u) => {
        const safe = toSafeUser(u);
        const rec = recMap.get(String(u._id));
        return {
          user: safe,
          hasRecord: !!rec,
          recordId: rec ? String((rec as { _id: unknown })._id) : null,
          diagnosis: rec?.diagnosis || "",
          birthDate: rec?.birthDate || "",
          specialistId: rec?.specialistId ? String(rec.specialistId) : "",
          updatedAt: rec?.updatedAt || null,
        };
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name, "ar"));

    return ok({ patients });
  });
}

export async function PUT(req: NextRequest) {
  return handle(async () => {
    const me = await requireUser(["admin", "assistant", "specialist"]);
    const b = await req.json().catch(() => ({}));
    const patientId = String(b.patientId || "");
    if (!patientId) return fail(400, "حدد المريض");

    const patient = await User.findById(patientId).lean();
    if (!patient || patient.role !== "client") return fail(404, "المريض غير موجود");

    /* 🔒 الأخصائي: مرضاه فقط */
    if (me.role === "specialist") {
      const mine = await patientsOfSpecialist(String(me._id));
      if (!mine.includes(patientId)) return fail(403, "هذا المريض ليس ضمن ملفاتك — وصول مرفوض");
    }

    const existing = await MedicalRecord.findOne({ patientId });
    const fields = {
      specialistId:
        me.role === "specialist"
          ? me._id
          : b.specialistId
            ? b.specialistId
            : existing?.specialistId ?? null,
      birthDate: String(b.birthDate ?? existing?.birthDate ?? ""),
      gender: ["male", "female", ""].includes(b.gender) ? b.gender : existing?.gender ?? "",
      address: String(b.address ?? existing?.address ?? ""),
      guardianName: String(b.guardianName ?? existing?.guardianName ?? ""),
      guardianPhone: String(b.guardianPhone ?? existing?.guardianPhone ?? ""),
      medicalInfo: String(b.medicalInfo ?? existing?.medicalInfo ?? ""),
      psychologicalInfo: String(b.psychologicalInfo ?? existing?.psychologicalInfo ?? ""),
      symptoms: String(b.symptoms ?? existing?.symptoms ?? ""),
      symptomsFr: String(b.symptomsFr ?? existing?.symptomsFr ?? ""),
      symptomsEn: String(b.symptomsEn ?? existing?.symptomsEn ?? ""),
      motive: String(b.motive ?? existing?.motive ?? ""),
      motiveFr: String(b.motiveFr ?? existing?.motiveFr ?? ""),
      motiveEn: String(b.motiveEn ?? existing?.motiveEn ?? ""),
      diagnosis: String(b.diagnosis ?? existing?.diagnosis ?? ""),
      diagnosisFr: String(b.diagnosisFr ?? existing?.diagnosisFr ?? ""),
      diagnosisEn: String(b.diagnosisEn ?? existing?.diagnosisEn ?? ""),
      diagnosisSystem: ["", "dsm5", "icd10"].includes(b.diagnosisSystem)
        ? b.diagnosisSystem
        : existing?.diagnosisSystem ?? "",
      diagnosisCode: String(b.diagnosisCode ?? existing?.diagnosisCode ?? ""),
      treatmentPlan: String(b.treatmentPlan ?? existing?.treatmentPlan ?? ""),
      treatmentPlanFr: String(b.treatmentPlanFr ?? existing?.treatmentPlanFr ?? ""),
      treatmentPlanEn: String(b.treatmentPlanEn ?? existing?.treatmentPlanEn ?? ""),
      sessionNotes: Array.isArray(b.sessionNotes)
        ? b.sessionNotes
            .filter((n: { text?: string }) => n && String(n.text || "").trim())
            .map((n: { date?: string; text?: string }) => ({
              date: String(n.date || ""),
              text: String(n.text || ""),
            }))
        : existing?.sessionNotes ?? [],
      updatedBy: me._id,
    };

    const doc = existing
      ? await MedicalRecord.findOneAndUpdate({ patientId }, fields, { new: true })
      : await MedicalRecord.create({ patientId, ...fields, createdBy: me._id });

    return ok({ record: doc });
  });
}

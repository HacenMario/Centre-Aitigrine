/**
 * تهيئة القوائم المرجعية الدائمة عند أول تشغيل
 * ★ التخصصات الافتراضية الدائمة فقط — لا بيانات تجريبية إطلاقاً
 *   (حسابات الإدارة تُنشأ من بوابة الدخول ببيانات .env)
 * لا يمس أي بيانات موجودة — يضيف التخصصات الافتراضية الناقصة فقط
 */
import { connectDB } from "./mongo";
import { Specialty } from "./models";

/** التخصصات الافتراضية الدائمة — بثلاث لغات (عربي / فرنسي / إنجليزي) */
export const BUILTIN_SPECIALTIES: { ar: string; fr: string; en: string }[] = [
  { ar: "علم النفس الإكلينيكي", fr: "Psychologie clinique", en: "Clinical Psychology" },
  { ar: "الأرطفونية", fr: "Orthophonie", en: "Speech Therapy" },
  { ar: "العلاج النفسي", fr: "Psychothérapie", en: "Psychotherapy" },
  { ar: "العلاج السلوكي المعرفي", fr: "Thérapie cognitivo-comportementale", en: "Cognitive Behavioral Therapy" },
  { ar: "الطفولة والمراهقة", fr: "Enfance et adolescence", en: "Children & Adolescents" },
  { ar: "الاستشارات الأسرية والزوجية", fr: "Conseil familial et conjugal", en: "Family & Couples Counseling" },
  { ar: "صعوبات التعلم", fr: "Troubles de l'apprentissage", en: "Learning Disorders" },
  { ar: "اضطرابات النطق واللغة", fr: "Troubles de la parole et du langage", en: "Speech & Language Disorders" },
  { ar: "التطوير المهاري والتربوي", fr: "Développement des compétences", en: "Skills Development" },
  { ar: "الاستشارات النفسية عن بُعد", fr: "Téléconsultation psychologique", en: "Remote Counseling" },
];

export async function ensureBuiltinSpecialties(): Promise<void> {
  try {
    await connectDB();
    const existing = await Specialty.countDocuments({ builtin: true });
    if (existing >= BUILTIN_SPECIALTIES.length) return;
    for (let i = 0; i < BUILTIN_SPECIALTIES.length; i++) {
      const s = BUILTIN_SPECIALTIES[i];
      const found = await Specialty.findOne({ "name.ar": s.ar, builtin: true });
      if (!found) {
        await Specialty.create({ name: s, builtin: true, order: i + 1, active: true });
      }
    }
    console.log("✅ التخصصات الافتراضية الدائمة جاهزة");
  } catch (e) {
    console.error("ensureBuiltinSpecialties error:", (e as Error).message);
  }
}

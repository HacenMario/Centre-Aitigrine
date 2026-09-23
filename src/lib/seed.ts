/**
 * تهيئة القوائم المرجعية الدائمة عند أول تشغيل
 * ★ التخصصات الافتراضية الدائمة فقط — لا بيانات تجريبية إطلاقاً
 *   (حسابات الإدارة تُنشأ من بوابة الدخول ببيانات .env)
 * لا يمس أي بيانات موجودة — يضيف التخصصات الافتراضية الناقصة فقط
 * v3.7: خمس لغات (عربي / فرنسي / إنجليزي / تركي / إسباني)
 */
import { connectDB } from "./mongo";
import { Specialty } from "./models";

/** التخصصات الافتراضية الدائمة — بخمس لغات */
export const BUILTIN_SPECIALTIES: { ar: string; fr: string; en: string; tr: string; es: string }[] = [
  {
    ar: "علم النفس الإكلينيكي",
    fr: "Psychologie clinique",
    en: "Clinical Psychology",
    tr: "Klinik Psikoloji",
    es: "Psicología Clínica",
  },
  {
    ar: "الأرطفونية",
    fr: "Orthophonie",
    en: "Speech Therapy",
    tr: "Dil ve Konuşma Terapisi",
    es: "Fonoaudiología",
  },
  {
    ar: "العلاج النفسي",
    fr: "Psychothérapie",
    en: "Psychotherapy",
    tr: "Psikoterapi",
    es: "Psicoterapia",
  },
  {
    ar: "العلاج السلوكي المعرفي",
    fr: "Thérapie cognitivo-comportementale",
    en: "Cognitive Behavioral Therapy",
    tr: "Bilişsel Davranışçı Terapi",
    es: "Terapia Cognitivo-Conductual",
  },
  {
    ar: "الطفولة والمراهقة",
    fr: "Enfance et adolescence",
    en: "Children & Adolescents",
    tr: "Çocukluk ve Ergenlik",
    es: "Infancia y adolescencia",
  },
  {
    ar: "الاستشارات الأسرية والزوجية",
    fr: "Conseil familial et conjugal",
    en: "Family & Couples Counseling",
    tr: "Aile ve Çift Danışmanlığı",
    es: "Asesoramiento familiar y de parejas",
  },
  {
    ar: "صعوبات التعلم",
    fr: "Troubles de l'apprentissage",
    en: "Learning Disorders",
    tr: "Öğrenme Güçlüğü",
    es: "Trastornos del aprendizaje",
  },
  {
    ar: "اضطرابات النطق واللغة",
    fr: "Troubles de la parole et du langage",
    en: "Speech & Language Disorders",
    tr: "Konuşma ve Dil Bozuklukları",
    es: "Trastornos del habla y del lenguaje",
  },
  {
    ar: "التطوير المهاري والتربوي",
    fr: "Développement des compétences",
    en: "Skills Development",
    tr: "Beceri ve Eğitsel Gelişim",
    es: "Desarrollo de habilidades",
  },
  {
    ar: "الاستشارات النفسية عن بُعد",
    fr: "Téléconsultation psychologique",
    en: "Remote Counseling",
    tr: "Uzaktan Psikolojik Danışmanlık",
    es: "Consulta psicológica a distancia",
  },
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
      } else {
        /* v3.7: إثراء التخصصات القديمة بالتركية والإسبانية إن فارغتا */
        if (!found.name?.tr || !found.name?.es) {
          await Specialty.updateOne(
            { _id: found._id },
            { $set: { "name.tr": s.tr, "name.es": s.es } }
          );
        }
      }
    }
    console.log("✅ التخصصات الافتراضية الدائمة جاهزة");
  } catch (e) {
    console.error("ensureBuiltinSpecialties error:", (e as Error).message);
  }
}

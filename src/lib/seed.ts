/**
 * تهيئة القوائم المرجعية الدائمة عند أول تشغيل
 * ★ التخصصات الافتراضية الدائمة فقط — لا بيانات تجريبية إطلاقاً
 *   (حسابات الإدارة تُنشأ من بوابة الدخول ببيانات .env)
 * لا يمس أي بيانات موجودة — يضيف التخصصات الافتراضية الناقصة فقط
 * ★ v3.8.1: خمس لغات (عربي/فرنسي/إنجليزي/تركي/إسباني)
 *   + شفاء تلقائي للتكرارات القديمة (كل تخصص يظهر مرة واحدة حصراً)
 */
import { connectDB } from "./mongo";
import { Specialty } from "./models";

/** التخصصات الافتراضية الدائمة — بخمس لغات */
export const BUILTIN_SPECIALTIES: { code: string; ar: string; fr: string; en: string; tr: string; es: string }[] = [
  { code: "clinical_psychology",
    ar: "علم النفس الإكلينيكي", fr: "Psychologie clinique", en: "Clinical Psychology",
    tr: "Klinik Psikoloji", es: "Psicología Clínica",
  },
  { code: "orthophony",
    ar: "الأرطفونية", fr: "Orthophonie", en: "Speech Therapy",
    tr: "Dil ve Konuşma Terapisi", es: "Logopedia",
  },
  { code: "psychotherapy",
    ar: "العلاج النفسي", fr: "Psychothérapie", en: "Psychotherapy",
    tr: "Psikoterapi", es: "Psicoterapia",
  },
  { code: "cbt",
    ar: "العلاج السلوكي المعرفي", fr: "Thérapie cognitivo-comportementale", en: "Cognitive Behavioral Therapy",
    tr: "Bilişsel Davranışçı Terapi", es: "Terapia Cognitivo-Conductual",
  },
  { code: "child_adolescent",
    ar: "الطفولة والمراهقة", fr: "Enfance et adolescence", en: "Children & Adolescents",
    tr: "Çocukluk ve Ergenlik", es: "Infancia y Adolescencia",
  },
  { code: "family_couples",
    ar: "الاستشارات الأسرية والزوجية", fr: "Conseil familial et conjugal", en: "Family & Couples Counseling",
    tr: "Aile ve Çift Danışmanlığı", es: "Asesoramiento Familiar y de Pareja",
  },
  { code: "learning_disorders",
    ar: "صعوبات التعلم", fr: "Troubles de l'apprentissage", en: "Learning Disorders",
    tr: "Öğrenme Güçlükleri", es: "Dificultades de Aprendizaje",
  },
  { code: "speech_language",
    ar: "اضطرابات النطق واللغة", fr: "Troubles de la parole et du langage", en: "Speech & Language Disorders",
    tr: "Konuşma ve Dil Bozuklukları", es: "Trastornos del Habla y del Lenguaje",
  },
  { code: "skills_development",
    ar: "التطوير المهاري والتربوي", fr: "Développement des compétences", en: "Skills Development",
    tr: "Beceri ve Eğitim Gelişimi", es: "Desarrollo de Habilidades",
  },
  { code: "remote_counseling",
    ar: "الاستشارات النفسية عن بُعد", fr: "Téléconsultation psychologique", en: "Remote Counseling",
    tr: "Uzaktan Psikolojik Danışmanlık", es: "Asesoramiento Psicológico a Distancia",
  },
];

/** شفاء التكرارات: يبقي أقدم وثيقة لكل اسم عربي ويحذف البقية (إصلاح قواعد قديمة) */
export async function dedupeSpecialties(): Promise<number> {
  const all = await Specialty.find({}).sort({ createdAt: 1, _id: 1 }).lean<{ _id: unknown; name?: { ar?: string } }[]>();
  const seen = new Map<string, unknown>();
  const dupIds: unknown[] = [];
  for (const s of all) {
    const key = String(s.name?.ar || "").trim();
    if (!key) continue;
    if (seen.has(key)) dupIds.push(s._id);
    else seen.set(key, s._id);
  }
  if (dupIds.length) {
    await Specialty.deleteMany({ _id: { $in: dupIds } });
    console.log(`🧹 حُذف ${dupIds.length} تخصص مكرر`);
  }
  return dupIds.length;
}

export async function ensureBuiltinSpecialties(): Promise<void> {
  try {
    await connectDB();
    /* 1) شفاء أي تكرارات قديمة أولاً — يضمن ظهور كل تخصص مرة واحدة */
    await dedupeSpecialties();
    /* 2) ★ v3.10: الافتراضيات التي حذفتها الإدارة لا تُعاد زرعتها أبداً */
    const { Settings } = await import('./models');
    const st = await Settings.findOne({ key: 'center' }).lean<{ options?: { deletedBuiltinSpecialties?: string[] } } | null>().catch(() => null);
    const deleted = new Set((st?.options?.deletedBuiltinSpecialties || []).map(String));
    /* 3) إضافة الافتراضية الناقصة (بأسمائها بخمس لغات + رمز ثابت) */
    for (let i = 0; i < BUILTIN_SPECIALTIES.length; i++) {
      const s = BUILTIN_SPECIALTIES[i];
      if (deleted.has(s.code)) continue; /* حذف الإدارة محترم دائماً */
      const found = await Specialty.findOne({ $or: [{ code: s.code }, { 'name.ar': s.ar }] }).lean();
      if (!found) {
        await Specialty.create({ code: s.code, name: s, builtin: true, order: i + 1, active: true });
      } else if (process.env.NEXT_RUNTIME !== 'edge') {
        /* ترقية الرمز والأسماء الناقصة للقديمة — لا يمس أي اسم محفوظ */
        const doc = await Specialty.findOne({ $or: [{ code: s.code }, { 'name.ar': s.ar }] });
        if (doc && (!doc.code || !doc.name.tr || !doc.name.es)) {
          doc.code = doc.code || s.code;
          doc.name.tr = doc.name.tr || s.tr;
          doc.name.es = doc.name.es || s.es;
          doc.name.fr = doc.name.fr || s.fr;
          doc.name.en = doc.name.en || s.en;
          doc.builtin = true;
          await doc.save();
        }
      }
    }
    console.log('✅ التخصصات الافتراضية الدائمة جاهزة (خمس لغات — تحترم حذف الإدارة)');
  } catch (e) {
    console.error('ensureBuiltinSpecialties error:', (e as Error).message);
  }
}
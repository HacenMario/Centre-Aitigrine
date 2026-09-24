/**
 * المساعد الذكي (v3.8) — ردود آلية على الأسئلة الشائعة وتوجيه للحجز
 * POST /api/chatbot { message, lang? }
 * ★ محرك مطابقة كلمات مفتاحية ثلاثي اللغة (عربي/فرنسي/إنجليزي)
 *   + يجيب من قاعدة الأسئلة الشائعة المُدارة في الإعدادات (pages: faq)
 *   + يوجّه للمواعيد/الخدمات/التكوينات بروابط تنقل مباشرة
 * بلا ذكاء خارجي — يعمل دائماً وبلا تكلفة وبلا إنترنت خارجي
 */
import { NextRequest } from "next/server";
import { ok, handle } from "@/lib/api-helpers";
import { PageContent } from "@/lib/models";

type BotReply = {
  text: string;
  textFr?: string;
  textEn?: string;
  link?: string; // "appointments" | "services" | "courses" | "faq" | "contact" ...
  linkLabel?: string;
  linkLabelFr?: string;
  linkLabelEn?: string;
};

/** قواعد الم المطابقة — الأولوية من الأعلى للأسفل */
const RULES: { keys: string[]; reply: BotReply }[] = [
  {
    keys: ["حجز", "احجز", "موعد", "book", "booking", "appointment", "rendez", "rendez-vous", "réserver", "réservation", "ساعة"],
    reply: {
      text: "يسعدنا خدمتك! يمكنك حجز موعدك مباشرة من صفحة المواعيد — اختر الأخصائي والتوقيت المناسب لك، وسيصلك تأكيد فوري مع تذكير قبل الجلسة.",
      textFr: "Nous serions ravis de vous servir ! Réservez votre rendez-vous depuis la page des rendez-vous — choisissez le spécialiste et l'horaire, et recevrez une confirmation immédiate avec un rappel avant la séance.",
      textEn: "We'd be happy to help! Book your appointment directly from the appointments page — pick your specialist and preferred time, and receive instant confirmation with a reminder before the session.",
      link: "appointments",
      linkLabel: "حجز موعد الآن",
      linkLabelFr: "Réserver maintenant",
      linkLabelEn: "Book now",
    },
  },
  {
    keys: ["سعر", "أسعار", "تكلفة", "كم", "price", "prix", "coût", "combien", "tarif", "cost", "دج", "دينار"],
    reply: {
      text: "تختلف الأسعار حسب الخدمة والتكوين. تجد السعر بجانب كل خدمة في صفحة الخدمات، وسعر التكوين في صفحة التكوينات. بعض الكوبونات والعروض تمنحك خصماً إضافياً عند الحجز!",
      textFr: "Les tarifs varient selon le service et la formation. Le prix est affiché à côté de chaque service dans la page des services, et celui des formations dans leur page. Nos coupons et offres peuvent vous accorder une réduction supplémentaire !",
      textEn: "Prices vary by service and training. Each service shows its price on the services page, and trainings show theirs on the courses page. Coupons and offers can give you an extra discount!",
      link: "services",
      linkLabel: "تصفح الخدمات والأسعار",
      linkLabelFr: "Voir les services et tarifs",
      linkLabelEn: "Browse services & prices",
    },
  },
  {
    keys: ["خصم", "كوبون", "عرض", "تخفيض", "coupon", "discount", "promo", "code", "réduction", "offre", "solde"],
    reply: {
      text: "نوفّر كوبونات خصم دورية (نسبة أو مبلغ ثابت). إن كان لديك رمز كوبون أدخله عند تأكيد الحجز ليُطبّق الخصم تلقائياً على سعر الجلسة.",
      textFr: "Nous offrons régulièrement des coupons de réduction (pourcentage ou montant fixe). Si vous avez un code, saisissez-le lors de la confirmation pour appliquer la réduction automatiquement.",
      textEn: "We regularly offer discount coupons (percentage or fixed amount). If you have a code, enter it at booking confirmation to apply the discount automatically.",
      link: "appointments",
      linkLabel: "استعمل كوبونك عند الحجز",
      linkLabelFr: "Utiliser mon coupon",
      linkLabelEn: "Use my coupon",
    },
  },
  {
    keys: ["عن بعد", "اونلاين", "أونلاين", "online", "remote", "video", "visio", "distance", "زووم", "zoom"],
    reply: {
      text: "نعم، تتوفر جلسات عن بُعد بالفيديو بجانب الجلسات الحضورية. اختر «عن بُعد» كطريقة للجلسة عند الحجز وستستعمل نفس صفحة المواعيد للمتابعة.",
      textFr: "Oui, des séances à distance par visioconférence sont disponibles en plus des séances présentes. Choisissez « à distance » lors de la réservation.",
      textEn: "Yes, remote video sessions are available alongside in-person ones. Choose “remote” as the session mode when booking.",
      link: "appointments",
      linkLabel: "حجز جلسة عن بُعد",
      linkLabelFr: "Réserver à distance",
      linkLabelEn: "Book a remote session",
    },
  },
  {
    keys: ["تخصص", "أخصائي", "اخصائي", "طبيب", "specialist", "docteur", "médecin", "orthophoniste", "psychologue", "doctor", "معالج"],
    reply: {
      text: "يضم مركزنا فريقاً من الأخصائيين النفسيين وأخصائيي الأرطفونية المعتمدين. تصفح بطاقات الفريق واطلع على خبرات كل أخصائي ولغاته وتقييماته قبل الحجز.",
      textFr: "Notre centre réunit des psychologues et orthophonistes agréés. Parcourez les fiches de l'équipe : expérience, langues et évaluations avant de réserver.",
      textEn: "Our center brings together licensed psychologists and speech therapists. Browse the team cards to see each specialist's experience, languages, and ratings before booking.",
      link: "specialists",
      linkLabel: "تعرف على فريق الأخصائيين",
      linkLabelFr: "Découvrir l'équipe",
      linkLabelEn: "Meet the team",
    },
  },
  {
    keys: ["تكوين", "دورة", "ورشة", "formation", "cours", "atelier", "training", "course", "workshop"],
    reply: {
      text: "ننظم تكوينات ودورات في علم النفس والأرطفونية على مدار السنة. سجل نفسك من صفحة التكوينات وستجد التفاصيل والأسعار والبرنامج الزمني.",
      textFr: "Nous organisons des formations en psychologie et orthophonie toute l'année. Inscrivez-vous depuis la page des formations : détails, tarifs et calendrier.",
      textEn: "We organize psychology and speech-therapy trainings throughout the year. Register from the courses page — details, prices and schedule included.",
      link: "courses",
      linkLabel: "استكشف التكوينات",
      linkLabelFr: "Explorer les formations",
      linkLabelEn: "Explore courses",
    },
  },
  {
    keys: ["موقع", "عنوان", "وين", "أين", "خريطة", "address", "adresse", "location", "où", "map", "مقر"],
    reply: {
      text: "تجد عنوان المركز وخرائط Google ومعلومات الاتصال كاملة في صفحة التواصل، وكذلك أسفل كل صفحة في التذييل.",
      textFr: "L'adresse du centre, la carte Google Maps et les coordonnées figurent sur la page Contact, ainsi qu'en pied de page.",
      textEn: "The center's address, Google Maps and contact details are on the contact page, and in the footer of every page.",
      link: "contact",
      linkLabel: "افتح صفحة التواصل",
      linkLabelFr: "Page contact",
      linkLabelEn: "Contact page",
    },
  },
  {
    keys: ["وقت", "توقيت", "ساعات", "يفتح", "أيام", "horaires", "heures", "ouvert", "hours", "schedule", "open"],
    reply: {
      text: "أوقات العمل تظهر عند الحجز: التقاويم المتاحة لكل أخصائي تعرض الأيام والساعات الفعلية. تُحدَّث لحظياً مع كل حجز جديد.",
      textFr: "Les horaires apparaissent à la réservation : le calendrier de chaque spécialiste affiche ses jours et heures réels, mis à jour en temps réel.",
      textEn: "Working times appear when booking: each specialist's calendar shows their actual days and hours, updated live with every new booking.",
      link: "appointments",
      linkLabel: "شاهد الأوقات المتاحة",
      linkLabelFr: "Voir les disponibilités",
      linkLabelEn: "See availability",
    },
  },
  {
    keys: ["كتاب", "كتب", "مطالعة", "ebook", "livre", "livres", "lecture", "reading"],
    reply: {
      text: "مكتبتنا الإلكترونية توفر كتباً تفاعلية بأسطر إجابات يمكنك تعبئتها داخل الموقع مباشرة — بلا تحميل ولا حساب بريدي.",
      textFr: "Notre bibliothèque propose des livres interactifs avec lignes de réponses à remplir directement sur le site — sans téléchargement.",
      textEn: "Our digital library offers interactive books with answer lines you can fill in right on the site — no downloads needed.",
      link: "ebooks",
      linkLabel: "افتح المكتبة الإلكترونية",
      linkLabelFr: "Ouvrir la bibliothèque",
      linkLabelEn: "Open the library",
    },
  },
  {
    keys: ["مقال", "مقالات", "ابحاث", "article", "articles", "blog", "recherche"],
    reply: {
      text: "تنشر فريقنا مقالات علمية مبسطة في علم النفس والأرطفونية — متاحة للجميع مجاناً في صفحة المقالات.",
      textFr: "Notre équipe publie des articles scientifiques vulgarisés en psychologie et orthophonie — gratuits pour tous.",
      textEn: "Our team publishes accessible scientific articles on psychology and speech therapy — free for everyone.",
      link: "articles",
      linkLabel: "اقرأ المقالات",
      linkLabelFr: "Lire les articles",
      linkLabelEn: "Read articles",
    },
  },
  {
    keys: ["حساب", "كلمة السر", "كلمة المرور", "نسيت", "تسجيل", "password", "forgot", "compte", "mot de passe", "oublié", "inscrire", "register", "login"],
    reply: {
      text: "أنشئ حسابك من صفحة الدخول بتبويب «حساب جديد». نسيت كلمة المرور؟ أرسل طلب استعادة من «نسيت كلمة المرور» وستعالجه الإدارة بأسرع وقت، أو استعمل عبارة الاسترجاع إن سجلتها.",
      textFr: "Créez votre compte depuis l'onglet « Nouveau compte ». Mot de passe oublié ? Envoyez une demande de récupération, ou utilisez votre phrase de récupération si vous l'avez enregistrée.",
      textEn: "Create your account from the “New account” tab on the login page. Forgot your password? Send a recovery request, or use your recovery phrase if you saved one.",
      link: "login",
      linkLabel: "صفحة الدخول",
      linkLabelFr: "Page de connexion",
      linkLabelEn: "Login page",
    },
  },
  {
    keys: ["مرحبا", "السلام", "سلام", "أهلا", "اهلا", "hello", "hi", "bonjour", "salut", "مرحبتين", "صباح", "مساء"],
    reply: {
      text: "مرحباً بك في مركز آيت تقرين! أنا مساعدك الذكي — أجيب عن أسئلتك حول الحجوزات والخدمات والتكوينات، وأوجهك للصفحة المناسبة. كيف أساعدك؟",
      textFr: "Bienvenue au Centre Aït Tegrine ! Je suis votre assistant intelligent — je réponds à vos questions sur les réservations, services et formations. Comment puis-je aider ?",
      textEn: "Welcome to Ait Tegrine Center! I'm your smart assistant — I answer questions about bookings, services and trainings, and point you to the right page. How can I help?",
    },
  },
  {
    keys: ["شكرا", "شكراً", "thanks", "thank", "merci"],
    reply: {
      text: "على الرحب والسعة! إن احتجت أي شيء آخر أنا هنا دائماً. نتمنى لك يوماً طيباً 🌿",
      textFr: "Avec plaisir ! Je reste disponible si besoin. Excellente journée 🌿",
      textEn: "You're welcome! I'm always here if you need anything else. Have a great day 🌿",
    },
  },
];

function normalize(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىي]/g, "ي")
    .replace(/[ًٌٍَُِّْ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const b = await req.json().catch(() => null);
    const message = normalize(String(b?.message || "")).slice(0, 500);
    if (!message) return ok({ reply: null });

    /* 1) القواعد المدمجة — المطابقة بالكلمات المفتاحية */
    for (const rule of RULES) {
      if (rule.keys.some((k) => message.includes(normalize(k)))) {
        return ok({ reply: rule.reply });
      }
    }

    /* 2) قاعدة الأسئلة الشائعة المُدارة — مطابقة كلمات السؤال مع نص السؤال */
    try {
      const faqDoc = await PageContent.findOne({ key: "faq" }).lean<{ items?: { q?: string; a?: string }[] } | null>();
      const items = faqDoc?.items || [];
      const words = message.split(" ").filter((w) => w.length > 2);
      let best: { q: string; a: string; score: number } | null = null;
      for (const it of items) {
        const q = normalize(String(it.q || ""));
        if (!q) continue;
        const score = words.reduce((acc, w) => (q.includes(w) ? acc + 1 : acc), 0);
        if (score > 0 && (!best || score > best.score)) best = { q: String(it.q), a: String(it.a || ""), score };
      }
      if (best) {
        return ok({
          reply: {
            text: best.a,
            link: "faq",
            linkLabel: "كل الأسئلة الشائعة",
            linkLabelFr: "Toutes les questions",
            linkLabelEn: "All FAQs",
          },
        });
      }
    } catch {}

    /* 3) لا مطابقة → توجيه عام */
    return ok({
      reply: {
        text: "لم أفهم سؤالك تماماً، لكن يمكنني مساعدتك في الحجوزات والخدمات والتكوينات والكتب. جرّب صياغة أخرى، أو تواصل مع فريقنا مباشرة.",
        textFr: "Je n'ai pas bien saisi votre question, mais je peux vous aider pour les réservations, services, formations et livres. Reformulez ou contactez directement notre équipe.",
        textEn: "I didn't quite understand your question, but I can help with bookings, services, courses and books. Try rephrasing, or contact our team directly.",
        link: "contact",
        linkLabel: "تواصل معنا",
        linkLabelFr: "Nous contacter",
        linkLabelEn: "Contact us",
      },
    });
  });
}

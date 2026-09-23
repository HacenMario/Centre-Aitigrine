/**
 * مركز أيت تقرين — المحتوى الافتراضي الاحترافي لصفحات الموقع
 * (أسئلة شائعة / عن المركز / الخصوصية / شروط الاستخدام) بخمس لغات
 * تُعرض تلقائياً ما لم تُحرِّرها الإدارة من إعدادات المركز.
 * v3.7: إضافة النسختين التركية والإسبانية الكاملتين.
 */

type FaqItem = { q: string; a: string };
type SectionItem = { title: string; text: string };
type PagePack = { faq: FaqItem[]; about: SectionItem[]; privacy: SectionItem[]; terms: SectionItem[] };

export const PAGE_DEFAULTS: Record<"ar" | "fr" | "en" | "tr" | "es", PagePack> = {
  ar: {
    faq: [
      {
        q: "كيف أحجز موعداً في المركز؟",
        a: "أنشئ حساباً كعميل أو سجّل دخولك، ثم انتقل إلى «مواعيدي» واضغط «حجز موعد جديد»: اختر الأخصائي والخدمة والتاريخ والوقت المتاح لك. ستصلك إشعارات التأكيد والتذكير تلقائياً.",
      },
      {
        q: "هل الجلسات سرّية تماماً؟",
        a: "نعم. السرية التامة مبدأ أساسي في عملنا؛ كل ما يُقال في الجلسة يبقى ضمن إطار المركز، ولا يُطلع على الملف إلا الأخصائي المعالج والإدارة ضمن حدود المهنة والأخلاق.",
      },
      {
        q: "ما الفرق بين العناية النفسية والأرطوفونية؟",
        a: "العناية النفسية جلسات حوار وتقييم ومتابعة مع أخصائي نفسي، أما الأرطفونية فهي تشخيص وعلاج اضطرابات النطق واللغة والتواصل (تأخر الكلام، المخارج، التلعثم، اضطرابات التواصل) يناسب الأطفال والكبار ويُستخدم إما وحده أو إضافة للجلسات النفسية.",
      },
      {
        q: "هل أحتاج وصفة أو تحويلاً للاستفادة من الخدمات؟",
        a: "لا. يمكنك الحجز مباشرة دون تحويل. وفي الحالات التي تتطلب تقييماً طبياً متخصصاً سيوجّهك الأخصائي للجهة المناسبة.",
      },
      {
        q: "كم تدوم الجلسة النفسية؟ وبكم تُقدَّم؟",
        a: "تدوم الجلسة عادة بين 45 و60 دقيقة حسب نوع الخدمة. الأسعار واضحة ومعلنة على كل خدمة بالدينار الجزائري، وتُدفع في المركز.",
      },
      {
        q: "هل توفّرون تكوينات بشهادات؟",
        a: "نعم، يقدّم المركز برامج تكوين مهنية في العناية النفسية والأرطوفونية ببرنامج حصص واضح (تاريخ، بداية، نهاية) وتُمنح شهادة مشاركة أو إتمام حسب البرنامج.",
      },
      {
        q: "هل يمكنني تغيير موعدي أو إلغاؤه؟",
        a: "نعم من صفحة «مواعيدي»، ويفضَّل ذلك قبل 24 ساعة على الأقل حتى تتسنّى لغيرك حجز الوقت. يمكن للأخصائي أو الإدارة كذلك اقتراح موعد بديل عند الضرورة.",
      },
      {
        q: "أرطوفونية الأطفال: من أي سنّ تقبلون الأطفال؟",
        a: "نستقبل الأطفال من سنّ 4 سنوات في جلسات الأرطوفونية، بحضور أحد الوالدين عند الحاجة. يحدد التقييم الأولي برنامج العمل الأنسب لكل طفل.",
      },
    ],
    about: [
      {
        title: "من نحن",
        text: "مركز آيت تقرين للعناية النفسية والأرطفونية والتكوين هو فضاء متخصص في قلب الجزائر العاصمة (بيرخادم)، يجمع بين مهنية الأخصائيين ودفء المكان، ليقدّم رعاية نفسية متكاملة للأفراد والأطفال والعائلات، وتكوينات مهنية معتمدة في مجالات الصحة النفسية والأرطوفونية.",
      },
      {
        title: "رسالتنا",
        text: "أن نُتاح لكل شخص مساحة آمنة يستمع فيها إلى نفسه ويعمل على توازنه بمرافقة مهنية راقية، وأن نساهم في تأطير مختصين جيدين عبر تكوينات عملية تجمع بين النظرية والتطبيق.",
      },
      {
        title: "رؤيتنا",
        text: "أن نكون مرجعاً موثوقاً في العناية النفسية والأرطوفونية على المستوى الوطني، وأن تسود ثقافة طلب المساعدة النفسية كخطوة قوة لا ضعف.",
      },
      {
        title: "قيمنا",
        text: "السرية التامة، الاحترام دون حكم مسبق، المهنية والتحديث المستمر للمعرفة، القرب الإنساني، والسعر العادل المعلن مسبقاً بلا أي رسوم خفية.",
      },
      {
        title: "فريق العمل",
        text: "يتكوّن فريقنا من أخصائيي نفسية وأرطوفونيين معتمدين، مساعدون اجتماعيون، وفريق إداري يهتم بالتنظيم وسرعة الاستجابة. كل أخصائي له لقب مهني ونبذة تظهر في صفحة حسابه، وتُدار المواعيد بنظام يمنع تعارض الأوقات.",
      },
      {
        title: "لماذا آيت تقرين؟",
        text: "لأننا نؤمن أن العناية بالنفس رحلة تُبنى على الثقة: استقبال محترم، مواعيد دقيقة مع تذكير تلقائي، متابعة بين الجلسات عند الحاجة، وأدوات علاجية متنوعة تجمع الحوار والأرطفونية والتكوين.",
      },
    ],
    privacy: [
      {
        title: "البيانات التي نجمعها",
        text: "نجمع الحد الأدنى اللازم لتقديم الخدمة: الاسم الكامل، رقم الهاتف، وكلمة المرور المشفّرة عند إنشاء الحساب؛ وبيانات المواعيد والخدمات المحجوزة؛ وأي محتوى تشاركه طوعاً (اقتراحات، إجابات الكتب الإلكترونية، صور الملف الشخصي).",
      },
      {
        title: "السرية المهنية",
        text: "كل ما يُدوَّن في إطار الجلسات أو الملف النفسي يُعامل بسرية تامة، ولا يطّلع عليه غير الأخصائي المعالج والإدارة في حدود ما تقتضيه المهمة. لا نبيع ولا نشارك بياناتك مع أي طرف تجاري.",
      },
      {
        title: "الصور والوسائط",
        text: "الصور التي ترفعها لملفك تبقى لاستخدام الحساب داخلياً. صور وفيديوهات المركز المنشورة في الصفحة الرئيسية هي وسائط عامة تُنشر بموافقة الإدارة فقط.",
      },
      {
        title: "الإشعارات",
        text: "إشعارات التذكير بالمواعيد (الغد وقبل الساعة) تُرسل داخل الموقع، وإشعارات الجهاز اختيارية تُفعَّل بموافقتك فقط ويمكن تعطيلها في أي وقت من متصفحك أو من جرس الإشعارات.",
      },
      {
        title: "حماية المعلومات",
        text: "كلمات المرور مخزّنة مشفّرة (bcrypt)، والجلسات محمية بكوكي آمن، وكل مسارات البيانات محمية بتحقّق الصلاحيات. نوصي بكلمة مرور قوية وعدم مشاركتها مع أحد.",
      },
      {
        title: "حقوقك",
        text: "يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذف حسابك عبر التواصل مع الإدارة مباشرة أو من صفحة «اقتراحات وبلاغات»، وسيُستجيب لطلبك في أقرب وقت.",
      },
    ],
    terms: [
      {
        title: "قبول الشروط",
        text: "باستخدامك موقع مركز آيت تقرين وخدماته فإنك توافق على هذه الشروط. إن لم توافق عليها، يُرجى عدم استخدام الموقع.",
      },
      {
        title: "الحسابات والاستخدام السليم",
        text: "حسابات الأخصائيين والمساعدين تُنشأ من الإدارة حصراً، أما حساب العميل فيُنشأ ذاتياً ببيانات صحيحة. يمنع انتحال الصفة أو استخدام الموقع لأي غرض مخالف للقانون أو للآداب.",
      },
      {
        title: "المواعيد والإلغاء",
        text: "الحجز يتم حسب الأوقات المتاحة في النظام، ويُطلب الالتزام بالموعد. عند التعذّر يُرجى الإلغاء أو التبليغ قبل 24 ساعة على الأقل. يحق للمركز إعادة جدولة الموعد عند الضرورة القاهرة مع إشعارك.",
      },
      {
        title: "الأسعار والدفع",
        text: "الأسعار المعروضة بالدينار الجزائري وتُدفع في المركز. قد تُحدَّث الأسعار من وقت لآخر، ويُعمَل بالسعر المعلن وقت الحجز.",
      },
      {
        title: "طبيعة الخدمة",
        text: "الخدمات النفسية والأرطوفونية جهد مهني مساند ولا تُغني عن التقييم الطبي عند الحالات التي تتطلبه، ولا تضمن نتائج محددة؛ فالتقدم يختلف من شخص لآخر حسب الالتزام والظروف.",
      },
      {
        title: "الملكية الفكرية",
        text: "كل محتوى الموقع (نصوص، شعار، صور، كتب إلكترونية) ملك للمركز، والكتب الإلكترونية تُقرأ داخل الموقع فقط دون تحميل أو نسخ أو إعادة نشر.",
      },
      {
        title: "تعديل الشروط",
        text: "يحق للمركز تحديث هذه الشروط عند الحاجة، ويُعمَل بالنسخة المنشورة على الموقع. أي تغيير جوهري سيُبلَّغ عنه في الصفحة الرئيسية.",
      },
      {
        title: "القانون المطبّق",
        text: "تخضع هذه الشروط للقانون الجزائري، وأي نزاع يُحال إلى الجهات القضائية المختصة بالجزائر العاصمة.",
      },
    ],
  },
  fr: {
    faq: [
      {
        q: "Comment prendre rendez-vous au centre ?",
        a: "Créez un compte client ou connectez-vous, puis allez dans « Mes rendez-vous » et cliquez sur « Nouveau rendez-vous » : choisissez le spécialiste, le service, la date et l'heure disponibles. Les confirmations et rappels vous parviennent automatiquement.",
      },
      {
        q: "Les séances sont-elles totalement confidentielles ?",
        a: "Oui. La confidentialité totale est un principe fondamental de notre travail ; tout ce qui est dit en séance reste dans le cadre du centre, et seuls le spécialiste traitant et l'administration y ont accès dans les limites déontologiques.",
      },
      {
        q: "Quelle est la différence entre soins psychologiques et orthophonie ?",
        a: "Les soins psychologiques reposent sur l'entretien, l'évaluation et le suivi avec un psychologue ; l'orthophonie utilise le dessin, la musique et l'expression créative. Elle convient aux enfants comme aux adultes et peut être proposée seule ou en complément.",
      },
      {
        q: "Faut-il une ordonnance ou une adresse pour profiter des services ?",
        a: "Non. Vous pouvez réserver directement sans orientation. Si un avis médical spécialisé s'avère nécessaire, le spécialiste vous orientera vers la structure adaptée.",
      },
      {
        q: "Combien dure une séance et combien coûte-t-elle ?",
        a: "Une séance dure généralement entre 45 et 60 minutes selon le service. Les tarifs sont clairs et affichés sur chaque service, en dinars algériens, payable au centre.",
      },
      {
        q: "Proposez-vous des formations certifiantes ?",
        a: "Oui, le centre propose des formations professionnelles en soins psychologiques et en orthophonie, avec un programme de séances daté (date, début, fin) et une attestation ou certificat selon le programme.",
      },
      {
        q: "Puis-je modifier ou annuler mon rendez-vous ?",
        a: "Oui, depuis « Mes rendez-vous ». Nous vous recommandons de le faire au moins 24 heures à l'avance afin que le créneau profite à d'autres. Le spécialiste ou l'administration peut aussi proposer un créneau alternatif si nécessaire.",
      },
      {
        q: "À partir de quel âge recevez-vous les enfants en orthophonie ?",
        a: "Nous accueillons les enfants à partir de 4 ans, en présence d'un parent si nécessaire. Le bilan initial permet d'adapter le programme à chaque enfant.",
      },
    ],
    about: [
      {
        title: "Qui sommes-nous ?",
        text: "Le Centre Ait Tegrine de soins psychologiques, d'orthophonie et de formation est un espace spécialisé au cœur d'Alger (Bir Khadem), alliant le professionnalisme de ses praticiens à la chaleur du lieu. Il offre une prise en charge complète aux individus, aux enfants et aux familles, ainsi que des formations professionnelles certifiantes.",
      },
      {
        title: "Notre mission",
        text: "Offrir à chacun un espace sûr pour s'écouter et retrouver son équilibre avec un accompagnement professionnel de qualité, et contribuer à la formation de praticiens compétents grâce à des programmes alliant théorie et pratique.",
      },
      {
        title: "Notre vision",
        text: "Devenir une référence nationale fiable en soins psychologiques et orthophonie, et diffuser l'idée que demander de l'aide psychologique est une force, non une faiblesse.",
      },
      {
        title: "Nos valeurs",
        text: "Confidentialité absolue, respect sans jugement, professionnalisme et mise à jour continue des savoirs, proximité humaine, et tarification juste annoncée à l'avance sans frais cachés.",
      },
      {
        title: "Notre équipe",
        text: "Notre équipe réunit psychologues et orthophonistes certifiés, des assistants et une équipe administrative attentive à l'organisation et à la réactivité. Chaque spécialiste présente un titre professionnel et une biographie sur sa page, et un système anti-conflits gère les rendez-vous.",
      },
      {
        title: "Pourquoi Ait Tegrine ?",
        text: "Parce que nous croyons que le soin psychique est un voyage fondé sur la confiance : accueil respectueux, ponctualité avec rappels automatiques, suivi entre les séances si besoin, et outils thérapeutiques variés combinant parole et expression artistique.",
      },
    ],
    privacy: [
      {
        title: "Les données que nous collectons",
        text: "Nous collectons le minimum nécessaire : nom complet, numéro de téléphone et mot de passe chiffré à la création du compte ; les données de rendez-vous et de services réservés ; et tout contenu que vous partagez volontairement (suggestions, réponses aux e-books, photo de profil).",
      },
      {
        title: "Confidentialité professionnelle",
        text: "Tout ce qui relève des séances ou du dossier psychologique est traité en confidentialité absolue ; seuls le spécialiste traitant et l'administration y accèdent dans le cadre de la mission. Nous ne vendons ni ne partageons vos données avec des tiers.",
      },
      {
        title: "Photos et médias",
        text: "Les photos que vous téléversez restent en usage interne. Les photos et vidéos du centre publiées en page d'accueil sont des contenus publics diffusés uniquement avec l'accord de l'administration.",
      },
      {
        title: "Notifications",
        text: "Les rappels de rendez-vous (veille et une heure avant) sont envoyés dans le site ; les notifications d'appareil sont optionnelles, activées avec votre consentement et désactivables à tout moment.",
      },
      {
        title: "Sécurité",
        text: "Les mots de passe sont chiffrés (bcrypt), les sessions protégées par cookies sécurisés et chaque API vérifie les droits d'accès. Nous vous recommandons un mot de passe fort, jamais partagé.",
      },
      {
        title: "Vos droits",
        text: "Vous pouvez demander l'accès, la rectification ou la suppression de vos données via l'administration ou la page « Suggestions & signalements ».",
      },
    ],
    terms: [
      {
        title: "Acceptation des conditions",
        text: "En utilisant le site du Centre Ait Tegrine, vous acceptez les présentes conditions. Si vous ne les acceptez pas, veuillez ne pas utiliser le site.",
      },
      {
        title: "Comptes et usage approprié",
        text: "Les comptes spécialistes et assistants sont créés uniquement par l'administration ; le compte client est créé librement avec des informations exactes. Toute usurpation d'identité ou usage illégal est interdit.",
      },
      {
        title: "Rendez-vous et annulations",
        text: "La réservation se fait selon les créneaux disponibles. Merci d'annuler ou de prévenir au moins 24 heures à l'avance. Le centre peut reprogrammer en cas de force majeure, avec notification.",
      },
      {
        title: "Tarifs et paiement",
        text: "Les tarifs affichés sont en dinars algériens et payables au centre. Ils peuvent être actualisés ; le tarif en vigueur au moment de la réservation s'applique.",
      },
      {
        title: "Nature du service",
        text: "Les prestations psychologiques et d'orthophonie sont un accompagnement professionnel qui ne remplace pas un avis médical lorsque celui-ci est requis et ne garantit pas de résultats déterminés.",
      },
      {
        title: "Propriété intellectuelle",
        text: "Tout le contenu du site (textes, logo, images, e-books) appartient au centre. Les e-books se lisent uniquement sur le site, sans téléchargement ni reproduction.",
      },
      {
        title: "Modification des conditions",
        text: "Le centre peut actualiser ces conditions ; la version publiée sur le site fait foi. Tout changement majeur sera signalé en page d'accueil.",
      },
      {
        title: "Droit applicable",
        text: "Les présentes conditions sont soumises au droit algérien ; tout litige relève des tribunaux compétents d'Alger.",
      },
    ],
  },
  en: {
    faq: [
      {
        q: "How do I book an appointment?",
        a: "Create a client account or log in, go to “My Appointments” and tap “New Appointment”: choose the specialist, service, date and available time. Confirmation and reminder notifications are sent automatically.",
      },
      {
        q: "Are sessions fully confidential?",
        a: "Yes. Full confidentiality is a cornerstone of our work; everything discussed stays within the center, accessible only to the treating specialist and the administration within professional ethics.",
      },
      {
        q: "What is the difference between psychological care and speech therapy?",
        a: "Psychological care is based on talk sessions, assessment and follow-up with a psychologist, while speech therapy uses drawing, music and creative expression. It suits children and adults and can be used alone or alongside sessions.",
      },
      {
        q: "Do I need a referral to use the services?",
        a: "No, you can book directly without a referral. If a specialized medical opinion is needed, the specialist will guide you to the right place.",
      },
      {
        q: "How long is a session and what does it cost?",
        a: "Sessions usually last 45–60 minutes depending on the service. Prices are clear and displayed on each service in Algerian Dinars, payable at the center.",
      },
      {
        q: "Do you offer certified training programs?",
        a: "Yes, the center offers professional training in psychological care and speech therapy with a clear session schedule (date, start, end) and a participation or completion certificate depending on the program.",
      },
      {
        q: "Can I change or cancel my appointment?",
        a: "Yes, from “My Appointments”. We recommend doing so at least 24 hours ahead so the slot can serve someone else. The specialist or administration may also suggest an alternative time when needed.",
      },
      {
        q: "From what age do you accept children in speech therapy?",
        a: "We welcome children from age 4, with a parent present when needed. The initial assessment shapes the best program for each child.",
      },
    ],
    about: [
      {
        title: "Who we are",
        text: "Ait Tegrine Center for Psychological Care, Speech Therapy and Training is a specialized space in the heart of Algiers (Bir Khadem), combining professional practitioners with a warm setting. It provides complete care for individuals, children and families, plus certified professional training.",
      },
      {
        title: "Our mission",
        text: "To give everyone a safe space to listen to themselves and restore balance with high-quality professional support, and to train competent practitioners through programs blending theory and practice.",
      },
      {
        title: "Our vision",
        text: "To be a trusted national reference in psychological care and speech therapy, and to spread the idea that seeking psychological help is a strength, not a weakness.",
      },
      {
        title: "Our values",
        text: "Absolute confidentiality, respect without judgment, professionalism and continuous learning, human warmth, and fair prices announced in advance with no hidden fees.",
      },
      {
        title: "Our team",
        text: "Our team brings together certified psychologists and speech therapists, assistants and an administrative staff focused on organization and responsiveness. Each specialist has a professional title and bio on their page, and a conflict-free scheduling system manages appointments.",
      },
      {
        title: "Why Ait Tegrine?",
        text: "Because we believe caring for the mind is a journey built on trust: respectful reception, punctual appointments with automatic reminders, follow-up between sessions when needed, and varied therapeutic tools combining talk and artistic expression.",
      },
    ],
    privacy: [
      {
        title: "Data we collect",
        text: "We collect only what is needed: full name, phone number and an encrypted password at sign-up; appointment and booking data; and any content you voluntarily share (suggestions, e-book answers, profile photo).",
      },
      {
        title: "Professional confidentiality",
        text: "Everything within sessions or the psychological file is treated with absolute confidentiality; only the treating specialist and the administration may access it within the scope of the mission. We never sell or share your data with commercial parties.",
      },
      {
        title: "Photos and media",
        text: "Photos you upload remain for internal account use. Center photos and videos published on the home page are public media shared only with the administration's approval.",
      },
      {
        title: "Notifications",
        text: "Appointment reminders (next day and one hour before) are sent inside the site; device notifications are optional, enabled only with your consent and can be turned off anytime.",
      },
      {
        title: "Data protection",
        text: "Passwords are stored encrypted (bcrypt), sessions are protected with secure cookies, and every data route enforces permissions. We recommend a strong password that is never shared.",
      },
      {
        title: "Your rights",
        text: "You may request access to, correction of, or deletion of your data by contacting the administration or via the “Suggestions & Reports” page.",
      },
    ],
    terms: [
      {
        title: "Acceptance of terms",
        text: "By using the Ait Tegrine Center website and services you agree to these terms. If you do not agree, please do not use the website.",
      },
      {
        title: "Accounts and fair use",
        text: "Specialist and assistant accounts are created by the administration only; client accounts are self-created with accurate information. Impersonation or unlawful use is prohibited.",
      },
      {
        title: "Appointments and cancellations",
        text: "Booking follows the available slots in the system. Please cancel or notify at least 24 hours in advance. The center may reschedule in cases of force majeure with notification.",
      },
      {
        title: "Prices and payment",
        text: "Displayed prices are in Algerian Dinars, payable at the center. Prices may be updated; the price announced at booking time applies.",
      },
      {
        title: "Nature of the service",
        text: "Psychological and speech therapy services are professional support; they do not replace medical evaluation when required and do not guarantee specific outcomes, as progress varies by person and commitment.",
      },
      {
        title: "Intellectual property",
        text: "All website content (texts, logo, images, e-books) belongs to the center. E-books are readable inside the site only, without downloading, copying or redistribution.",
      },
      {
        title: "Changes to terms",
        text: "The center may update these terms when needed; the version published on the website applies. Any major change will be announced on the home page.",
      },
      {
        title: "Governing law",
        text: "These terms are governed by Algerian law; any dispute is referred to the competent courts of Algiers.",
      },
    ],
  },
  tr: {
    faq: [
      {
        q: "Merkezde nasıl randevu alırım?",
        a: "Bir danışan hesabı oluşturun veya giriş yapın, ardından «Randevularım» sayfasına gidin ve «Yeni randevu» düğmesine basın: uzmanı, hizmeti, tarihi ve size uygun müsait saati seçin. Onay ve hatırlatma bildirimleri size otomatik olarak ulaşır.",
      },
      {
        q: "Seanslar tamamen gizli mi?",
        a: "Evet. Tam gizlilik, çalışma prensiplerimizin temelidir; seanslarda söylenen her şey merkezin çerçevesi içinde kalır ve dosyaya yalnızca tedavi eden uzman ile yönetim, mesleki etik sınırları dâhilinde erişebilir.",
      },
      {
        q: "Psikolojik bakım ile dil ve konuşma terapisi arasındaki fark nedir?",
        a: "Psikolojik bakım; bir psikologla görüşme, değerlendirme ve takip seanslarına dayanır. Dil ve konuşma terapisi ise konuşma, dil ve iletişim bozukluklarının (konuşma gecikmesi, artikülasyon, kekeleme, iletişim bozuklukları) tanısı ve tedavisidir; çocuklara ve yetişkinlere uygundur ve tek başına ya da psikolojik seanslara ek olarak uygulanabilir.",
      },
      {
        q: "Hizmetlerden yararlanmak için reçete veya yönlendirme gerekir mi?",
        a: "Hayır. Yönlendirme olmadan doğrudan randevu alabilirsiniz. Uzman tıbbi değerlendirme gerektiren durumlarda sizi ilgili kuruma yönlendirir.",
      },
      {
        q: "Psikolojik seans ne kadar sürer ve ücreti ne kadardır?",
        a: "Seans genellikle hizmet türüne göre 45 ile 60 dakika arasında sürer. Ücretler nettir ve her hizmette Cezayir Dinarı cinsinden belirtilmiştir; merkezde ödenir.",
      },
      {
        q: "Sertifikalı eğitimler sunuyor musunuz?",
        a: "Evet, merkez; net bir seans programıyla (tarih, başlangıç, bitiş) psikolojik bakım ve dil terapisi alanlarında profesyonel eğitim programları sunar ve programa göre katılım veya tamamlama sertifikası verilir.",
      },
      {
        q: "Randevumu değiştirebilir veya iptal edebilir miyim?",
        a: "Evet, «Randevularım» sayfasından. Saatin başka birine kalabilmesi için bunu en az 24 saat öncesinden yapmanızı öneririz. Gerekirse uzman veya yönetim de alternatif bir saat önerebilir.",
      },
      {
        q: "Çocuklarda dil terapisi: kaç yaşından itibaren çocuk kabul ediyorsunuz?",
        a: "Dil ve konuşma terapisi seanslarına 4 yaşından itibaren çocukları kabul ediyoruz; gerektiğinde ebeveynlerden biri de hazır bulunur. İlk değerlendirme, her çocuk için en uygun programı belirler.",
      },
    ],
    about: [
      {
        title: "Biz kimiz",
        text: "Ait Tegrine Psikolojik Bakım, Dil ve Konuşma Terapisi ve Eğitim Merkezi, Cezayir'in kalbinde (Bir Hadem) yer alan uzmanlaşmış bir mekândır; uzmanlarının profesyonelliğini mekânın sıcaklığıyla birleştirir, bireylere, çocuklara ve ailelere bütüncül psikolojik bakım sunar ve ruh sağlığı ile dil terapisi alanlarında akredite mesleki eğitimler sağlar.",
      },
      {
        title: "Misyonumuz",
        text: "Herkesin, kaliteli profesyonel rehberlikle kendini dinleyebileceği ve dengesini yeniden kurabileceği güvenli bir alana sahip olmasını sağlamak; teoriyi pratikle birleştiren uygulamalı eğitimlerle yetkin uzmanların yetişmesine katkı sunmak.",
      },
      {
        title: "Vizyonumuz",
        text: "Psikolojik bakım ve dil terapisi alanında ulusal düzeyde güvenilir bir başvuru kaynağı olmak ve psikolojik yardım istemenin bir güç olduğunu, zayıflık olmadığını yaymak.",
      },
      {
        title: "Değerlerimiz",
        text: "Mutlak gizlilik, yargısız saygı, profesyonellik ve bilgilerin sürekli güncellenmesi, insani yakınlık ve önceden bildirilen, gizli ücreti olmayan adil fiyatlandırma.",
      },
      {
        title: "Ekibimiz",
        text: "Ekibimiz; akredite psikolog ve dil terapistleri, asistanlar ile organizasyona ve hızlı yanıta özen gösteren bir idari kadrodan oluşur. Her uzmanın sayfasında bir unvanı ve kısa biyografisi bulunur ve randevular, saat çakışmasını önleyen bir sistemle yönetilir.",
      },
      {
        title: "Neden Ait Tegrine?",
        text: "Çünkü zihnin bakımının güven üzerine kurulu bir yolculuk olduğuna inanıyoruz: saygılı karşılama, otomatik hatırlatmalarla dakik randevular, gerektiğinde seanslar arası takip ve diyalogla sanatsal ifadeyi birleştiren çeşitli terapi araçları.",
      },
    ],
    privacy: [
      {
        title: "Topladığımız veriler",
        text: "Yalnızca hizmeti sunmak için gereken asgari veriyi toplarız: hesap oluştururken ad soyad, telefon numarası ve şifrelenmiş şifre; randevulara ve rezerve edilen hizmetlere ait veriler; gönüllü olarak paylaştığınız içerikler (öneriler, e-kitap cevapları, profil fotoğrafı).",
      },
      {
        title: "Mesleki gizlilik",
        text: "Seanslara veya psikolojik dosyaya dahil her şey mutlak gizlilikle korunur; yalnızca tedavi eden uzman ve yönetim, görevin gerektirdiği ölçüde erişebilir. Verilerinizi hiçbir ticari tarafla satmayız veya paylaşmayız.",
      },
      {
        title: "Fotoğraflar ve medya",
        text: "Yüklediğiniz fotoğraflar dahili hesap kullanımı için kalır. Ana sayfada yayınlanan merkez fotoğraf ve videoları, yalnızca yönetimin onayıyla yayınlanan kamusal içeriklerdir.",
      },
      {
        title: "Bildirimler",
        text: "Randevu hatırlatmaları (bir gün önce ve bir saat önce) site içinde gönderilir; cihaz bildirimleri isteğe bağlıdır, yalnızca onayınızla etkinleşir ve dilediğiniz an tarayıcınızdan veya bildirim zilinden kapatılabilir.",
      },
      {
        title: "Bilgilerin korunması",
        text: "Şifreler şifreli (bcrypt) olarak saklanır, oturumlar güvenli yöntemlerle korunur ve her veri yolunda yetki kontrolü uygulanır. Güçlü bir şifre seçmenizi ve kimseyle paylaşmamanızı öneririz.",
      },
      {
        title: "Haklarınız",
        text: "Verilerinize erişme, düzeltme veya hesabınızı silme talebinde bulunabilirsiniz; bunun için doğrudan yönetimle iletişime geçin veya «Öneriler ve Şikâyetler» sayfasını kullanın. Talebinize en kısa sürede yanıt verilir.",
      },
    ],
    terms: [
      {
        title: "Koşulların kabulü",
        text: "Ait Tegrine Merkezi web sitesini ve hizmetlerini kullanarak bu koşulları kabul etmiş olursunuz. Kabul etmiyorsanız lütfen siteyi kullanmayın.",
      },
      {
        title: "Hesaplar ve uygun kullanım",
        text: "Uzman ve asistan hesapları yalnızca yönetim tarafından oluşturulur; danışan hesabı doğru bilgilerle kişi tarafından kendisi oluşturulur. Kimliğe bürünme veya yasa dışı kullanım yasaktır.",
      },
      {
        title: "Randevular ve iptaller",
        text: "Rezervasyon, sistemdeki müsait saatlere göre yapılır ve randevuya uyulması rica olunur. Mümkün olmadığında lütfen en az 24 saat öncesinden iptal edin veya bildirin. Zorunlu hâllerde merkez, sizi bilgilendirerek randevuyu yeniden planlayabilir.",
      },
      {
        title: "Ücretler ve ödeme",
        text: "Gösterilen ücretler Cezayir Dinarı cinsindendir ve merkezde ödenir. Ücretler zaman zaman güncellenebilir; rezervasyon anında belirtilen ücret geçerlidir.",
      },
      {
        title: "Hizmetin niteliği",
        text: "Psikolojik ve dil terapisi hizmetleri profesyonel destek niteliğindedir; gerektiğinde tıbbi değerlendirmenin yerini almaz ve belirli sonuçlar garanti etmez; ilerleme kişiden kişiye ve azim durumuna göre değişir.",
      },
      {
        title: "Fikri mülkiyet",
        text: "Sitedeki tüm içerik (metinler, logo, fotoğraflar, e-kitaplar) merkeze aittir. E-kitaplar yalnızca site içinde okunur; indirme, kopyalama veya yeniden yayınlama yapılamaz.",
      },
      {
        title: "Koşulların değiştirilmesi",
        text: "Merkez, gerektiğinde bu koşulları güncelleyebilir; sitede yayınlanan sürüm geçerlidir. Önemli değişiklikler ana sayfada duyurulur.",
      },
      {
        title: "Uygulanacak hukuk",
        text: "Bu koşullar Cezayir hukukuna tabidir; her türlü uyuşmazlık Cezayir'in yetkili mahkemelerinde çözümlenir.",
      },
    ],
  },

  es: {
    faq: [
      {
        q: "¿Cómo reservo una cita en el centro?",
        a: "Cree una cuenta de cliente o inicie sesión, vaya a «Mis citas» y pulse «Reservar nueva cita»: elija el especialista, el servicio, la fecha y el horario disponible. Las notificaciones de confirmación y recordatorio le llegan automáticamente.",
      },
      {
        q: "¿Las sesiones son totalmente confidenciales?",
        a: "Sí. La confidencialidad total es un principio fundamental de nuestro trabajo; todo lo que se dice en la sesión queda dentro del ámbito del centro, y solo el especialista tratante y la administración tienen acceso al expediente dentro de los límites de la ética profesional.",
      },
      {
        q: "¿Cuál es la diferencia entre el cuidado psicológico y la fonoaudiología?",
        a: "El cuidado psicológico consiste en sesiones de diálogo, evaluación y seguimiento con un psicólogo, mientras que la fonoaudiología se dedica al diagnóstico y tratamiento de los trastornos del habla, del lenguaje y de la comunicación (retraso del habla, articulación, tartamudez, trastornos de la comunicación); es apta para niños y adultos y puede aplicarse sola o como complemento de las sesiones psicológicas.",
      },
      {
        q: "¿Necesito una receta o una derivación para usar los servicios?",
        a: "No. Puede reservar directamente sin derivación. En los casos que requieran una evaluación médica especializada, el especialista lo orientará hacia el lugar adecuado.",
      },
      {
        q: "¿Cuánto dura una sesión psicológica y cuánto cuesta?",
        a: "La sesión suele durar entre 45 y 60 minutos según el tipo de servicio. Los precios son claros y están publicados en cada servicio en dinares argelinos, y se pagan en el centro.",
      },
      {
        q: "¿Ofrecen formaciones con certificados?",
        a: "Sí, el centro ofrece programas de formación profesional en cuidado psicológico y fonoaudiología con un programa de sesiones claro (fecha, inicio, fin), y se otorga un certificado de participación o de finalización según el programa.",
      },
      {
        q: "¿Puedo cambiar o cancelar mi cita?",
        a: "Sí, desde la página «Mis citas»; se recomienda hacerlo con al menos 24 horas de antelación para que el horario pueda aprovecharlo otra persona. El especialista o la administración también pueden proponer un horario alternativo cuando sea necesario.",
      },
      {
        q: "Fonoaudiología infantil: ¿desde qué edad aceptan niños?",
        a: "Recibimos niños a partir de los 4 años en las sesiones de fonoaudiología, con la presencia de uno de los padres cuando es necesario. La evaluación inicial determina el programa más adecuado para cada niño.",
      },
    ],
    about: [
      {
        title: "Quiénes somos",
        text: "El Centro Ait Tegrine de Cuidado Psicológico, Fonoaudiología y Formación es un espacio especializado en el corazón de Argel (Bir Khadem), que une la profesionalidad de sus especialistas con la calidez del lugar, para ofrecer cuidado psicológico integral a individuos, niños y familias, y formaciones profesionales acreditadas en los ámbitos de la salud mental y la fonoaudiología.",
      },
      {
        title: "Nuestra misión",
        text: "Que cada persona disponga de un espacio seguro donde escucharse y trabajar su equilibrio con un acompañamiento profesional de calidad, y contribuir a formar especialistas competentes mediante formaciones prácticas que unen la teoría y la aplicación.",
      },
      {
        title: "Nuestra visión",
        text: "Ser una referencia confiable a nivel nacional en cuidado psicológico y fonoaudiología, y difundir la idea de que pedir ayuda psicológica es un acto de fortaleza y no de debilidad.",
      },
      {
        title: "Nuestros valores",
        text: "Confidencialidad absoluta, respeto sin juicios previos, profesionalidad y actualización constante del conocimiento, cercanía humana y un precio justo anunciado de antemano sin cargos ocultos.",
      },
      {
        title: "Nuestro equipo",
        text: "Nuestro equipo está formado por psicólogos y fonoaudiólogos acreditados, asistentes y un equipo administrativo que cuida la organización y la rapidez de respuesta. Cada especialista tiene un título profesional y una biografía que aparecen en su página, y las citas se gestionan con un sistema que evita el choque de horarios.",
      },
      {
        title: "¿Por qué Ait Tegrine?",
        text: "Porque creemos que el cuidado de la mente es un viaje construido sobre la confianza: una acogida respetuosa, citas puntuales con recordatorio automático, seguimiento entre sesiones cuando hace falta y herramientas terapéuticas variadas que unen el diálogo, la fonoaudiología y la formación.",
      },
    ],
    privacy: [
      {
        title: "Los datos que recopilamos",
        text: "Recopilamos lo mínimo necesario para prestar el servicio: nombre completo, número de teléfono y contraseña cifrada al crear la cuenta; los datos de las citas y de los servicios reservados; y cualquier contenido que comparta voluntariamente (sugerencias, respuestas de los libros electrónicos, foto de perfil).",
      },
      {
        title: "Confidencialidad profesional",
        text: "Todo lo que se registra en el marco de las sesiones o del expediente psicológico se trata con total confidencialidad, y solo el especialista tratante y la administración tienen acceso dentro de los límites de la misión. No vendemos ni compartimos sus datos con ningún fin comercial.",
      },
      {
        title: "Fotos y medios",
        text: "Las fotos que sube a su perfil quedan para el uso interno de la cuenta. Las fotos y videos del centro publicados en la página de inicio son medios públicos que se difunden solo con la aprobación de la administración.",
      },
      {
        title: "Notificaciones",
        text: "Las notificaciones de recordatorio de citas (la víspera y una hora antes) se envían dentro del sitio; las notificaciones del dispositivo son opcionales, se activan solo con su consentimiento y pueden desactivarse en cualquier momento desde su navegador o desde la campana de notificaciones.",
      },
      {
        title: "Protección de la información",
        text: "Las contraseñas se almacenan cifradas (bcrypt), las sesiones están protegidas con mecanismos seguros y todas las rutas de datos aplican verificación de permisos. Recomendamos una contraseña fuerte y no compartirla con nadie.",
      },
      {
        title: "Sus derechos",
        text: "Puede solicitar consultar sus datos, corregirlos o eliminar su cuenta contactando directamente con la administración o desde la página «Sugerencias y quejas», y su solicitud será atendida lo antes posible.",
      },
    ],
    terms: [
      {
        title: "Aceptación de los términos",
        text: "Al usar el sitio del Centro Ait Tegrine y sus servicios, usted acepta estos términos. Si no los acepta, por favor no utilice el sitio.",
      },
      {
        title: "Cuentas y uso adecuado",
        text: "Las cuentas de especialistas y asistentes las crea exclusivamente la administración; la cuenta del cliente la crea él mismo con datos correctos. Se prohíbe la suplantación de identidad o el uso del sitio con fines contrarios a la ley o a la moral.",
      },
      {
        title: "Citas y cancelaciones",
        text: "La reserva se realiza según los horarios disponibles del sistema, y se pide respetar la cita. Si no puede asistir, se ruega cancelar o avisar con al menos 24 horas de antelación. El centro puede reprogramar la cita en caso de fuerza mayor notificándoselo.",
      },
      {
        title: "Precios y pago",
        text: "Los precios mostrados están en dinares argelinos y se pagan en el centro. Los precios pueden actualizarse de vez en cuando; se aplica el precio anunciado en el momento de la reserva.",
      },
      {
        title: "Naturaleza del servicio",
        text: "Los servicios psicológicos y de fonoaudiología son un apoyo profesional que no sustituye la evaluación médica cuando esta se requiere y no garantizan resultados determinados; el progreso varía según la persona y su compromiso.",
      },
      {
        title: "Propiedad intelectual",
        text: "Todo el contenido del sitio (textos, logotipo, imágenes, libros electrónicos) pertenece al centro, y los libros electrónicos se leen solo dentro del sitio, sin descarga, copia ni redistribución.",
      },
      {
        title: "Modificación de los términos",
        text: "El centro puede actualizar estos términos cuando sea necesario, y se aplica la versión publicada en el sitio. Cualquier cambio importante se anunciará en la página de inicio.",
      },
      {
        title: "Ley aplicable",
        text: "Estos términos se rigen por la ley argelina, y cualquier disputa se somete a los tribunales competentes de Argel.",
      },
    ],
  },
};

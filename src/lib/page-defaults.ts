/**
 * مركز أيت تقرين — المحتوى الافتراضي الاحترافي لصفحات الموقع
 * (أسئلة شائعة / عن المركز / الخصوصية / شروط الاستخدام) بثلاث لغات
 * تُعرض تلقائياً ما لم تُحرِّرها الإدارة من إعدادات المركز.
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
        a: "",
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
      { q: "Merkezde nasıl randevu alabilirim?", a: "Danışan hesabı oluşturun veya giriş yapın, ardından «Randevularım» sayfasına gidin ve «Yeni Randevu»ya dokunun: uzmanı, hizmeti, tarihi ve uygun saati seçin. Onay ve hatırlatma bildirimleri otomatik olarak size ulaşır." },
      { q: "Seanslar tamamen gizli mi?", a: "Evet. Tam gizlilik çalışmalarımızın temel ilkesidir; seansta söylenen her şey merkezin çerçevesi içinde kalır ve yalnızca tedavi eden uzman ile idare, meslek etiği sınırları içinde erişebilir." },
      { q: "Psikolojik bakım ile dil ve konuşma terapisi arasındaki fark nedir?", a: "Psikolojik bakım; bir psikologla sohbet, değerlendirme ve takip seanslarına dayanır. Dil ve konuşma terapisi ise konuşma, dil ve iletişim bozukluklarının (konuşma gecikmesi, sesletim, kekemelik vb.) teşhis ve tedavisidir; çocuklara ve yetişkinlere uygundur, tek başına veya psikolojik seanslara ek olarak uygulanabilir." },
      { q: "Hizmetlerden yararlanmak için reçete veya yönlendirme gerekir mi?", a: "Hayır, yönlendirme olmadan doğrudan randevu alabilirsiniz. Uzman bir tıbbi değerlendirme gerektiğini düşünürse sizi ilgili kuruma yönlendirir." },
      { q: "Seans ne kadar sürer ve ücreti ne kadar?", a: "Seans genellikle hizmet türüne göre 45-60 dakika sürer. Fiyatlar Cezayir Dinarı cinsinden her hizmetin yanında açıkça yazılıdır ve merkezde ödenir." },
      { q: "Sertifikalı eğitim programlarınız var mı?", a: "Evet, merkez psikolojik bakım ve dil-konuşma terapisi alanlarında profesyonel eğitimler düzenler; net bir ders programı (tarih, başlangıç, bitiş) ve programa göre katılım veya tamamlama sertifikası verilir." },
      { q: "Randevumu değiştirebilir veya iptal edebilir miyim?", a: "Evet, «Randevularım» sayfasından. Saat başkasına yarar sağlasın diye en az 24 saat öncesinden yapmanızı öneririz. Gerektiğinde uzman veya idare de alternatif bir saat önerebilir." },
      { q: "Dil ve konuşma terapisinde hangi yaştan itibaren çocuk kabul ediyorsunuz?", a: "Dil ve konuşma terapisi seanslarında 4 yaşından itibaren çocukları kabul ediyoruz; gerektiğinde ebeveyn de hazır bulunur. İlk değerlendirme, her çocuk için en uygun programı belirler." },
    ],
    about: [
      { title: "Biz kimiz", text: "Ait Tegrine Psikolojik Bakım, Dil-Konuşma Terapisi ve Eğitim Merkezi; Cezayir'in kalbinde (Bir Khadem) uzmanlaşmış bir alandır. Uzmanların profesyonelliğini mekanın sıcaklığıyla birleştirerek bireylere, çocuklara ve ailelere bütüncül psikolojik destek ile sertifikalı mesleki eğitimler sunar." },
      { title: "Misyonumuz", text: "Herkese, kendini dinleyebileceği ve profesyonel bir eşlikle dengesini yeniden kurabileceği güvenli bir alan sunmak; teori ve pratiği birleştiren eğitimlerle yetkin uzmanların yetişmesine katkıda bulunmak." },
      { title: "Vizyonumuz", text: "Psikolojik bakım ve dil-konuşma terapisinde ulusal düzeyde güvenilir bir referans olmak; psikolojik destek istemenin güçsüzlük değil güç olduğunu yaymak." },
      { title: "Değerlerimiz", text: "Tam gizlilik, yargılayıcı olmayan saygı, profesyonellik ve sürekli öğrenme, insanı sıcaklık ve önceden ilan edilen, gizli ücreti olmayan adil fiyatlar." },
      { title: "Ekibimiz", text: "Ekibimizde sertifikalı psikologlar ve dil-konuşma terapistleri, asistanlar ve organizasyona hızlı yaklaşan bir idari kadro bulunur. Her uzmanın sayfasında unvanı ve özgeçmişi görünür; randevular çakışma yaşamayan bir sistemle yönetilir." },
      { title: "Neden Ait Tegrine?", text: "Çünkü zihinsel sağlığın güven üzerine kurulu bir yolculuk olduğuna inanıyoruz: saygılı karşılama, otomatik hatırlatmalarla dakik randevular, gerektiğinde seanslar arası takip ve sohbet ile sanatsal ifadeyi birleştiren çeşitli terapi araçları." },
    ],
    privacy: [
      { title: "Topladığımız veriler", text: "Yalnızca hizmet için gereken asgari veriyi toplarız: hesap oluştururken ad-soyad, telefon numarası ve şifrelenmiş şifre; randevu ve rezervasyon verileri; ve gönüllü olarak paylaştığınız içerikler (öneriler, e-kitap yanıtları, profil fotoğrafı)." },
      { title: "Mesleki gizlilik", text: "Seanslara veya psikolojik dosyaya ilişkin her şey mutlak gizlilikle korunur; yalnızca tedavi eden uzman ve idare, görev kapsamında erişebilir. Verilerinizi asla satmayız veya ticari taraflarla paylaşmayız." },
      { title: "Fotoğraflar ve medya", text: "Yüklediğiniz fotoğraflar hesabınızın iç kullanımında kalır. Ana sayfada yayınlanan merkez fotoğraf ve videoları, yalnızca idarenin onayıyla paylaşılan genel içeriklerdir." },
      { title: "Bildirimler", text: "Randevu hatırlatmaları (bir gün önce ve bir saat önce) site içinde gönderilir; cihaz bildirimleri isteğe bağlıdır, yalnızca onayınızla etkinleşir ve dilediğiniz an kapatılabilir." },
      { title: "Veri güvenliği", text: "Şifreler şifrelenmiş olarak saklanır (bcrypt), oturumlar güvenli belirteçlerle korunur ve her veri yolunda yetki denetimi yapılır. Güçlü bir şifre seçmenizi ve kimseyle paylaşmamanızı öneririz." },
      { title: "Haklarınız", text: "Verilerinize erişme, düzeltme veya hesabınızı silme talebinde bulunabilirsiniz; idareyle iletişime geçin veya «Öneriler ve Bildirimler» sayfasını kullanın. Talebinize en kısa sürede yanıt veririz." },
    ],
    terms: [
      { title: "Koşulların kabulü", text: "Ait Tegrine Merkezi web sitesini ve hizmetlerini kullanarak bu koşulları kabul etmiş olursunuz. Kabul etmiyorsanız lütfen siteyi kullanmayın." },
      { title: "Hesaplar ve uygun kullanım", text: "Uzman ve asistan hesapları yalnızca idare tarafından oluşturulur; danışan hesabı doğru bilgilerle kendi kendine oluşturulur. Kimliğe bülme veya yasa dışı kullanım yasaktır." },
      { title: "Randevular ve iptal", text: "Rezervasyon sistemdeki uygun saatlere göre yapılır. Lütfen randevuya uyun; olmazsa en az 24 saat öncesinden iptal edin veya haber verin. Zorunlu hallerde merkez randevuyu sizi bilgilendirerek yeniden planlayabilir." },
      { title: "Fiyatlar ve ödeme", text: "Gösterilen fiyatlar Cezayir Dinarı'dır ve merkezde ödenir. Fiyatlar zaman zaman güncellenebilir; rezervasyon anında ilan edilen fiyat geçerlidir." },
      { title: "Hizmetin niteliği", text: "Psikolojik ve dil-konuşma terapisi hizmetleri profesyonel bir destektir; gerektiğinde tıbbi değerlendirmenin yerini almaz ve belirli sonuçlar garanti etmez; ilerleme kişinin katılımına ve koşullara göre değişir." },
      { title: "Fikri mülkiyet", text: "Sitedeki tüm içerik (metinler, logo, görseller, e-kitaplar) merkeze aittir. E-kitaplar yalnızca site içinde okunur; indirme, kopyalama ve yeniden paylaşım yasaktır." },
      { title: "Koşullarda değişiklik", text: "Merkez gerektiğinde bu koşulları güncelleyebilir; sitede yayınlanan sürüm geçerlidir. Önemli değişiklikler ana sayfada duyurulur." },
      { title: "Uygulanacak hukuk", text: "Bu koşullar Cezayir hukukuna tabidir; uyuşmazlıklar Cezayir'in yetkili mahkemelerine götürülür." },
    ],
  },
  es: {
    faq: [
      { q: "¿Cómo reservo una cita en el centro?", a: "Cree una cuenta de cliente o inicie sesión, vaya a «Mis citas» y pulse «Nueva cita»: elija el especialista, el servicio, la fecha y la hora disponible. Recibirá automáticamente las notificaciones de confirmación y recordatorio." },
      { q: "¿Las sesiones son totalmente confidenciales?", a: "Sí. La confidencialidad total es un principio fundamental de nuestro trabajo; todo lo que se dice en la sesión queda dentro del marco del centro, y solo el especialista tratante y la administración tienen acceso dentro de los límites éticos profesionales." },
      { q: "¿Cuál es la diferencia entre la atención psicológica y la logopedia?", a: "La atención psicológica se basa en sesiones de diálogo, evaluación y seguimiento con un psicólogo. La logopedia diagnostica y trata trastornos del habla, el lenguaje y la comunicación (retraso del habla, pronunciación, tartamudez, etc.); es adecuada para niños y adultos y puede aplicarse sola o junto a las sesiones psicológicas." },
      { q: "¿Necesito una receta o una derivación para usar los servicios?", a: "No. Puede reservar directamente sin derivación. Si se requiere una evaluación médica especializada, el especialista le orientará hacia el lugar adecuado." },
      { q: "¿Cuánto dura una sesión y cuánto cuesta?", a: "La sesión suele durar entre 45 y 60 minutos según el servicio. Los precios son claros y se muestran junto a cada servicio en dinares argelinos, y se pagan en el centro." },
      { q: "¿Ofrecen formaciones con certificado?", a: "Sí, el centro imparte formaciones profesionales en atención psicológica y logopedia con un programa claro de sesiones (fecha, inicio, fin) y un certificado de participación o finalización según el programa." },
      { q: "¿Puedo cambiar o cancelar mi cita?", a: "Sí, desde «Mis citas». Recomendamos hacerlo con al menos 24 horas de antelación para que el horario pueda aprovecharlo otra persona. El especialista o la administración también pueden proponerle un horario alternativo si es necesario." },
      { q: "¿Desde qué edad atienden niños en logopedia?", a: "Recibimos niños a partir de los 4 años en sesiones de logopedia, con la presencia de un progenitor cuando es necesario. La evaluación inicial define el programa más adecuado para cada niño." },
    ],
    about: [
      { title: "Quiénes somos", text: "El Centro Ait Tegrine de atención psicológica, logopedia y formación es un espacio especializado en el corazón de Argel (Bir Khadem), que une la profesionalidad de sus especialistas con la calidez del lugar. Ofrece atención psicológica integral a personas, niños y familias, además de formaciones profesionales certificadas." },
      { title: "Nuestra misión", text: "Ofrecer a cada persona un espacio seguro para escucharse y recuperar su equilibrio con un acompañamiento profesional de calidad, y contribuir a la formación de especialistas competentes mediante programas que combinan teoría y práctica." },
      { title: "Nuestra visión", text: "Ser una referencia nacional confiable en atención psicológica y logopedia, y difundir que pedir ayuda psicológica es una muestra de fuerza, no de debilidad." },
      { title: "Nuestros valores", text: "Confidencialidad absoluta, respeto sin juicios, profesionalidad y actualización constante, cercanía humana y precios justos anunciados de antemano, sin costes ocultos." },
      { title: "Nuestro equipo", text: "Nuestro equipo reúne psicólogos y logopedas certificados, asistentes y un equipo administrativo atento a la organización y la rapidez de respuesta. Cada especialista muestra su título y biografía en su página, y un sistema sin conflictos gestiona las citas." },
      { title: "¿Por qué Ait Tegrine?", text: "Porque creemos que cuidar la mente es un viaje que se construye sobre la confianza: una acogida respetuosa, citas puntuales con recordatorios automáticos, seguimiento entre sesiones cuando hace falta y herramientas terapéuticas variadas que combinan el diálogo y la expresión artística." },
    ],
    privacy: [
      { title: "Los datos que recopilamos", text: "Recopilamos lo mínimo necesario para prestar el servicio: nombre completo, teléfono y contraseña cifrada al crear la cuenta; los datos de citas y servicios reservados; y cualquier contenido que comparta voluntariamente (sugerencias, respuestas de los e-books, foto de perfil)." },
      { title: "Confidencialidad profesional", text: "Todo lo registrado en las sesiones o en el historial psicológico se trata con total confidencialidad; solo el especialista tratante y la administración acceden dentro del alcance de su función. Nunca vendemos ni compartimos sus datos con terceros comerciales." },
      { title: "Fotos y medios", text: "Las fotos que sube quedan para el uso interno de su cuenta. Las fotos y vídeos del centro publicados en la página principal son contenidos públicos difundidos solo con la aprobación de la administración." },
      { title: "Notificaciones", text: "Los recordatorios de citas (el día anterior y una hora antes) se envían dentro del sitio; las notificaciones del dispositivo son opcionales, se activan solo con su consentimiento y pueden desactivarse en cualquier momento." },
      { title: "Protección de datos", text: "Las contraseñas se almacenan cifradas (bcrypt), las sesiones están protegidas con tokens seguros y todas las rutas de datos verifican permisos. Le recomendamos una contraseña fuerte que no comparta con nadie." },
      { title: "Sus derechos", text: "Puede solicitar acceder a sus datos, corregirlos o eliminar su cuenta contactando con la administración o desde la página «Sugerencias e informes»; responderemos lo antes posible." },
    ],
    terms: [
      { title: "Aceptación de las condiciones", text: "Al usar el sitio del Centro Ait Tegrine y sus servicios, acepta estas condiciones. Si no está de acuerdo, por favor no utilice el sitio." },
      { title: "Cuentas y uso adecuado", text: "Las cuentas de especialistas y asistentes las crea únicamente la administración; la cuenta de cliente se crea libremente con datos verídicos. Se prohíbe la suplantación de identidad o cualquier uso ilícito." },
      { title: "Citas y cancelaciones", text: "La reserva se realiza según los horarios disponibles del sistema. Se pide puntualidad; si no puede asistir, cancele o avise con al menos 24 horas. En casos de fuerza mayor, el centro puede reprogramar la cita avisándole." },
      { title: "Precios y pago", text: "Los precios mostrados están en dinares argelinos y se pagan en el centro. Pueden actualizarse ocasionalmente; rige el precio anunciado al momento de la reserva." },
      { title: "Naturaleza del servicio", text: "Los servicios psicológicos y de logopedia son un apoyo profesional; no sustituyen la evaluación médica cuando esta es necesaria ni garantizan resultados concretos; el progreso varía según la persona y su constancia." },
      { title: "Propiedad intelectual", text: "Todo el contenido del sitio (textos, logotipo, imágenes, e-books) pertenece al centro. Los e-books se leen únicamente dentro del sitio, sin descargas, copias ni redistribución." },
      { title: "Modificación de las condiciones", text: "El centro puede actualizar estas condiciones cuando sea necesario; rige la versión publicada en el sitio. Todo cambio importante se anunciará en la página principal." },
      { title: "Legislación aplicable", text: "Estas condiciones se rigen por la ley argelina; cualquier disputa se somete a los tribunales competentes de Argel." },
    ],
  },
};

/**
 * المساعد الذكي (v3.8.1) — محرك مطابقة ذكي بخمس لغات
 * POST /api/chatbot { message, lang? }
 * ★ ما الجديد عن v3.8:
 *   - تقييم بالكلمات المفتاحية لكل القواعد ثم اختيار الأفضل (وليس أول مطابقة)
 *   - تطبيع أعمق: همزات/تشكيل/تاء مربوطة/همزة نهاية + اللهجات (بن/بك/وش/كاين...)
 *   - قواعد موسعة: 30 موضوعاً (حجز/أسعار/عنوان/ساعات/إلغاء/عن بعد/أخصائيون/تخصصات/
 *     تكوينات/كتب/مقالات/كوبونات/فواتير/إشعارات/تثبيت التطبيق/تغيير اللغة/حساب/
 *     كلمة مرور/دخول Google/خصوصية/أطفال/قلق واكتئاب/شهادات/تواصل/تقويم/ترحيب/شكر/مساعدة)
 *   - إجابات بخمس لغات (عربي/فرنسي/إنجليزي/تركي/إسباني)
 *   - الأسئلة الشائعة المُدارة تُقرأ بكل لغاتها مع تسجيل تطابق أفضل
 * بلا ذكاء خارجي — يعمل دائماً وبلا تكلفة وبلا إنترنت خارجي
 */
import { NextRequest } from "next/server";
import { ok, handle } from "@/lib/api-helpers";
import { PageContent } from "@/lib/models";

type Penta = { ar: string; fr: string; en: string; tr: string; es: string };

type BotReply = {
  text: string;
  textFr?: string;
  textEn?: string;
  textTr?: string;
  textEs?: string;
  link?: string;
  linkLabel?: string;
  linkLabelFr?: string;
  linkLabelEn?: string;
  linkLabelTr?: string;
  linkLabelEs?: string;
};

const R = (
  ar: string, fr: string, en: string, tr: string, es: string,
  link?: string,
  ll?: [string, string, string, string, string] // [ar, fr, en, tr, es]
): BotReply => ({
  text: ar,
  textFr: fr,
  textEn: en,
  textTr: tr,
  textEs: es,
  ...(link && ll
    ? {
        link,
        linkLabel: ll[0],
        linkLabelFr: ll[1],
        linkLabelEn: ll[2],
        linkLabelTr: ll[3],
        linkLabelEs: ll[4],
      }
    : {}),
});

/** قواعد الم مطابقة — التقييم يجمع الكلمات المطابقة ويختار الأعلى */
const RULES: { keys: string[]; reply: BotReply; weight?: number }[] = [
  {
    keys: ["حجز", "احجز", "موعد", "book", "booking", "appointment", "rendez", "réserver", "réservation", "randez", "randevu", "cita", "reservar", "ساعة", "وقت", "slot"],
    reply: R(
      "يسعدنا خدمتك! يمكنك حجز موعدك مباشرة من صفحة المواعيد: اختر الأخصائي ثم التاريخ والوقت المتاح، وستصلك إشعارات التأكيد والتذكير تلقائياً. إن رغبة في جلسة عن بُعد اختر «عن بُعد» كطريقة للجلسة.",
      "Nous serions ravis de vous servir ! Réservez votre rendez-vous depuis la page des rendez-vous : choisissez le spécialiste, puis la date et l'horaire disponibles. Vous recevrez automatiquement les notifications de confirmation et de rappel. Pour une séance à distance, choisissez « à distance ».",
      "We'd be happy to help! Book your appointment directly from the appointments page: pick your specialist, then the date and available time. Confirmation and reminder notifications are sent automatically. For a remote session, choose “remote”.",
      "Size memnuniyetle hizmet ederiz! Randevunuzu doğrudan Randevular sayfasından alın: önce uzmanı, sonra tarihi ve uygun saati seçin. Onay ve hatırlatma bildirimleri otomatik olarak size ulaşır. Uzaktan seans için «uzaktan» seçeneğini seçin.",
      "¡Con gusto le atendemos! Reserve su cita directamente desde la página de citas: elija al especialista, luego la fecha y la hora disponible. Recibirá automáticamente las notificaciones de confirmación y recordatorio. Para una sesión a distancia, elija «a distancia».",
      "appointments",
      ["حجز موعد الآن", "Réserver maintenant", "Book now", "Şimdi randevu al", "Reservar ahora"]
    ),
  },
  {
    keys: ["سعر", "أسعار", "تكلفة", "كم", "price", "prix", "coût", "cout", "combien", "tarif", "cost", "دج", "دينار", "fiyat", "ücret", "precio", "cuánto", "cuanto", "kaç"],
    reply: R(
      "تختلف الأسعار حسب الخدمة والتكوين، وهي معلنة بكل شفافية بالدينار الجزائري. تجد السعر بجانب كل خدمة في صفحة الخدمات وسعر التكوين في صفحة التكوينات، وبعض كوبونات الخصم تمنحك تخفيضاً إضافياً عند الحجز.",
      "Les tarifs varient selon le service et la formation, et sont affichés en toute transparence en dinars algériens. Le prix figure à côté de chaque service dans la page Services, et celui des formations dans leur page. Certains coupons de réduction offrent une remise supplémentaire à la réservation.",
      "Prices vary by service and training and are displayed transparently in Algerian Dinars. Each service shows its price on the Services page, and trainings show theirs on the Courses page. Some discount coupons give you an extra discount at booking.",
      "Fiyatlar hizmete ve eğitime göre değişir ve Cezayir Dinarı cinsinden şeffaf şekilde ilan edilir. Her hizmetin fiyatı Hizmetler sayfasında, eğitimlerin fiyatı ise Eğitimler sayfasında yazar. Bazı indirim kuponları rezervasyonda ek indirim sağlar.",
      "Los precios varían según el servicio y el curso, y se muestran con total transparencia en dinares argelinos. El precio aparece junto a cada servicio en la página de Servicios y el de los cursos en su página. Algunos cupones de descuento le dan una reducción extra al reservar.",
      "services",
      ["تصفح الخدمات والأسعار", "Voir les services et tarifs", "Browse services & prices", "Hizmetleri ve fiyatları gör", "Ver servicios y precios"]
    ),
  },
  {
    keys: ["خصم", "كوبون", "عرض", "تخفيض", "coupon", "discount", "promo", "réduction", "reduction", "offre", "indirim", "kupon", "cupón", "cupon", "descuento", "code"],
    reply: R(
      "نوفّر كوبونات خصم دورية (نسبة أو مبلغ ثابت). إن كان لديك رمز كوبون أدخله في خانة «رمز الخصم» عند خطوة التأكيد أثناء الحجز وسيُطبق الخصم تلقائياً على سعر الجلسة.",
      "Nous offrons régulièrement des coupons de réduction (pourcentage ou montant fixe). Si vous avez un code, saisissez-le dans le champ « code promo » à l'étape de confirmation et la réduction s'appliquera automatiquement.",
      "We regularly offer discount coupons (percentage or fixed amount). If you have a code, enter it in the “promo code” field at the confirmation step of booking and the discount applies automatically.",
      "Düzenli olarak indirim kuponları sunuyoruz (yüzde veya sabit tutar). Bir kodunuz varsa, rezervasyonun onay adımında «indirim kodu» alanına girin; indirim otomatik uygulanır.",
      "Ofrecemos cupones de descuento periódicos (porcentaje o monto fijo). Si tiene un código, escríbalo en el campo «código de descuento» en el paso de confirmación y el descuento se aplicará automáticamente.",
      "appointments",
      ["استعمل كوبونك عند الحجز", "Utiliser mon coupon", "Use my coupon", "Kuponumu kullan", "Usar mi cupón"]
    ),
  },
  {
    keys: ["عن بعد", "اونلاين", "أونلاين", "online", "remote", "video", "visio", "distance", "زووم", "zoom", "uzaktan", "distancia", "en ligne"],
    reply: R(
      "نعم، تتوفر جلسات عن بُعد بالفيديو بجانب الجلسات الحضورية. عند الحجز اختر «عن بُعد» كطريقة للجلسة وستستعمل نفس صفحة المواعيد لمتابعة موعدك وتذكيراته.",
      "Oui, des séances à distance par visioconférence sont disponibles en plus des séances présentes. Choisissez « à distance » lors de la réservation ; la page des rendez-vous reste la même pour le suivi et les rappels.",
      "Yes, remote video sessions are available alongside in-person ones. Choose “remote” as the session mode when booking; the same appointments page handles follow-up and reminders.",
      "Evet, yüz yüze seansların yanı sıra görüntülü uzaktan seanslar da mevcuttur. Rezervasyon yaparken «uzaktan» seçeneğini seçin; takip ve hatırlatmalar için aynı Randevular sayfası kullanılır.",
      "Sí, hay sesiones a distancia por video además de las presenciales. Al reservar elija «a distancia» como modalidad; la misma página de citas gestiona el seguimiento y los recordatorios.",
      "appointments",
      ["حجز جلسة عن بُعد", "Réserver à distance", "Book a remote session", "Uzaktan seans ayarla", "Reservar sesión a distancia"]
    ),
  },
  {
    keys: ["تخصص", "أخصائي", "اخصائي", "طبيب", "معالج", "specialist", "docteur", "médecin", "orthophoniste", "psychologue", "doctor", "uzman", "terapist", "especialista", "psicólogo", "psicologo", "logopeda", "فريق"],
    reply: R(
      "يضم مركزنا فريقاً من الأخصائيين النفسيين وأخصائيي الأرطفونية المعتمدين. تصفح بطاقات الفريق في الرئيسية للاطلاع على خبرة كل أخصائي ولغاته وتقييماته، ثم احجز معه مباشرة.",
      "Notre centre réunit des psychologues et orthophonistes agréés. Parcourez les fiches de l'équipe sur la page d'accueil : expérience, langues et évaluations, puis réservez directement.",
      "Our center brings together licensed psychologists and speech therapists. Browse the team cards on the home page to see each specialist's experience, languages, and ratings, then book directly with them.",
      "Merkezimiz, sertifikalı psikologlar ve dil-konuşma terapistlerinden oluşan bir ekibe sahiptir. Ana sayfadaki ekip kartlarından her uzmanın deneyimini, dillerini ve değerlendirmelerini inceleyip doğrudan randevu alabilirsiniz.",
      "Nuestro centro reúne a psicólogos y logopedas titulados. Explore las tarjetas del equipo en la página principal para ver la experiencia, los idiomas y las valoraciones de cada especialista, y reserve directamente con él.",
      "specialists",
      ["تعرف على فريق الأخصائيين", "Découvrir l'équipe", "Meet the team", "Ekibi tanıyın", "Conocer al equipo"]
    ),
  },
  {
    keys: ["تكوين", "دورة", "ورشة", "formation", "cours", "atelier", "training", "course", "workshop", "eğitim", "kurs", "curso", "formación", "formacion", "talleres"],
    reply: R(
      "ننظم تكوينات ودورات في علم النفس والأرطفونية على مدار السنة ببرنامج حصص واضح (تاريخ، بداية، نهاية) مع شهادة مشاركة أو إتمام. سجل نفسك من صفحة التكوينات وستجد التفاصيل والأسعار.",
      "Nous organisons des formations en psychologie et orthophonie toute l'année, avec un programme daté (date, début, fin) et une attestation ou certificat. Inscrivez-vous depuis la page des formations : détails et tarifs inclus.",
      "We organize psychology and speech-therapy trainings throughout the year with a clear session schedule (date, start, end) and a participation or completion certificate. Register from the Courses page — details and prices included.",
      "Yıl boyunca psikoloji ve dil-konuşma terapisi alanlarında eğitimler düzenliyoruz; net bir ders programı (tarih, başlangıç, bitiş) ve katılım/tamamlama sertifikası ile. Ayrıntılar ve fiyatlar için Eğitimler sayfasından kaydolun.",
      "Organizamos formaciones de psicología y logopedia durante todo el año, con un programa claro de sesiones (fecha, inicio, fin) y certificado de participación o finalización. Inscríbase desde la página de Cursos: detalles y precios incluidos.",
      "courses",
      ["استكشف التكوينات", "Explorer les formations", "Explore courses", "Eğitimleri keşfet", "Explorar cursos"]
    ),
  },
  {
    keys: ["موقع", "عنوان", "وين", "أين", "خريطة", "address", "adresse", "location", "où", "ou", "map", "مقر", "adres", "konum", "nerede", "dirección", "direccion", "dónde", "donde"],
    reply: R(
      "تجد عنوان المركز وخرائط Google ومعلومات الاتصال كاملة في صفحة التواصل، وكذلك أسفل كل صفحة في التذييل. الموقع في الجزائر العاصمة — بيرخادم.",
      "L'adresse du centre, la carte Google Maps et les coordonnées figurent sur la page Contact, ainsi qu'en pied de page. Le centre se situe à Alger — Bir Khadem.",
      "The center's address, Google Maps and contact details are on the Contact page, and in the footer of every page. The center is located in Algiers — Bir Khadem.",
      "Merkezin adresi, Google Haritalar ve iletişim bilgileri İletişim sayfasında ve her sayfanın alt Bilgisinde yer alır. Merkez Cezayir — Bir Khadem'dedir.",
      "La dirección del centro, el mapa de Google y los datos de contacto están en la página de Contacto, y también en el pie de todas las páginas. El centro está en Argel — Bir Khadem.",
      "contact",
      ["افتح صفحة التواصل", "Page contact", "Contact page", "İletişim sayfası", "Página de contacto"]
    ),
  },
  {
    keys: ["وقت", "توقيت", "ساعات", "يفتح", "أيام", "مفتوح", "horaires", "heures", "ouvert", "hours", "schedule", "open", "saat", "çalışma", "horario", "abierto"],
    reply: R(
      "أوقات العمل تظهر عند الحجز: التقويم الخاص بكل أخصائي يعرض أيامه وساعاته الفعلية، وتُحدَّث لحظياً مع كل حجز جديد حتى لا يحدث أي تعارض.",
      "Les horaires apparaissent à la réservation : le calendrier de chaque spécialiste affiche ses jours et heures réels, mis à jour en temps réel à chaque réservation.",
      "Working times appear when booking: each specialist's calendar shows their actual days and hours, updated live with every new booking to prevent any conflict.",
      "Çalışma saatleri rezervasyon sırasında görünür: her uzmanın takvimi kendi gerçek gün ve saatlerini gösterir ve çakışma olmaması için her rezervasyonla anında güncellenir.",
      "Los horarios aparecen al reservar: el calendario de cada especialista muestra sus días y horas reales, y se actualiza en tiempo real con cada reserva para evitar conflictos.",
      "appointments",
      ["شاهد الأوقات المتاحة", "Voir les disponibilités", "See availability", "Uygun saatleri gör", "Ver disponibilidad"]
    ),
  },
  {
    keys: ["إلغاء", "الغاء", "ألغي", "تأجيل", "تغيير موعد", "annuler", "annulation", "cancel", "iptal", "cancelar", "cancelación", "cancelacion", "déplacer", "reporter"],
    reply: R(
      "يمكنك إلغاء موعدك من صفحة «مواعيدي» في أي وقت، ويُستحسن ذلك قبل 24 ساعة على الأقل حتى يستفيد غيرك من الوقت. الأخصائي أو الإدارة قد يقترحان لك موعداً بديلاً عند الضرورة.",
      "Vous pouvez annuler votre rendez-vous depuis « Mes rendez-vous » à tout moment, idéalement au moins 24 heures à l'avance. Le spécialiste ou l'administration peut aussi vous proposer un créneau alternatif si nécessaire.",
      "You can cancel your appointment from “My Appointments” anytime, ideally at least 24 hours ahead so the slot can serve someone else. The specialist or the administration may also suggest an alternative time when needed.",
      "Randevunuzu «Randevularım» sayfasından dilediğiniz zaman iptal edebilirsiniz; mümkünse en az 24 saat öncesinden yapın. Gerektiğinde uzman veya idare size alternatif bir saat önerebilir.",
      "Puede cancelar su cita desde «Mis citas» en cualquier momento, idealmente con al menos 24 horas de antelación. El especialista o la administración también pueden proponerle un horario alternativo si es necesario.",
      "appointments",
      ["إدارة مواعيدي", "Mes rendez-vous", "My appointments", "Randevularım", "Mis citas"]
    ),
  },
  {
    keys: ["كتاب", "كتب", "مطالعة", "ebook", "livre", "livres", "lecture", "reading", "kitap", "libro", "libros"],
    reply: R(
      "مكتبتنا الإلكترونية توفر كتباً تفاعلية بأسطر إجابات يمكنك تعبئتها داخل الموقع مباشرة — بلا تحميل ولا حساب بريدي، وتُحفظ إجاباتك في حسابك.",
      "Notre bibliothèque propose des livres interactifs avec lignes de réponses à remplir directement sur le site — sans téléchargement, et vos réponses sont sauvegardées dans votre compte.",
      "Our digital library offers interactive books with answer lines you can fill in right on the site — no downloads needed, and your answers are saved to your account.",
      "E-kitap kütüphanemizde, yanıtlarını doğrudan site içinde doldurabileceğiniz interaktif kitaplar var — indirme gerekmez ve yanıtlarınız hesabınızda saklanır.",
      "Nuestra biblioteca digital ofrece libros interactivos con líneas de respuestas que puede completar dentro del sitio — sin descargas, y sus respuestas se guardan en su cuenta.",
      "ebooks",
      ["افتح المكتبة الإلكترونية", "Ouvrir la bibliothèque", "Open the library", "Kütüphaneyi aç", "Abrir la biblioteca"]
    ),
  },
  {
    keys: ["مقال", "مقالات", "ابحاث", "أبحاث", "article", "articles", "blog", "recherche", "makale", "artículo", "articulo", "artículos", "articulos"],
    reply: R(
      "ينشر فريقنا مقالات علمية مبسطة في علم النفس والأرطفونية — متاحة للجميع مجاناً في صفحة المقالات.",
      "Notre équipe publie des articles scientifiques vulgarisés en psychologie et orthophonie — gratuits pour tous.",
      "Our team publishes accessible scientific articles on psychology and speech therapy — free for everyone.",
      "Ekibimiz psikoloji ve dil-konuşma terapisi üzerine sadeleşmiş bilimsel makaleler yayımlıyor — herkese ücretsiz.",
      "Nuestro equipo publica artículos científicos divulgativos sobre psicología y logopedia — gratuitos para todos.",
      "articles",
      ["اقرأ المقالات", "Lire les articles", "Read articles", "Makaleleri oku", "Leer artículos"]
    ),
  },
  {
    keys: ["فاتورة", "فواتير", "invoice", "facture", "fatura", "factura", "إيصال"],
    reply: R(
      "تُصدر فاتورة PDF رسمية بشعار المركز تلقائياً عند انتهاء الجلسة المدفوعة، ويمكن تحميلها من المواعيد المؤكدة/المنتهية. الفاتورة تظهر بلسان واجهة المستخدم المختار.",
      "Une facture PDF officielle avec le logo du centre est générée automatiquement à la fin de la séance payée, téléchargeable depuis les rendez-vous confirmés/terminés. La facture s'affiche dans la langue d'interface choisie.",
      "An official PDF invoice with the center's logo is generated automatically when a paid session ends, downloadable from confirmed/completed appointments. The invoice appears in the chosen interface language.",
      "Ücretli seans tamamlandığında merkez logosuyla resmi bir PDF fatura otomatik oluşturulur ve onaylanmış/tamamlanmış randevulardan indirilebilir. Fatura, seçilen arayüz dilinde görünür.",
      "Se genera automáticamente una factura oficial en PDF con el logotipo del centro al finalizar la sesión pagada, descargable desde las citas confirmadas/finalizadas. La factura aparece en el idioma de interfaz elegido.",
      "appointments",
      ["عرض مواعيدي", "Mes rendez-vous", "My appointments", "Randevularım", "Mis citas"]
    ),
  },
  {
    keys: ["إشعار", "اشعار", "إشعارات", "notification", "push", "rappel", "rappel", "bildirim", "notificación", "notificacion", "recordatorio", "تذكير"],
    reply: R(
      "إشعارات الموقع (الجرس) تصلك تلقائياً عند كل تحديث، وإشعارات الجهاز (Push) اختيارية: فعّلها من جرس الإشعارات لتصلك تذكيرات المواعيد حتى والموقع مغلق. ويمكنك تعطيلها في أي وقت من متصفحك.",
      "Les notifications du site (cloche) arrivent automatiquement à chaque mise à jour ; les notifications d'appareil (push) sont optionnelles : activez-les depuis la cloche pour recevoir les rappels même site fermé, et désactivez-les quand vous voulez.",
      "In-site notifications (the bell) arrive automatically with every update; device push notifications are optional: enable them from the bell to receive reminders even with the site closed, and disable them anytime from your browser.",
      "Site bildirimleri (zil) her güncellemede otomatik gelir; cihaz bildirimleri (push) isteğe bağlıdır: zilden etkinleştirin ki site kapalıyken bile hatırlatmalar gelsin; dilediğiniz an tarayıcıdan kapatabilirsiniz.",
      "Las notificaciones del sitio (la campana) llegan automáticamente con cada actualización; las notificaciones del dispositivo (push) son opcionales: actívelas desde la campana para recibir recordatorios incluso con el sitio cerrado, y desactívelas cuando quiera.",
      "landing",
      ["متابعة إشعاراتي", "Mes notifications", "My notifications", "Bildirimlerim", "Mis notificaciones"]
    ),
  },
  {
    keys: ["تحميل", "تثبيت", "تطبيق", "install", "pwa", "application", "appli", "uygulama", "indir", "instalar", "aplicación", "aplicacion", "app"],
    reply: R(
      "يمكنك تثبيت الموقع كتطبيق على هاتفك: من قائمة المتصفح اختر «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق». بعد التثبيت يعمل الموقع حتى دون اتصال بالإنترنت.",
      "Vous pouvez installer le site comme application sur votre téléphone : dans le menu du navigateur, choisissez « Ajouter à l'écran d'accueil » ou « Installer l'application ». Une fois installé, le site fonctionne même sans connexion.",
      "You can install the site as an app on your phone: from the browser menu choose “Add to Home screen” or “Install app”. Once installed, the site works even without internet.",
      "Siteyi telefonunuza uygulama olarak kurabilirsiniz: tarayıcı menüsünden «Ana ekrana ekle» veya «Uygulamayı yükle» seçeneğini seçin. Kurulduktan sonra site internet olmadan da çalışır.",
      "Puede instalar el sitio como aplicación en su teléfono: en el menú del navegador elija «Añadir a la pantalla de inicio» o «Instalar aplicación». Una vez instalado, el sitio funciona incluso sin internet.",
      "landing",
      ["تعرف على التثبيت", "Guide d'installation", "Install guide", "Kurulum rehberi", "Guía de instalación"]
    ),
  },
  {
    keys: ["لغة", "ترجمة", "language", "langue", "traduction", "dil", "çeviri", "idioma", "lenguaje", "traducción", "traduccion", "arabe", "français", "anglais", "turkish", "espagnol", "عربي", "فرنسي", "انجليزي", "تركي", "اسباني"],
    reply: R(
      "الموقع متوفر بخمس لغات: العربية، الفرنسية، الإنجليزية، التركية والإسبانية. غيّر اللغة من زر الكرة الأرضية في الأعلى — كل الصفحات والنوافذ والإشعارات ستترجم تلقائياً.",
      "Le site est disponible en cinq langues : arabe, français, anglais, turc et espagnol. Changez la langue via le bouton globe en haut — toutes les pages, fenêtres et notifications seront traduites automatiquement.",
      "The site is available in five languages: Arabic, French, English, Turkish and Spanish. Change the language from the globe button at the top — all pages, dialogs and notifications translate automatically.",
      "Site beş dilde mevcuttur: Arapça, Fransızca, İngilizce, Türkçe ve İspanyolca. Dili üstteki küre düğmesinden değiştirin — tüm sayfalar, pencereler ve bildirimler otomatik çevrilir.",
      "El sitio está disponible en cinco idiomas: árabe, francés, inglés, turco y español. Cambie el idioma desde el botón del globo en la parte superior — todas las páginas, ventanas y notificaciones se traducen automáticamente.",
      "landing",
      ["تجربة تغيير اللغة", "Changer de langue", "Change language", "Dili değiştir", "Cambiar idioma"]
    ),
  },
  {
    keys: ["حساب", "تسجيل", "انشاء", "إنشاء", "سجل", "register", "signup", "sign up", "compte", "inscrire", "kayıt", "hesap", "registro", "cuenta", "crear cuenta"],
    reply: R(
      "أنشئ حسابك من صفحة الدخول بتبويب «حساب جديد»: أدخل اسمك الكامل ورقم هاتفك وكلمة مرور قوية. حساب العميل يُنشأ فوراً، أما حسابات الأخصائيين فتُنشأ من الإدارة.",
      "Créez votre compte depuis l'onglet « Nouveau compte » de la page de connexion : nom complet, téléphone et mot de passe solide. Le compte client est créé immédiatement ; les comptes spécialistes sont créés par l'administration.",
      "Create your account from the “New account” tab on the login page: full name, phone number and a strong password. Client accounts are created instantly; specialist accounts are created by the administration.",
      "Giriş sayfasındaki «Yeni hesap» sekmesinden hesabınızı oluşturun: ad-soyad, telefon ve güçlü bir şifre. Danışan hesabı anında oluşturulur; uzman hesapları idare tarafından oluşturulur.",
      "Cree su cuenta desde la pestaña «Nueva cuenta» de la página de inicio de sesión: nombre completo, teléfono y una contraseña fuerte. Las cuentas de cliente se crean al instante; las de especialistas las crea la administración.",
      "login",
      ["صفحة الدخول", "Page de connexion", "Login page", "Giriş sayfası", "Página de inicio de sesión"]
    ),
  },
  {
    keys: ["كلمة السر", "كلمة المرور", "نسيت", "password", "forgot", "mot de passe", "oublié", "oublie", "şifre", "unuttum", "contraseña", "olvidado", "recuperar"],
    reply: R(
      "نسيت كلمة المرور؟ من صفحة الدخول اضغط «نسيت كلمة المرور» وأرسل طلب استعادة — ستعالجه الإدارة وتعطيك كلمة مرور مؤقتة. وإن كنت سجلت عبارة استرجاع عند التسجيل يمكنك استعادة الحساب بنفسك فوراً.",
      "Mot de passe oublié ? Depuis la page de connexion, cliquez sur « Mot de passe oublié » et envoyez une demande — l'administration la traitera et vous donnera un mot de passe temporaire. Si vous avez enregistré une phrase de récupération, vous pouvez récupérer votre compte vous-même immédiatement.",
      "Forgot your password? On the login page press “Forgot password” and send a recovery request — the administration will process it and give you a temporary password. If you saved a recovery phrase at sign-up, you can recover your account yourself instantly.",
      "Şifrenizi mi unuttunuz? Giriş sayfasında «Şifremi unuttum»a dokunun ve kurtarma talebi gönderin — idare talebi işleme alıp size geçici bir şifre verecek. Kayıt sırasında kurtarma ifadesi kaydettiyseniz hesabınızı kendiniz anında geri alabilirsiniz.",
      "¿Olvidó su contraseña? En la página de inicio de sesión pulse «¿Olvidó su contraseña?» y envíe una solicitud de recuperación — la administración la procesará y le dará una contraseña temporal. Si guardó una frase de recuperación al registrarse, puede recuperar su cuenta al instante.",
      "login",
      ["استعادة حسابي", "Récupérer mon compte", "Recover my account", "Hesabımı kurtar", "Recuperar mi cuenta"]
    ),
  },
  {
    keys: ["google", "جوجل", "قوقل", "oauth", "gmail"],
    reply: R(
      "يمكنك الدخول بحساب Google من بوابة العملاء: اضغط زر «الدخول بحساب Google» بجانب الدخول بالهاتف. أول دخول ينشئ حساب عميل مرتبطاً ببريدك تلقائياً، وتبقى طريقة الهاتف وكلمة المرور متاحة دائماً.",
      "Vous pouvez vous connecter avec votre compte Google depuis le portail client : appuyez sur « Se connecter avec Google » à côté de la connexion par téléphone. La première connexion crée automatiquement un compte client lié à votre e-mail ; la connexion par téléphone reste toujours disponible.",
      "You can sign in with your Google account from the client portal: press “Sign in with Google” next to phone login. The first sign-in automatically creates a client account linked to your email; phone login remains always available.",
      "Danışan portalından Google hesabınızla giriş yapabilirsiniz: telefonla girişin yanındaki «Google ile giriş» düğmesine dokunun. İlk girişte e-postanıza bağlı bir danışan hesabı otomatik oluşturulur; telefonla giriş her zaman geçerlidir.",
      "Puede iniciar sesión con su cuenta de Google desde el portal del cliente: pulse «Iniciar sesión con Google» junto al acceso por teléfono. El primer inicio crea automáticamente una cuenta de cliente vinculada a su correo; el acceso por teléfono sigue siempre disponible.",
      "login",
      ["بوابة العملاء", "Portail client", "Client portal", "Danışan portalı", "Portal del cliente"]
    ),
  },
  {
    keys: ["خصوصية", "سرية", "بيانات", "privacy", "confidential", "confidentialité", "données", "donnees", "gizlilik", "veri", "privacidad", "datos", "confidencial"],
    reply: R(
      "السرية التامة مبدأ أساسي عندنا: كل ما يُقال في الجلسة يبقى ضمن إطار المركز، ولا تُشارك بياناتك مع أي طرف تجاري. تفاصيل كاملة في صفحة «الخصوصية» أسفل الموقع.",
      "La confidentialité totale est un principe fondamental : tout ce qui est dit en séance reste dans le cadre du centre, et vos données ne sont jamais partagées avec des tiers commerciaux. Détails complets dans la page « Confidentialité » en bas du site.",
      "Full confidentiality is a cornerstone for us: everything said in session stays within the center, and your data is never shared with commercial parties. Full details in the “Privacy” page at the bottom of the site.",
      "Tam gizlilik bizim için temel ilkedir: seansta söylenen her şey merkezin çerçevesinde kalır ve verileriniz asla ticari taraflarla paylaşılmaz. Ayrıntılar için site altındaki «Gizlilik» sayfasına bakın.",
      "La confidencialidad total es un principio fundamental para nosotros: todo lo dicho en sesión queda dentro del centro y sus datos nunca se comparten con terceros comerciales. Detalles completos en la página «Privacidad» al final del sitio.",
      "privacy",
      ["اقرأ سياسة الخصوصية", "Politique de confidentialité", "Privacy policy", "Gizlilik politikası", "Política de privacidad"]
    ),
  },
  {
    keys: ["طفل", "أطفال", "اطفال", "طفلي", "child", "kid", "enfant", "bébé", "bebe", "çocuk", "niño", "niña", "nino", "niño", "pediatric", "pédiatrie"],
    reply: R(
      "نستقبل الأطفال من سنّ 4 سنوات في جلسات الأرطفونية والجمهور النفسي المناسب، بحضور أحد الوالدين عند الحاجة. يحدد التقييم الأولي برنامج العمل الأنسب لكل طفل.",
      "Nous accueillons les enfants à partir de 4 ans en orthophonie et dans les suivis psychologiques adaptés, en présence d'un parent si nécessaire. Le bilan initial détermine le programme le plus adapté à chaque enfant.",
      "We welcome children from age 4 for speech therapy and suitable psychological follow-ups, with a parent present when needed. The initial assessment shapes the best program for each child.",
      "Dil-konuşma terapisi ve uygun psikolojik takiplerde 4 yaşından itibaren çocukları kabul ediyoruz; gerektiğinde ebeveyn hazır bulunur. İlk değerlendirme her çocuk için en uygun programı belirler.",
      "Recibimos niños a partir de los 4 años para logopedia y seguimientos psicológicos adecuados, con la presencia de un progenitor cuando es necesario. La evaluación inicial define el programa más adecuado para cada niño.",
      "appointments",
      ["حجز موعد لطفل", "Réserver pour un enfant", "Book for a child", "Çocuk için randevu", "Reservar para un niño"]
    ),
  },
  {
    keys: ["قلق", "توتر", "اكتئاب", "ضغط", "خوف", "انكسار", "dépression", "anxiété", "stress", "depression", "anxiety", "kaygı", "stres", "depresyon", "ansiedad", "estrés", "estres", "triste"],
    reply: R(
      "أفهم شعورك، وطلب المساعدة خطوة شجاعة. فريقنا من الأخصائيين جاهز للاستماع إليك ومساعدتك بخطة علاج مناسبة — احجز جلستك الأولى وسيكون هناك من يصغي إليك بهدوء وتقدير.",
      "Je comprends votre ressenti, et demander de l'aide est un acte courageux. Notre équipe de spécialistes est prête à vous écouter et à vous accompagner avec un plan de soins adapté — réservez votre première séance, quelqu'un vous écoutera avec calme et respect.",
      "I understand how you feel, and asking for help is a brave step. Our team of specialists is ready to listen and support you with a suitable care plan — book your first session and someone will listen to you calmly and respectfully.",
      "Duygularınızı anlıyorum; yardım istemek cesaret ister. Uzman ekibimiz size dinlemek ve uygun bir bakım planıyla eşlik etmek için hazır — ilk seansınızı ayarlayın, biri sizi sakin ve saygıyla dinleyecek.",
      "Entiendo lo que siente, y pedir ayuda es un paso valiente. Nuestro equipo de especialistas está listo para escucharle y acompañarle con un plan de atención adecuado — reserve su primera sesión y alguien le escuchará con calma y respeto.",
      "appointments",
      ["احجز جلستك الأولى", "Réserver ma première séance", "Book my first session", "İlk seansımı ayarla", "Reservar mi primera sesión"]
    ),
  },
  {
    keys: ["شهادة", "شهادات", "تجربة", "تجارب", "testimonial", "certificate", "témoignage", "temoignage", "certificat", "referans", "testimonio", "certificado", "opinión", "opinion"],
    reply: R(
      "قسم «شهادات وقصص نجاح» يعرض تجارب حقيقية لعملائنا بموافقتهم وبتصريح كامل، مع حماية الخصوصية (لا أسماء كاملة أبداً). ويمكنك أنت أيضاً مشاركة تجربتك من نفس الصفحة.",
      "La section « Témoignages et réussites » présente de vraies expériences de nos clients, publiées avec leur accord et protégées (jamais de noms complets). Vous pouvez aussi partager votre expérience depuis la même page.",
      "The “Testimonials & Success Stories” section shows real experiences from our clients, published with their consent and privacy protected (never full names). You can also share your own experience from the same page.",
      "«Referanslar ve Başarı Hikâyeleri» bölümü, müşterilerimizin onayıyla ve gizlilik korunarak (asla tam isim yok) gerçek deneyimlerini sunar. Deneyiminizi aynı sayfadan paylaşabilirsiniz.",
      "La sección «Testimonios e historias de éxito» muestra experiencias reales de nuestros clientes, publicadas con su consentimiento y protegiendo la privacidad (nunca nombres completos). También puede compartir su experiencia desde la misma página.",
      "testimonials",
      ["اقرأ الشهادات", "Voir les témoignages", "Read testimonials", "Referansları oku", "Leer testimonios"]
    ),
  },
  {
    keys: ["تقويم", "أضف", "google calendar", "calendar", "ical", "ics", "takvim", "calendario", "agenda", "ajouter au calendrier"],
    reply: R(
      "بعد تأكيد موعدك ستجد زر «إضافة للتقويم»: أضف الموعد إلى تقويم Google مباشرة أو حمّل ملف .ics لأي تطبيق تقويم، مع تنبيه قبل الموعد بساعة.",
      "Après la confirmation de votre rendez-vous, utilisez « Ajouter au calendrier » : ajoutez-le directement à Google Calendar ou téléchargez le fichier .ics pour n'importe quelle application, avec une alerte une heure avant.",
      "After your appointment is confirmed, use “Add to calendar”: add it directly to Google Calendar or download the .ics file for any calendar app, with an alert one hour before.",
      "Randevunuz onaylandıktan sonra «Takvime ekle» düğmesini kullanın: doğrudan Google Takvim'e ekleyin veya herhangi bir takvim uygulaması için .ics dosyasını indirin; bir saat önce uyarı gelir.",
      "Cuando su cita esté confirmada, use «Añadir al calendario»: añádala directamente a Google Calendar o descargue el archivo .ics para cualquier aplicación, con aviso una hora antes.",
      "appointments",
      ["إدارة مواعيدي", "Mes rendez-vous", "My appointments", "Randevularım", "Mis citas"]
    ),
  },
  {
    keys: ["واتساب", "whatsapp", "wa.me", "واتساب", "numéro", "رقم الهاتف", "telefon", "teléfono", "telefono", "contact", "اتصل", "call"],
    reply: R(
      "زر «راسلنا على واتساب» ثابت في أسفل الشاشة في كل الصفحات — اضغطه للتواصل المباشر مع فريقنا. يمكنك كذلك الاطلاع على الهاتف والبريد من صفحة التواصل أو التذييل.",
      "Le bouton « Écrivez-nous sur WhatsApp » est fixe en bas de l'écran sur toutes les pages — appuyez-le pour nous contacter directement. Le téléphone et l'e-mail figurent aussi sur la page Contact et le pied de page.",
      "The “Chat with us on WhatsApp” button is fixed at the bottom of the screen on every page — press it to reach our team directly. Phone and email are also on the Contact page and the footer.",
      "«WhatsApp'tan bize yazın» düğmesi her sayfanın altında sabittir — doğrudan iletişim için dokunun. Telefon ve e-posta, İletişim sayfasında ve alt Bilgisinde de yer alır.",
      "El botón «Escríbenos por WhatsApp» está fijo en la parte inferior de todas las páginas — púlselo para contactar directamente con nuestro equipo. El teléfono y el correo también están en la página de Contacto y en el pie.",
      "contact",
      ["صفحة التواصل", "Page contact", "Contact page", "İletişim sayfası", "Página de contacto"]
    ),
  },
  {
    keys: ["من انت", "من أنت", "روبوت", "بوت", "robot", "who are you", "qui es-tu", "tu es un", "kimsin", "bot musun", "quién eres", "quien eres", "eres un"],
    reply: R(
      "أنا المساعد الذكي لمركز آيت تقرين — أجيب عن أسئلتك حول الحجوزات والخدمات والتكوينات وأوجهك للصفحة المناسبة، وأعمل حتى دون إنترنت. للاستشارة المتخصصة احجز جلسة مع أحد أخصائيينا.",
      "Je suis l'assistant intelligent du Centre Ait Tegrine — je réponds à vos questions sur les réservations, services et formations et je vous guide vers la bonne page, même sans internet. Pour un avis spécialisé, réservez une séance avec l'un de nos spécialistes.",
      "I'm the smart assistant of Ait Tegrine Center — I answer questions about bookings, services and courses and guide you to the right page, even without internet. For professional advice, book a session with one of our specialists.",
      "Ben Ait Tegrine Merkezi'nin akıllı asistanıyım — rezervasyon, hizmetler ve eğitimler hakkındaki sorularınızı yanıtlar, doğru sayfaya yönlendiririm; internetsiz de çalışırım. Uzman görüşü için uzmanlarımızdan biriyle seans ayarlayın.",
      "Soy el asistente inteligente del Centro Ait Tegrine — respondo preguntas sobre reservas, servicios y cursos y le guío a la página adecuada, incluso sin internet. Para una consulta profesional, reserve una sesión con uno de nuestros especialistas.",
      "appointments",
      ["تحدث إلى أخصائي", "Parler à un spécialiste", "Talk to a specialist", "Bir uzmanla konuş", "Hablar con un especialista"]
    ),
  },
  {
    keys: ["مساعدة", "ساعدني", "help", "aide", "yardım", "ayuda", "كيف", "how", "comment", "nasıl", "cómo", "como"],
    reply: R(
      "أنا هنا لمساعدتك! يمكنني الإجابة عن: الحجز والمواعيد، الأسعار، كوبونات الخصم، التكوينات، الكتب الإلكترونية، المقالات، الفواتير، إشعارات التذكير، تثبيت التطبيق، وتغيير اللغة. اسألني أو اختر أحد الأسئلة السريعة أسفل الشات.",
      "Je suis là pour vous aider ! Je peux répondre sur : réservations et rendez-vous, tarifs, coupons, formations, livres électroniques, articles, factures, rappels, installation de l'application et changement de langue. Posez votre question ou choisissez une question rapide sous le chat.",
      "I'm here to help! I can answer about: bookings and appointments, prices, discount coupons, courses, e-books, articles, invoices, reminders, app installation and language change. Ask me or pick a quick question below the chat.",
      "Yardımcı olmak için buradayım! Şunları yanıtlayabilirim: randevu ve rezervasyon, fiyatlar, indirim kuponları, eğitimler, e-kitaplar, makaleler, faturalar, hatırlatmalar, uygulama kurulumu ve dil değiştirme. Soru sorun veya sohbetin altındaki hızlı sorulardan birini seçin.",
      "¡Estoy aquí para ayudarle! Puedo responder sobre: reservas y citas, precios, cupones de descuento, cursos, e-books, artículos, facturas, recordatorios, instalación de la app y cambio de idioma. Pregúnteme o elija una pregunta rápida debajo del chat.",
      "landing",
      ["ابدأ من الرئيسية", "Aller à l'accueil", "Go to home", "Ana sayfaya git", "Ir al inicio"]
    ),
  },
  {
    keys: ["مرحبا", "السلام", "سلام", "أهلا", "اهلا", "hello", "hi", "bonjour", "salut", "مرحبتين", "صباح", "مساء", "merhaba", "selam", "hola", "buenos", "buenas", "hey"],
    reply: R(
      "مرحباً بك في مركز آيت تقرين! أنا مساعدك الذكي — أجيب عن أسئلتك حول الحجوزات والخدمات والتكوينات، وأوجهك للصفحة المناسبة. كيف أساعدك؟",
      "Bienvenue au Centre Aït Tegrine ! Je suis votre assistant intelligent — je réponds à vos questions sur les réservations, services et formations. Comment puis-je aider ?",
      "Welcome to Ait Tegrine Center! I'm your smart assistant — I answer questions about bookings, services and trainings, and point you to the right page. How can I help?",
      "Ait Tegrine Merkezi'ne hoş geldiniz! Ben akıllı asistanınızım — rezervasyonlar, hizmetler ve eğitimler hakkındaki sorularınızı yanıtlar, doğru sayfaya yönlendiririm. Size nasıl yardımcı olabilirim?",
      "¡Bienvenido al Centro Ait Tegrine! Soy su asistente inteligente — respondo sus preguntas sobre reservas, servicios y cursos y le guío a la página adecuada. ¿En qué puedo ayudarle?",
    ),
  },
  {
    keys: ["شكرا", "شكراً", "thanks", "thank", "merci", "teşekkür", "sağol", "tesekkür", "gracias"],
    reply: R(
      "على الرحب والسعة! إن احتجت أي شيء آخر أنا هنا دائماً. نتمنى لك يوماً طيباً 🌿",
      "Avec plaisir ! Je reste disponible si besoin. Excellente journée 🌿",
      "You're welcome! I'm always here if you need anything else. Have a great day 🌿",
      "Rica ederim! İhtiyacınız olduğunda buradayım. İyi günler dileriz 🌿",
      "¡De nada! Estoy aquí siempre que lo necesite. ¡Que tenga un buen día! 🌿",
    ),
  },
];

/** تطبيع عميق: همزات + تشكيل + تاء مربوطة + ألف خناقية + مسافات */
function normalize(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىئي]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[àâäéèêëîïôöùûüç]/g, (c) => "aeeeeiiooouuc"["àâäéèêëîïôöùûüç".indexOf(c)] || c)
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ñ/g, "n")
    .replace(/á/g, "a").replace(/í/g, "i").replace(/ó/g, "o").replace(/ú/g, "u")
    .replace(/¿/g, "?").replace(/¡/g, "!")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** تقييم قاعدة: كم كلمة مفتاحية تطابق + مطابقة جزئية للكلمات الطويلة */
function scoreRule(normMsg: string, words: string[], keys: string[]): number {
  let score = 0;
  for (const k of keys) {
    const nk = normalize(k);
    if (!nk) continue;
    if (normMsg.includes(nk)) {
      score += nk.includes(" ") ? 3 : 2;
      continue;
    }
    /* مطابقة جزئية للكلمات المشتقة (حجز ↔ حجزك، كتاب ↔ كتبي) — بادئة 4 أحرف+ */
    if (nk.length >= 4) {
      for (const w of words) {
        if (w.length >= 4 && (w.startsWith(nk) || nk.startsWith(w))) {
          score += 1;
          break;
        }
      }
    }
  }
  return score;
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const b = await req.json().catch(() => null);
    const message = String(b?.message || "").slice(0, 500);
    const lang = String(b?.lang || "ar");
    const normMsg = normalize(message);
    if (!normMsg) return ok({ reply: null });
    const words = normMsg.split(" ").filter((w) => w.length > 1);

    /* 1) القواعد المدمجة — أعلى تقييم يفوز (وليس أول مطابقة) */
    let best: { reply: BotReply; score: number } | null = null;
    for (const rule of RULES) {
      const sc = scoreRule(normMsg, words, rule.keys);
      if (sc > 0 && (!best || sc > best.score)) best = { reply: rule.reply, score: sc };
    }
    if (best && best.score >= 2) {
      return ok({ reply: best.reply });
    }

    /* 2) الأسئلة الشائعة المُدارة — بكل اللغات مع تسجيل أفضل تطابق */
    try {
      const faqDoc = await PageContent.findOne({ key: "faq" }).lean<
        { items?: Record<string, unknown>[]; itemsFr?: Record<string, unknown>[]; itemsEn?: Record<string, unknown>[]; itemsTr?: Record<string, unknown>[]; itemsEs?: Record<string, unknown>[] } | null
      >();
      const corpus: { q: string; a: string; lang: string }[] = [];
      const pushItems = (arr?: Record<string, unknown>[], lang = "ar") =>
        (arr || []).forEach((it) => {
          const q = normalize(String(it?.q || ""));
          const a = String(it?.a || "");
          if (q && a) corpus.push({ q, a, lang });
        });
      if (faqDoc) {
        pushItems(faqDoc.items, "ar");
        pushItems(faqDoc.itemsFr, "fr");
        pushItems(faqDoc.itemsEn, "en");
        pushItems(faqDoc.itemsTr, "tr");
        pushItems(faqDoc.itemsEs, "es");
      }
      let faqBest: { q: string; a: string; lang: string; score: number } | null = null;
      for (const it of corpus) {
        const sc = scoreRule(normMsg, words, [it.q]);
        if (sc > 0 && (!faqBest || sc > faqBest.score)) faqBest = { ...it, score: sc };
      }
      if (faqBest && faqBest.score >= 2) {
        const labels: Record<string, string> = { ar: "كل الأسئلة الشائعة", fr: "Toutes les questions", en: "All FAQs", tr: "Tüm sorular", es: "Todas las preguntas" };
        return ok({
          reply: {
            text: faqBest.a,
            textFr: faqBest.a,
            textEn: faqBest.a,
            textTr: faqBest.a,
            textEs: faqBest.a,
            link: "faq",
            linkLabel: labels[faqBest.lang] || labels.ar,
            linkLabelFr: labels.fr,
            linkLabelEn: labels.en,
            linkLabelTr: labels.tr,
            linkLabelEs: labels.es,
          },
        });
      }
    } catch {}

    /* 3) مطابقة ضعيفة → أفضل قاعدة على أي حال إن وُجدت */
    if (best) return ok({ reply: best.reply });

    /* 4) لا مطابقة → توجيه ودود مع اقتراحات */
    return ok({
      reply: R(
        "لم أفهم سؤالك تماماً وأعتذر عن ذلك. يمكنني مساعدتك في: الحجز والمواعيد، الأسعار، كوبونات الخصم، التكوينات، الكتب الإلكترونية، الفواتير والإشعارات. جرّب صياغة أخرى، أو تواصل مع فريقنا مباشرة واتساب.",
        "Je n'ai pas bien saisi votre question et je m'en excuse. Je peux aider pour : réservations, tarifs, coupons, formations, livres électroniques, factures et rappels. Reformulez, ou contactez notre équipe directement sur WhatsApp.",
        "I didn't quite understand your question and I apologize. I can help with: bookings, prices, coupons, courses, e-books, invoices and reminders. Try rephrasing, or reach our team directly on WhatsApp.",
        "Sorunuzu tam anlayamadım, özür dilerim. Şunlarda yardımcı olabilirim: randevular, fiyatlar, kuponlar, eğitimler, e-kitaplar, faturalar ve hatırlatmalar. Farklı ifade edin veya ekibimize WhatsApp'tan doğrudan ulaşın.",
        "No entendí bien su pregunta y lo siento. Puedo ayudar con: citas, precios, cupones, cursos, e-books, facturas y recordatorios. Intente formularlo de otra forma o contacte a nuestro equipo por WhatsApp.",
        "contact",
        ["تواصل معنا", "Nous contacter", "Contact us", "Bize ulaşın", "Contáctenos"]
      ),
    });
  });
}

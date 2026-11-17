/**
 * بنك الكلمات العلاجية لمحلل النطق (★ v3.24 / ★ v3.24.1)
 * كلمات عربية مبسطة مناسبة للأطفال — مصنفة حسب الحرف/المخرج المدروس
 * كل مجموعة تُنطق مع تمكين الحرف في مواضع مختلفة من الكلمة (أول/وسط/آخر)
 *
 * ★ v3.24.1: كل حرف وكلمة يقابله ما يعادله بالترجمة في كل لغات الموقع (fr/en/tr/es)
 * — يظهر للأخصائي حسب لغة واجهته، والكلمة العربية تبقى دائماً مرجع النطق العلاجي
 * ومصدر المقارنة في التحليل (محرك ASR عربي) مهما كانت لغة تحدث المريض.
 */
export type SpeechLang = "ar" | "fr" | "en" | "tr" | "es";
export type LatinLang = Exclude<SpeechLang, "ar">;
export type Penta = { ar: string; fr: string; en: string; tr: string; es: string };

export type WordBankEntry = {
  letter: string; /* الحرف العربي — المخرج العلاجي المرجعي ومفتاح المجموعة */
  letterLabel: Record<LatinLang, string>; /* عرض الحرف حسب لغة الواجهة */
  words: Penta[]; /* الكلمات بكل اللغات — ar هو النطق المستهدف للتحليل */
};

export const WORD_BANK: WordBankEntry[] = [
  {
    letter: "ب", letterLabel: { fr: "B", en: "B", tr: "B", es: "B" },
    words: [
      { ar: "باب", fr: "Porte", en: "Door", tr: "Kapı", es: "Puerta" },
      { ar: "بطة", fr: "Canard", en: "Duck", tr: "Ördek", es: "Pato" },
      { ar: "بطيخ", fr: "Pastèque", en: "Watermelon", tr: "Karpuz", es: "Sandía" },
      { ar: "بنان", fr: "Banane", en: "Banana", tr: "Muz", es: "Plátano" },
    ],
  },
  {
    letter: "ت", letterLabel: { fr: "T", en: "T", tr: "T", es: "T" },
    words: [
      { ar: "تفاحة", fr: "Pomme", en: "Apple", tr: "Elma", es: "Manzana" },
      { ar: "تمر", fr: "Dattes", en: "Dates", tr: "Hurma", es: "Dátiles" },
      { ar: "تمساح", fr: "Crocodile", en: "Crocodile", tr: "Timsah", es: "Cocodrilo" },
      { ar: "ترس", fr: "Engrenage", en: "Gear", tr: "Dişli", es: "Engranaje" },
    ],
  },
  {
    letter: "د", letterLabel: { fr: "D", en: "D", tr: "D", es: "D" },
    words: [
      { ar: "دجاجة", fr: "Poule", en: "Hen", tr: "Tavuk", es: "Gallina" },
      { ar: "دب", fr: "Ours", en: "Bear", tr: "Ayı", es: "Oso" },
      { ar: "دلفين", fr: "Dauphin", en: "Dolphin", tr: "Yunus", es: "Delfín" },
      { ar: "درج", fr: "Tiroir", en: "Drawer", tr: "Çekmece", es: "Cajón" },
    ],
  },
  {
    letter: "ر", letterLabel: { fr: "R", en: "R", tr: "R", es: "R" },
    words: [
      { ar: "رمان", fr: "Grenade", en: "Pomegranate", tr: "Nar", es: "Granada" },
      { ar: "ريشة", fr: "Plume", en: "Feather", tr: "Tüy", es: "Pluma" },
      { ar: "روضة", fr: "Jardin d'enfants", en: "Kindergarten", tr: "Anaokulu", es: "Jardín infantil" },
      { ar: "رمح", fr: "Lance", en: "Spear", tr: "Mızrak", es: "Lanza" },
    ],
  },
  {
    letter: "س", letterLabel: { fr: "S", en: "S", tr: "S", es: "S" },
    words: [
      { ar: "سمكة", fr: "Poisson", en: "Fish", tr: "Balık", es: "Pez" },
      { ar: "ساعة", fr: "Montre", en: "Watch", tr: "Saat", es: "Reloj" },
      { ar: "سلة", fr: "Panier", en: "Basket", tr: "Sepet", es: "Cesta" },
      { ar: "سلحفاة", fr: "Tortue", en: "Turtle", tr: "Kaplumbağa", es: "Tortuga" },
    ],
  },
  {
    letter: "ش", letterLabel: { fr: "CH", en: "SH", tr: "Ş", es: "CH" },
    words: [
      { ar: "شمس", fr: "Soleil", en: "Sun", tr: "Güneş", es: "Sol" },
      { ar: "شجرة", fr: "Arbre", en: "Tree", tr: "Ağaç", es: "Árbol" },
      { ar: "شباك", fr: "Fenêtre", en: "Window", tr: "Pencere", es: "Ventana" },
      { ar: "شعلة", fr: "Flamme", en: "Flame", tr: "Alev", es: "Llama" },
    ],
  },
  {
    letter: "ك", letterLabel: { fr: "K", en: "K", tr: "K", es: "K" },
    words: [
      { ar: "كتاب", fr: "Livre", en: "Book", tr: "Kitap", es: "Libro" },
      { ar: "كرة", fr: "Ballon", en: "Ball", tr: "Top", es: "Pelota" },
      { ar: "كوب", fr: "Verre", en: "Glass", tr: "Bardak", es: "Vaso" },
      { ar: "كنغر", fr: "Kangourou", en: "Kangaroo", tr: "Kanguru", es: "Canguro" },
    ],
  },
  {
    letter: "ل", letterLabel: { fr: "L", en: "L", tr: "L", es: "L" },
    words: [
      { ar: "ليمون", fr: "Citron", en: "Lemon", tr: "Limon", es: "Limón" },
      { ar: "لعبة", fr: "Jouet", en: "Toy", tr: "Oyuncak", es: "Juguete" },
      { ar: "لسان", fr: "Langue", en: "Tongue", tr: "Dil", es: "Lengua" },
      { ar: "لبنة", fr: "Brique", en: "Brick", tr: "Tuğla", es: "Ladrillo" },
    ],
  },
  {
    letter: "م", letterLabel: { fr: "M", en: "M", tr: "M", es: "M" },
    words: [
      { ar: "مفتاح", fr: "Clé", en: "Key", tr: "Anahtar", es: "Llave" },
      { ar: "موز", fr: "Banane", en: "Banana", tr: "Muz", es: "Plátano" },
      { ar: "مظلة", fr: "Parapluie", en: "Umbrella", tr: "Şemsiye", es: "Paraguas" },
      { ar: "ماسة", fr: "Diamant", en: "Diamond", tr: "Elmas", es: "Diamante" },
    ],
  },
  {
    letter: "ن", letterLabel: { fr: "N", en: "N", tr: "N", es: "N" },
    words: [
      { ar: "نار", fr: "Feu", en: "Fire", tr: "Ateş", es: "Fuego" },
      { ar: "نجمة", fr: "Étoile", en: "Star", tr: "Yıldız", es: "Estrella" },
      { ar: "نحلة", fr: "Abeille", en: "Bee", tr: "Arı", es: "Abeja" },
      { ar: "نمر", fr: "Tigre", en: "Tiger", tr: "Kaplan", es: "Tigre" },
    ],
  },
  {
    letter: "ف", letterLabel: { fr: "F", en: "F", tr: "F", es: "F" },
    words: [
      { ar: "فيل", fr: "Éléphant", en: "Elephant", tr: "Fil", es: "Elefante" },
      { ar: "فول", fr: "Fèves", en: "Fava beans", tr: "Bakla", es: "Habas" },
      { ar: "فراولة", fr: "Fraise", en: "Strawberry", tr: "Çilek", es: "Fresa" },
      { ar: "فيلم", fr: "Film", en: "Movie", tr: "Film", es: "Película" },
    ],
  },
  {
    letter: "ق", letterLabel: { fr: "Q", en: "Q", tr: "K", es: "Q" },
    words: [
      { ar: "قمر", fr: "Lune", en: "Moon", tr: "Ay", es: "Luna" },
      { ar: "قلم", fr: "Stylo", en: "Pen", tr: "Kalem", es: "Bolígrafo" },
      { ar: "قطة", fr: "Chat", en: "Cat", tr: "Kedi", es: "Gato" },
      { ar: "قوقعة", fr: "Coquillage", en: "Seashell", tr: "Deniz kabuğu", es: "Concha" },
    ],
  },
  {
    letter: "ج", letterLabel: { fr: "J", en: "J", tr: "C", es: "J" },
    words: [
      { ar: "جمل", fr: "Chameau", en: "Camel", tr: "Deve", es: "Camello" },
      { ar: "جبن", fr: "Fromage", en: "Cheese", tr: "Peynir", es: "Queso" },
      { ar: "جرة", fr: "Cruche", en: "Jug", tr: "Testi", es: "Jarra" },
      { ar: "جزر", fr: "Carotte", en: "Carrot", tr: "Havuç", es: "Zanahoria" },
    ],
  },
  {
    letter: "خ", letterLabel: { fr: "KH", en: "KH", tr: "H", es: "J" },
    words: [
      { ar: "خيط", fr: "Fil", en: "Thread", tr: "İp", es: "Hilo" },
      { ar: "خبز", fr: "Pain", en: "Bread", tr: "Ekmek", es: "Pan" },
      { ar: "خنزير", fr: "Cochon", en: "Pig", tr: "Domuz", es: "Cerdo" },
      { ar: "خيمة", fr: "Tente", en: "Tent", tr: "Çadır", es: "Campaña" },
    ],
  },
  {
    letter: "ع", letterLabel: { fr: "'A", en: "'A", tr: "'A", es: "'A" },
    words: [
      { ar: "عين", fr: "Œil", en: "Eye", tr: "Göz", es: "Ojo" },
      { ar: "عصير", fr: "Jus", en: "Juice", tr: "Meyve suyu", es: "Zumo" },
      { ar: "عصفور", fr: "Oiseau", en: "Bird", tr: "Kuş", es: "Pájaro" },
      { ar: "عربة", fr: "Chariot", en: "Cart", tr: "Araba", es: "Carro" },
    ],
  },
  {
    letter: "غ", letterLabel: { fr: "GH", en: "GH", tr: "Ğ", es: "GH" },
    words: [
      { ar: "غيم", fr: "Nuage", en: "Cloud", tr: "Bulut", es: "Nube" },
      { ar: "غزال", fr: "Gazelle", en: "Gazelle", tr: "Ceylan", es: "Gacela" },
      { ar: "غرفة", fr: "Chambre", en: "Room", tr: "Oda", es: "Habitación" },
      { ar: "غول", fr: "Ogre", en: "Ogre", tr: "Dev", es: "Ogro" },
    ],
  },
];

/** الكلمة المعروضة حسب لغة الواجهة — العربية للأصل والعلاج، وترجمتها لبقية اللغات */
export function wordLabel(w: Penta, lang: SpeechLang): string {
  return (lang === "ar" ? w.ar : w[lang]) || w.ar;
}

/** تطبيع عربي للمقارنة: بلا تشكيل، همزات موحدة، تاء مربوطة/ها متكافئة، بلا مسافات */
export function normalizeArabic(s: string): string {
  return String(s || "")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "") /* التشكيل وعلامات القرآن */
    .replace(/[\u0622\u0623\u0625\u0627]/g, "\u0627") /* آأإ → ا */
    .replace(/\u0649/g, "\u064A") /* ى → ي */
    .replace(/\u0629/g, "\u0647") /* ة → ه */
    .replace(/\u0624/g, "\u0648") /* ؤ → و */
    .replace(/\u0626/g, "\u064A") /* ئ → ي */
    .replace(/\s+/g, "")
    .trim();
}

/* تسميات عربية للنتائج — تُستعمل في الاستجابة الخادمية (تعليقات التوجيه) */
export function disorderLabelAr(code: string): string {
  switch (code) {
    case "stutter": return "تأتأة";
    case "lisp": return "لثغة";
    case "deletion": return "حذف أصوات";
    case "substitution": return "إبدال أصوات";
    case "distortion": return "تشويه مخارج";
    default: return "لا مؤشرات واضحة";
  }
}
export function severityLabelAr(code: string): string {
  switch (code) {
    case "high": return "مرتفعة";
    case "mid": return "متوسطة";
    default: return "خفيفة";
  }
}

/**
 * نموذج التنقل بين الصفحات (تطبيق صفحة واحد)
 * ★ الترتيب حسب أهمية الصفحة لكل نوع مستخدم (نمط طمأنينة):
 *   صفحات الدور المهمة أولاً ثم الصفحات العامة
 * login: يُستعمل مع id = client | specialist | admin (بوابات دخول مستقلة)
 */
export type ViewKey =
  | "home"
  | "login"
  | "appointments"
  | "specialists"
  | "services"
  | "courses"
  | "ebooks"
  | "ebook"
  | "articles"
  | "ads"
  | "accounts"
  | "patients"
  | "settings"
  | "dashboard"
  | "documents"
  | "orders"
  | "record"
  | "feedback"
  | "contact"
  | "faq"
  | "about"
  | "privacy"
  | "terms"
  | "testimonials"
  | "profile";

export type NavState = { view: ViewKey; id?: string };
export type Navigate = (view: ViewKey, id?: string) => void;

export type Role = "admin" | "assistant" | "specialist" | "trainer" | "client" | "guest";

export type NavItem = {
  key: ViewKey;
  label: string;
  icon: string; // اسم أيقونة lucide — يُحوَّل في sidebar-nav
  roles: Role[];
  divider?: boolean;
  /** بوابات الدخول: يُمرَّر id عند التنقل (client/specialist/admin) */
  loginAs?: "client" | "specialist" | "admin";
};

/** الصفحات المهمة لكل دور — تظهر أولاً في القائمة (نمط طمأنينة)
 * ★ v3.11: المكوّن — مقالاته وتكويناته وملفه المهني (بلا مواعيد ولا استقبال) */
export const ROLE_IMPORTANT: Record<Exclude<Role, "guest">, ViewKey[]> = {
  admin: ["dashboard", "appointments", "accounts", "settings"],
  assistant: ["dashboard", "appointments", "patients"],
  specialist: ["appointments", "patients", "profile"],
  trainer: ["articles", "courses", "profile"],
  client: ["appointments", "specialists"],
};

export const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "nav.home", icon: "Home", roles: ["guest", "admin", "assistant", "specialist", "trainer", "client"] },
  /* المواعيد: للإدارة والأخصائي والعميل — المكوّن لا يستقبل مواعيد أصلاً (★ v3.11) */
  { key: "appointments", label: "nav.appointments", icon: "CalendarClock", roles: ["admin", "assistant", "specialist", "client"] },
  { key: "dashboard", label: "nav.dashboard", icon: "LayoutDashboard", roles: ["admin", "assistant"] },
  /* المرضى: الأخصائي يرى مرضاه — والمكوّن يرى المعيَّنين له إن عيَّنته الإدارة (★ v3.11) */
  { key: "patients", label: "nav.patients", icon: "ClipboardPlus", roles: ["admin", "assistant", "specialist", "trainer"] },
  { key: "accounts", label: "nav.accounts", icon: "UsersRound", roles: ["admin", "assistant"] },
  { key: "settings", label: "nav.settings", icon: "Settings", roles: ["admin", "assistant"] },
  /* إدارة الوثائق: صفحة خاصة بالقائمة الجانبية تظهر لحساب الإدارة فقط — طلب المستخدم */
  { key: "documents", label: "nav.documents", icon: "FileBadge2", roles: ["admin"], divider: true },
  /* v3.20: طلبات شراء الكتب الإلكترونية — إدارة ومساعد */
  { key: "orders", label: "nav.orders", icon: "ShoppingBag", roles: ["admin", "assistant"] },
  { key: "specialists", label: "nav.specialists", icon: "Stethoscope", roles: ["guest", "admin", "assistant", "specialist", "trainer", "client"] },
  { key: "services", label: "nav.services", icon: "Sparkles", roles: ["guest", "admin", "assistant", "specialist", "trainer", "client"] },
  { key: "courses", label: "nav.courses", icon: "GraduationCap", roles: ["guest", "admin", "assistant", "specialist", "trainer", "client"] },
  { key: "ebooks", label: "nav.ebooks", icon: "BookOpenText", roles: ["guest", "admin", "assistant", "specialist", "trainer", "client"] },
  /* v3.6.0: المقالات العلمية — القراءة للجميع والنشر للأخصائيين والمكوّنين والإدارة (★ v3.11) */
  { key: "articles", label: "nav.articles", icon: "Newspaper", roles: ["guest", "admin", "assistant", "specialist", "trainer", "client"] },
  /* v3.8.0: شهادات وقصص النجاح — عامة، والتحرير للإدارة */
  { key: "testimonials", label: "nav.testimonials", icon: "Quote", roles: ["guest", "admin", "assistant", "specialist", "trainer", "client"] },
  { key: "ads", label: "nav.ads", icon: "Megaphone", roles: ["guest", "admin", "assistant", "specialist", "trainer", "client"], divider: true },
  { key: "contact", label: "nav.contact", icon: "Mail", roles: ["guest", "admin", "assistant", "specialist", "trainer", "client"] },
  { key: "feedback", label: "nav.feedback", icon: "MessageSquareHeart", roles: ["guest", "admin", "assistant", "specialist", "trainer", "client"] },
  { key: "faq", label: "nav.faq", icon: "CircleHelp", roles: ["guest", "admin", "assistant", "specialist", "trainer", "client"], divider: true },
  { key: "about", label: "nav.about", icon: "Info", roles: ["guest", "admin", "assistant", "specialist", "trainer", "client"] },
  { key: "privacy", label: "nav.privacy", icon: "ShieldCheck", roles: ["guest", "admin", "assistant", "specialist", "trainer", "client"] },
  { key: "terms", label: "nav.terms", icon: "FileText", roles: ["guest", "admin", "assistant", "specialist", "trainer", "client"] },
];

/** بوابات الدخول الثلاث للزوار (نمط طمأنينة — بلا زر دخول في الهيدر) */
export const LOGIN_ENTRIES: { as: "client" | "specialist" | "admin"; label: string; icon: string }[] = [
  { as: "client", label: "nav.loginClient", icon: "UserRound" },
  { as: "specialist", label: "nav.loginSpecialist", icon: "Stethoscope" },
  { as: "admin", label: "nav.loginAdmin", icon: "ShieldCheck" },
];

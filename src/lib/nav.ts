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
  | "ads"
  | "accounts"
  | "patients"
  | "settings"
  | "dashboard"
  | "documents"
  | "record"
  | "feedback"
  | "contact"
  | "faq"
  | "about"
  | "privacy"
  | "terms"
  | "profile";

export type NavState = { view: ViewKey; id?: string };
export type Navigate = (view: ViewKey, id?: string) => void;

export type Role = "admin" | "assistant" | "specialist" | "client" | "guest";

export type NavItem = {
  key: ViewKey;
  label: string;
  icon: string; // اسم أيقونة lucide — يُحوَّل في sidebar-nav
  roles: Role[];
  divider?: boolean;
  /** بوابات الدخول: يُمرَّر id عند التنقل (client/specialist/admin) */
  loginAs?: "client" | "specialist" | "admin";
};

/** الصفحات المهمة لكل دور — تظهر أولاً في القائمة (نمط طمأنينة) */
export const ROLE_IMPORTANT: Record<Exclude<Role, "guest">, ViewKey[]> = {
  admin: ["dashboard", "appointments", "accounts", "settings"],
  assistant: ["dashboard", "appointments", "patients"],
  specialist: ["appointments", "patients", "profile"],
  client: ["appointments", "specialists"],
};

export const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "nav.home", icon: "Home", roles: ["guest", "admin", "assistant", "specialist", "client"] },
  { key: "appointments", label: "nav.appointments", icon: "CalendarClock", roles: ["admin", "assistant", "specialist", "client"] },
  { key: "dashboard", label: "nav.dashboard", icon: "LayoutDashboard", roles: ["admin", "assistant"] },
  { key: "patients", label: "nav.patients", icon: "ClipboardPlus", roles: ["admin", "assistant", "specialist"] },
  { key: "accounts", label: "nav.accounts", icon: "UsersRound", roles: ["admin", "assistant"] },
  { key: "settings", label: "nav.settings", icon: "Settings", roles: ["admin", "assistant"] },
  /* إدارة الوثائق: صفحة خاصة بالقائمة الجانبية تظهر لحساب الإدارة فقط — طلب المستخدم */
  { key: "documents", label: "nav.documents", icon: "FileBadge2", roles: ["admin"], divider: true },
  { key: "specialists", label: "nav.specialists", icon: "Stethoscope", roles: ["guest", "admin", "assistant", "specialist", "client"] },
  { key: "services", label: "nav.services", icon: "Sparkles", roles: ["guest", "admin", "assistant", "specialist", "client"] },
  { key: "courses", label: "nav.courses", icon: "GraduationCap", roles: ["guest", "admin", "assistant", "specialist", "client"] },
  { key: "ebooks", label: "nav.ebooks", icon: "BookOpenText", roles: ["guest", "admin", "assistant", "specialist", "client"] },
  { key: "ads", label: "nav.ads", icon: "Megaphone", roles: ["guest", "admin", "assistant", "specialist", "client"], divider: true },
  { key: "contact", label: "nav.contact", icon: "Mail", roles: ["guest", "admin", "assistant", "specialist", "client"] },
  { key: "feedback", label: "nav.feedback", icon: "MessageSquareHeart", roles: ["guest", "admin", "assistant", "specialist", "client"] },
  { key: "faq", label: "nav.faq", icon: "CircleHelp", roles: ["guest", "admin", "assistant", "specialist", "client"], divider: true },
  { key: "about", label: "nav.about", icon: "Info", roles: ["guest", "admin", "assistant", "specialist", "client"] },
  { key: "privacy", label: "nav.privacy", icon: "ShieldCheck", roles: ["guest", "admin", "assistant", "specialist", "client"] },
  { key: "terms", label: "nav.terms", icon: "FileText", roles: ["guest", "admin", "assistant", "specialist", "client"] },
];

/** بوابات الدخول الثلاث للزوار (نمط طمأنينة — بلا زر دخول في الهيدر) */
export const LOGIN_ENTRIES: { as: "client" | "specialist" | "admin"; label: string; icon: string }[] = [
  { as: "client", label: "nav.loginClient", icon: "UserRound" },
  { as: "specialist", label: "nav.loginSpecialist", icon: "Stethoscope" },
  { as: "admin", label: "nav.loginAdmin", icon: "ShieldCheck" },
];

"use client";
/**
 * مركز أيت تقرين — سياق التطبيق العام (v3)
 * اللغة (ar/fr/en) + حجم النص + المستخدم + إعدادات المركز + الإخفاء السريع
 * ★ الجديد v3: التنقل الداخلي (view/navigate) مصدر وحيد للحقيقة —
 *   الهيدر والقائمة الجانبية والفوتر والشعار كلها تتنقل عبر useApp().navigate
 *   (يقتل جذرياً أخطاء "النقر على القائمة الجانبية لا يفعل شيئاً" و"الشعار لا يوجه للرئيسية")
 * الجلسة: توكن في localStorage (نمط طمأنينة) + مزامنة عند الإقلاع عبر /api/auth/me
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ar, fr, en } from "./dicts";
import type { ViewKey, Navigate } from "./nav";
import { isHidden as qhIsHidden, setHidden as qhSetHidden } from "./quick-hide";
import {
  clearSession,
  getStoredUser,
  getToken,
  installAuthFetch,
  setStoredUser,
  setToken,
} from "./client-api";

export type Lang = "ar" | "fr" | "en";
export type Me = {
  _id: string;
  name: string;
  phone: string;
  role: "admin" | "assistant" | "specialist" | "client";
  specialty?: "psychological" | "art_therapy" | "both";
  langs?: string[];
  title?: string;
  titleFr?: string;
  titleEn?: string;
  bio?: string;
  bioFr?: string;
  bioEn?: string;
  yearsExperience?: number;
  specialties?: string[];
  photoBase64?: string;
  weeklyHours?: Record<string, string[]>;
  assignedSpecialistId?: string | null;
  active?: boolean;
} | null;

export type TriCat = { ar: string; fr: string; en: string };
export type DayHours = { start: string; end: string; closed: boolean };

export type CenterSettings = {
  centerName: string;
  centerNameFr: string;
  centerNameEn: string;
  tagline: string;
  taglineFr: string;
  taglineEn: string;
  aboutShort: string;
  aboutShortFr: string;
  aboutShortEn: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  addressFr: string;
  addressEn: string;
  lat: number;
  lng: number;
  /** رابط الموقع على خرائط Google — يوجه الزوار للمركز مباشرة من الفوتر وصفحة التواصل */
  mapsUrl: string;
  logoBase64: string;
  langFr: boolean;
  langEn: boolean;
  options: {
    specialties: string[];
    /** v3.5: التصنيفات ثلاثية اللغة — { ar, fr, en } */
    serviceCategories: TriCat[];
    courseCategories: TriCat[];
    slotMinutes: number;
    dayStart: string;
    dayEnd: string;
    /** v3.5: أوقات كل يوم من الأسبوع — "0" = الأحد … "6" = السبت */
    dayHours: Record<string, DayHours>;
  };
  social: {
    facebook: string;
    instagram: string;
    tiktok: string;
    youtube: string;
    telegram: string;
  };
  sliderMedia: { type: "image" | "video"; url?: string; data?: string; title: string }[];
};

const dicts: Record<Lang, Record<string, string>> = { ar, fr, en };
/** الوصول للقواميس من الخارج (enable-push ومكوّنات خارج مزوّد السياق) */
export { dicts };

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** ترجمة مع دعم القيم المُدرجة: t("doc.presenceBody", { date }) */
  t: (k: string, params?: Record<string, string | number>) => string;
  dir: "rtl" | "ltr";
  fontScale: number;
  fontUp: () => void;
  fontDown: () => void;
  me: Me;
  setMe: (m: Me) => void;
  /** تسجيل جلسة كاملة (نمط طمأنينة): يحفظ المستخدم والتوكن معاً */
  setSession: (m: Me, token: string) => void;
  /** خروج كامل: يمسح التوكن والمستخدم محلياً */
  logout: () => void;
  settings: CenterSettings | null;
  refreshSettings: () => Promise<void>;
  hidden: boolean;
  setHidden: (v: boolean) => void;
  ready: boolean;
  /** الصفحة الحالية (تطبيق صفحة واحدة) */
  view: ViewKey;
  viewId?: string;
  /** التنقل الداخلي — يعمل من أي مكوّن دون تمرير خصائص */
  navigate: Navigate;
};

const AppCtx = createContext<Ctx | null>(null);

const DEFAULT_SETTINGS: CenterSettings = {
  centerName: "مركز أيت تقرين",
  centerNameFr: "",
  centerNameEn: "",
  tagline: "",
  taglineFr: "",
  taglineEn: "",
  aboutShort: "",
  aboutShortFr: "",
  aboutShortEn: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  addressFr: "",
  addressEn: "",
  lat: 36.7538,
  lng: 3.0588,
  mapsUrl: "",
  logoBase64: "",
  langFr: true,
  langEn: true,
  options: {
    specialties: [],
    serviceCategories: [],
    courseCategories: [],
    slotMinutes: 60,
    dayStart: "09:00",
    dayEnd: "17:00",
    dayHours: {},
  },
  social: { facebook: "", instagram: "", tiktok: "", youtube: "", telegram: "" },
  sliderMedia: [],
};

/** قراءة الصفحة من عنوان الرابط (?view=...) — للروابط المباشرة وزر الرجوع */
function viewFromUrl(): { view: ViewKey; id?: string } {
  try {
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get("view") as ViewKey | null;
    const id = sp.get("id") || undefined;
    if (v) return { view: v, id };
  } catch {}
  return { view: "home" };
}

/** آخر صفحة زارها المستخدم في جلسة التبويب الحالية —
 *  عند تحميل الصفحة يبقى المستخدم في نفس الصفحة/النافذة لا يعاد للرئيسية */
function lastView(): { view: ViewKey; id?: string } | null {
  try {
    const raw = sessionStorage.getItem("ait_last_view");
    if (!raw) return null;
    const p = JSON.parse(raw) as { view: ViewKey; id?: string };
    if (p && p.view && typeof p.view === "string") return { view: p.view, id: p.id };
  } catch {}
  return null;
}

/** كتابة الصفحة في العنوان دون إعادة تحميل */
function pushUrl(view: ViewKey, id?: string, replace = false) {
  try {
    const url = view === "home" && !id ? "/" : `/?view=${view}${id ? `&id=${id}` : ""}`;
    if (replace) window.history.replaceState({ view, id }, "", url);
    else window.history.pushState({ view, id }, "", url);
  } catch {}
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  const [fontScale, setFontScale] = useState(1);
  const [me, setMeState] = useState<Me>(null);
  const [settings, setSettings] = useState<CenterSettings | null>(null);
  const [hidden, setHiddenState] = useState(false);
  const [ready, setReady] = useState(false);
  const [{ view, id: viewId }, setNav] = useState<{ view: ViewKey; id?: string }>({ view: "home" });

  /* تركيب غلاف fetch الموحّد + استرجاع الجلسة واللغة من التخزين المحلي */
  useEffect(() => {
    installAuthFetch();
    try {
      const l = localStorage.getItem("ait_lang") as Lang | null;
      if (l && ["ar", "fr", "en"].includes(l)) setLangState(l);
      const f = parseFloat(localStorage.getItem("ait_font") || "1");
      if (f >= 0.8 && f <= 1.4) setFontScale(f);
    } catch {}
    const saved = getStoredUser<Me>();
    if (saved && getToken()) setMeState(saved);
    /* روابط مباشرة: ?view=login إلخ — وإلا نعيد المستخدم لآخر صفحة زارها */
    const initial = viewFromUrl();
    if (initial.view !== "home") {
      setNav(initial);
      try { sessionStorage.setItem("ait_last_view", JSON.stringify(initial)); } catch {}
    } else {
      const lv = lastView();
      if (lv && lv.view !== "home") {
        setNav(lv);
        pushUrl(lv.view, lv.id, true);
      }
    }
    /* الإخفاء السريع يبقى مفروضاً عند تحديث الصفحة (جلسة التبويب الحالية) */
    setHiddenState(qhIsHidden());
  }, []);

  /* تطبيق الاتجاه وحجم الخط */
  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.style.fontSize = `${16 * fontScale}px`;
  }, [lang, fontScale]);

  /* زر رجوع المتصفح يعمل مع التنقل الداخلي */
  useEffect(() => {
    const onPop = () => setNav(viewFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /* جلب الإعدادات */
  const refreshSettings = useCallback(async () => {
    try {
      const r = await fetch("/api/settings", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        const s = { ...DEFAULT_SETTINGS, ...j.settings } as CenterSettings;
        /* حماية إضافية: تطبيع التصنيفات وأوقات الأسبوع مهما كان شكلها */
        s.options = { ...DEFAULT_SETTINGS.options, ...(s.options || {}) };
        s.options.serviceCategories = (s.options.serviceCategories || []).map((c: unknown) =>
          typeof c === "string" ? { ar: c, fr: "", en: "" } : (c as TriCat)
        );
        s.options.courseCategories = (s.options.courseCategories || []).map((c: unknown) =>
          typeof c === "string" ? { ar: c, fr: "", en: "" } : (c as TriCat)
        );
        s.options.dayHours = s.options.dayHours || {};
        setSettings(s);
      }
    } catch {}
  }, []);

  /* مزامنة الجلسة مع الخادم عند الإقلاع: توكن صالح → بيانات حية؛ مرفوض → مسح نظيف */
  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          const r = await fetch("/api/auth/me", { cache: "no-store" });
          if (r.ok) {
            const j = await r.json();
            if (j.user) {
              setMeState(j.user);
              setStoredUser(j.user);
            } else {
              clearSession();
              setMeState(null);
            }
          } else {
            clearSession();
            setMeState(null);
          }
        } catch {}
      } else {
        setMeState(null);
      }
      await refreshSettings();
      setReady(true);
    })();
  }, [refreshSettings]);

  const setMe = useCallback((m: Me) => {
    setMeState(m);
    setStoredUser(m);
    if (!m) setToken("");
  }, []);

  const setSession = useCallback((m: Me, token: string) => {
    setToken(token);
    setStoredUser(m);
    setMeState(m);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setMeState(null);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("ait_lang", l);
    } catch {}
  }, []);

  const fontUp = useCallback(() => {
    setFontScale((f) => {
      const n = Math.min(1.4, +(f + 0.1).toFixed(1));
      try {
        localStorage.setItem("ait_font", String(n));
      } catch {}
      return n;
    });
  }, []);

  const fontDown = useCallback(() => {
    setFontScale((f) => {
      const n = Math.max(0.8, +(f - 0.1).toFixed(1));
      try {
        localStorage.setItem("ait_font", String(n));
      } catch {}
      return n;
    });
  }, []);

  const t = useCallback(
    (k: string, params?: Record<string, string | number>) => {
      const d = dicts[lang] || ar;
      let s: string = d[k] || ar[k] || k;
      if (params) {
        for (const [p, v] of Object.entries(params)) {
          s = s.split(`{${p}}`).join(String(v));
        }
      }
      return s;
    },
    [lang]
  );

  /** الإخفاء السريع — يُحفظ في جلسة التبويب (يبقى بعد التحديث، يزول بإغلاق التبويب) */
  const setHidden = useCallback((v: boolean) => {
    qhSetHidden(v);
    setHiddenState(v);
  }, []);

  /** التنقل الداخلي — ينقل ويصعد للأعلى ويحدّث العنوان (SPA كامل) */
  const navigate = useCallback<Navigate>((v, id) => {
    setNav({ view: v, id });
    pushUrl(v, id);
    try {
      sessionStorage.setItem("ait_last_view", JSON.stringify({ view: v, id }));
    } catch {}
    try {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    } catch {
      window.scrollTo(0, 0);
    }
  }, []);

  /* رسالة من Service Worker: الضغط على إشعار الجهاز ينقل للموضع المناسب داخل التطبيق */
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; view?: ViewKey; id?: string } | null;
      if (d && d.type === "ait-navigate" && d.view) {
        setNav({ view: d.view as ViewKey, id: d.id });
        pushUrl(d.view as ViewKey, d.id);
        try {
          sessionStorage.setItem("ait_last_view", JSON.stringify({ view: d.view, id: d.id }));
        } catch {}
        try {
          window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
        } catch {
          window.scrollTo(0, 0);
        }
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      t,
      dir: lang === "ar" ? "rtl" : "ltr",
      fontScale,
      fontUp,
      fontDown,
      me,
      setMe,
      setSession,
      logout,
      settings,
      refreshSettings,
      hidden,
      setHidden,
      ready,
      view,
      viewId,
      navigate,
    }),
    [lang, setLang, t, fontScale, fontUp, fontDown, me, setMe, setSession, logout, settings, refreshSettings, hidden, ready, view, viewId, navigate]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

"use client";
/**
 * مزوّد الوضع الليلي/النهاري — مخصص وخفيف بدون next-themes
 *
 * لماذا مخصص؟ مكتبات الثيم ترسم <script> داخل مكوّنات React، و React 19 يحذّر:
 * "Encountered a script tag while rendering React component..." عند كل إعادة رسم.
 * هذا المزوّد لا يرسم أي <script> إطلاقاً:
 *  - الخادم (layout.tsx) يقرأ كوكي ait_theme ويضع class="dark" على <html> قبل الرسم (بلا وميض)
 *  - التبديل هنا يطبّق الفئة فوراً + يحفظ كوكي + localStorage للتوافق مع الإصدارات السابقة
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";
const STORAGE_KEY = "ait_theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // سنة

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (value: Theme | ((prev: Theme) => Theme)) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
});

/** تطبيق الثيم على مستند فوراً */
function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", t === "dark");
  root.style.colorScheme = t;
}

/** حفظ الكوكي ليقرأه الخادم في الطلبات القادمة (رسم بلا وميض) */
function saveCookie(t: Theme) {
  document.cookie = `${STORAGE_KEY}=${t}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  /* نبدأ "light" على الخادم والعميل معاً (بلا اختلاف ترطيب)،
     ثم نزامن الحالة الفعلية التي رسمها الخادم من الكوكي بعد التركيب */
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    let actual: Theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    /* ترحيل من الإصدارات السابقة: كوكي مفقود لكن localStorage فيه اختيار */
    if (!document.cookie.includes(`${STORAGE_KEY}=`)) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === "dark" || saved === "light") {
          actual = saved;
          applyTheme(actual);
          saveCookie(actual);
        }
      } catch {}
    }
    setThemeState(actual);
  }, []);

  const setTheme = useCallback((value: Theme | ((prev: Theme) => Theme)) => {
    setThemeState((prev) => {
      const next = typeof value === "function" ? (value as (p: Theme) => Theme)(prev) : value;
      applyTheme(next);
      saveCookie(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme: theme, setTheme }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

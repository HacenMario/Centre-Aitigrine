"use client";
/**
 * مركز أيت تقرين — عميل API موحّد (نمط طمأنينة)
 * - التوكن يُحفظ في localStorage (بلا كوكيز — تعمل داخل iframe/المعاينة دون حجب)
 * - غلاف fetch عام يُرفق تلقائياً x-auth-token على كل نداءات /api/ الداخلية
 * - installAuthFetch() تُستدعى مرة واحدة من AppProvider
 */

export const TOKEN_KEY = "ait_token";
export const USER_KEY = "ait_user";

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function getStoredUser<T>(): T | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(u: unknown) {
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  } catch {}
}

export function clearSession() {
  setToken("");
  setStoredUser(null);
}

/* ─────────── غلاف fetch + XHR العام ─────────── */

const WRAP_FLAG = "__aitAuthWrapped__";
const XHR_FLAG = "__aitXhrWrapped__";

function isInternalApiUrl(url: string): boolean {
  try {
    const internal = url.startsWith("/") || url.startsWith(window.location.origin);
    return internal && /\/api\//.test(url);
  } catch {
    return false;
  }
}

/** تركيب الغلاف مرة واحدة: كل نداء /api/ داخلي (fetch أو XHR) يحمل توكن الجلسة تلقائياً */
export function installAuthFetch() {
  const w = window as unknown as { [WRAP_FLAG]?: boolean; [XHR_FLAG]?: boolean; fetch?: typeof fetch };

  /* 1) غلاف fetch */
  if (!w[WRAP_FLAG] && typeof window.fetch === "function") {
    const original = window.fetch.bind(window);
    w[WRAP_FLAG] = true;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (isInternalApiUrl(url) && getToken()) {
          const headers = new Headers(init?.headers || {});
          if (!headers.has("x-auth-token")) headers.set("x-auth-token", getToken());
          if (
            init?.method &&
            init.method !== "GET" &&
            init.method !== "HEAD" &&
            !headers.has("Content-Type") &&
            !(init?.body instanceof FormData) &&
            typeof init?.body === "string"
          ) {
            headers.set("Content-Type", "application/json");
          }
          init = { ...(init || {}), headers };
        }
      } catch {}
      return original(input as RequestInfo, init);
    };
  }

  /* 2) غلاف XHR — يغطي رفع الوسائط بشريط التقدم (كان يرسل بلا توكن → 401) */
  if (!w[XHR_FLAG] && typeof XMLHttpRequest !== "undefined") {
    w[XHR_FLAG] = true;
    const proto = XMLHttpRequest.prototype as unknown as Record<string, unknown>;
    const origOpen = proto.open as (...a: unknown[]) => void;
    proto.open = function (this: XMLHttpRequest & { __aitUrl?: string }, ...a: unknown[]) {
      this.__aitUrl = String(a[1] || "");
      return origOpen.apply(this, a);
    };
    const origSend = proto.send as (...a: unknown[]) => void;
    proto.send = function (this: XMLHttpRequest & { __aitUrl?: string }, ...a: unknown[]) {
      try {
        if (isInternalApiUrl(this.__aitUrl || "") && getToken()) {
          this.setRequestHeader("x-auth-token", getToken());
        }
      } catch {}
      return origSend.apply(this, a);
    };
  }
}

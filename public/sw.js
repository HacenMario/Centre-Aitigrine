/* مركز أيت تقرين — Service Worker: إشعارات Web Push + تخزين مؤقت */
const CACHE = "ait-tegrine-v2";
const ASSETS = ["/", "/manifest.webmanifest", "/logo.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Push — يظهر الإشعار حتى والموقع مغلق — ثلاثي اللغة حسب لغة الجهاز */
self.addEventListener("push", (e) => {
  let data = { titles: null, bodies: null, title: null, body: null };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch {
    try {
      data.body = e.data ? e.data.text() : "";
    } catch {}
  }
  /* اختيار اللغة: لغة واجهة الجهاز مع مطابقة جزئية (ar-DZ → ar) */
  const navLang = (self.navigator && self.navigator.language) || "ar";
  const base = String(navLang).slice(0, 2).toLowerCase();
  const pick = (map) => {
    if (!map || typeof map !== "object") return "";
    return map[base] || map[navLang] || map.ar || map.fr || map.en || "";
  };
  const title = pick(data.titles) || data.title || "مركز أيت تقرين";
  const body = pick(data.bodies) || data.body || "";
  const dir = base === "ar" ? "rtl" : "ltr";
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      dir,
      lang: base,
      vibrate: [200, 100, 200],
      /* link = وجهة الإشعار: الضغط عليه يفتح الصفحة المناسبة (نمط طمأنينة) */
      data: { url: "/", link: String(data.link || "") },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const link = String((e.notification.data && e.notification.data.link) || "");
  const parts = link.split(":");
  const view = parts[0] || "";
  const id = parts[1] || "";
  const url = view && view !== "home" ? `/?view=${view}${id ? `&id=${id}` : ""}` : "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.focus();
          /* التطبيق مفتوح: تنقّل سلس داخلياً دون إعادة تحميل */
          if (view && "postMessage" in c) {
            c.postMessage({ type: "ait-navigate", view, id: id || undefined });
          }
          return c;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

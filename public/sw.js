/* مركز أيت تقرين — Service Worker v3.8
 * ★ جديد: وضع عدم الاتصال — تصفح الصفحات الأساسية بلا إنترنت
 *   - الصفحات والواجهات: network-first مع رجوع للنسخة المخزنة (تحديث محتوى عند العودة للاتصال)
 *   - الصور/الوسائط والملفات الثابتة: cache-first (سرعة فائقة وتوفير باقة)
 *   - نداءات API: network-only للكتابة + network-first للقراءة مع رد بلا شبكة عند العجز
 *   - صفحة offline أنيقة داخلية بلا ملف خارجي (تعمل حتى إن لم تُخزن مسبقاً)
 * Push — يظهر الإشعار حتى والموقع مغلق — ثلاثي اللغة حسب لغة الجهاز (كما هو)
 */
const CACHE = "ait-tegrine-v3.10.0";
const ASSETS = ["/", "/manifest.webmanifest", "/logo.png", "/logo.svg"];

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

/* ───────── استراتيجيات الجلب ───────── */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // الكتابة تمر للشبكة مباشرة
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // الخرائط/الخطوط الخارجية

  /* نداءات API: قراءة network-first مع نسخة احتياطية؛ الحجوزات الحساسة بلا كاش */
  if (url.pathname.startsWith("/api/")) {
    /* الوسائط الكبيرة فقط: cache-first بعد أول جلب (الفيديو يُخزن مرة)
       ★ v3.9.0: الفواتير لم تعد cache-first — كانت تُخدم PDF قديماً من الكاش */
    if (url.pathname.startsWith("/api/media/")) {
      e.respondWith(
        caches.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) {
                const clone = res.clone();
                caches.open(CACHE).then((c) => c.put(req, clone));
              }
              return res;
            })
        )
      );
      return;
    }
    /* باقي API: حيّة دائماً — عند العجز نرجع آخر نسخة إن وجدت */
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && (url.pathname === "/api/settings" || url.pathname.startsWith("/api/pages") || url.pathname.startsWith("/api/services") || url.pathname.startsWith("/api/courses") || url.pathname.startsWith("/api/specialists") || url.pathname.startsWith("/api/articles") || url.pathname.startsWith("/api/testimonials"))) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || new Response(JSON.stringify({ offline: true }), { status: 503, headers: { "Content-Type": "application/json" } })))
    );
    return;
  }

  /* صفحات التنقل: network-first مع رجوع للكاش ثم صفحة عدم الاتصال */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put("/", clone));
          return res;
        })
        .catch(async () => (await caches.match("/")) || offlinePage())
    );
    return;
  }

  /* الأصول الثابتة (JS/CSS/خطوط/أيقونات): stale-while-revalidate */
  e.respondWith(
    caches.match(req).then((hit) => {
      const fetching = fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => hit);
      return hit || fetching;
    })
  );
});

/* صفحة عدم الاتصال المدمجة — أنيقة وبشعار المركز وثلاثية اللغة */
function offlinePage() {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>بلا اتصال — مركز آيت تقرين</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#0f766e,#134e4a);color:#fff;padding:1.25rem;text-align:center}
.card{max-width:26rem}
img{width:84px;height:84px;border-radius:22px;background:#ffffff22;padding:8px;object-fit:contain}
h1{font-size:1.35rem;margin:.9rem 0 .4rem}
p{font-size:.9rem;opacity:.85;line-height:1.7;margin:.2rem 0}
button{margin-top:1.2rem;background:#fff;color:#0f766e;border:0;border-radius:999px;padding:.8rem 1.6rem;font-weight:800;font-size:.9rem;cursor:pointer}
</style></head><body><div class="card">
<img src="/logo.png" alt="">
<h1 id="t">لا يوجد اتصال بالإنترنت</h1>
<p id="d">أنت الآن في وضع عدم الاتصال — الصفحات التي زرتها سابقاً تبقى متاحة للتصفح. أعد المحاولة عند عودة الشبكة.</p>
<button onclick="location.reload()">إعادة المحاولة</button>
</div><script>
var L={ar:{t:"لا يوجد اتصال بالإنترنت",d:"أنت الآن في وضع عدم الاتصال — الصفحات التي زرتها سابقاً تبقى متاحة للتصفح. أعد المحاولة عند عودة الشبكة.",b:"إعادة المحاولة"},fr:{t:"Pas de connexion Internet",d:"Vous êtes hors ligne — les pages déjà visitées restent disponibles. Réessayez dès le retour du réseau.",b:"Réessayer"},en:{t:"No internet connection",d:"You are offline — previously visited pages remain available. Try again when the network is back.",b:"Retry"}};
var b=(navigator.language||"ar").slice(0,2);var x=L[b]||L.ar;
if(x){document.getElementById("t").textContent=x.t;document.getElementById("d").textContent=x.d;document.querySelector("button").textContent=x.b;document.documentElement.lang=b;document.documentElement.dir=b==="ar"?"rtl":"ltr";}
</script></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

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

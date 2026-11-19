import type { NextConfig } from "next";

/**
 * v3.8: رؤوس أمان لكل الاستجابات — حماية من XSS والنفخ وأنواع MIME الخبيثة
 * frame-ancestors يسمح للموقع نفسه ومعاينات النشر (space-z.ai) — ضروري لعمل المعاينة
 * ★ v3.24.2: microphone=(self) — كانت () فتحجب الميكروفون على الموقع نفسه حتى مع
 *   إذن المستخدم (سبب «تعذر الوصول للميكروفون» رغم الإذن)؛ (self) يسمح للموقع حصراً
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self' https://*.space-z.ai https://*.vercel.app;",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(self), payment=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

/* ★ v3.24.2: تحديث الكاش إجبارياً — الأصول الموقعة immutable، وsw.js بلا كاش إطلاقاً
   كي يصل التحديث الجديد لكل المستخدمين فور نشره بلا إعادة يدوية
 * ★ v3.28.1: الصفحة الرئيسية تنتقل من «بلا كاش» (no-cache, must-revalidate) إلى كاش
   الحافة المعتمد في v3.28 نفسه (public, max-age=0, s-maxage=60, stale-while-revalidate=300).
   السبب: سجلات Vercel بتاريخ 19-11 أظهرت إعادة توليد HTML الرئيسية من الأصل في كل طلب
   (17 MISS وصفر HIT خلال 27 دقيقة) — آخر مصدر Fast Origin Transfer غير ضروري بعد خطة v3.28.
   لماذا هو آمن بلا مساس بأي وظيفة:
   - max-age=0 يبقي المتصفح يتحقق من الحافة في كل زيارة، وVercel يفضي كاش الحافة تلقائياً
     مع كل نشر جديد — هدف v3.24.2 (وصول التحديث فور النشر بلا إعادة يدوية) محفوظ كما هو.
   - HTML الرئيسية واحد للجميع (التطبيق يعمل client-only عبر AppLauncher والدخول في
     المتصفح) — لا محتوى شخصياً في الصفحة يُخلط بين الزوار.
   - روابط المعاينة ?view=&id= مفاتيح كاش منفصلة حسب سلسلة الاستعلام — المعاينة الحية
     للزواحف (v3.21.0) بكل بياناتها كما هي، وتقل قراءاتها من قاعدة البيانات أيضاً؛
     وتعديلات الإدارة تظهر للمعاينات خلال ≤60 ثانية (نفس سلوك كتالوجات v3.28).
   - سياسة sw.js والأصول immutable ورؤوس الأمان كلها بلا أي تغيير */
const cacheHeaders = [
  {
    source: "/sw.js",
    headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
  },
  {
    source: "/",
    headers: [
      {
        key: "Cache-Control",
        value: "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      },
    ],
  },
  {
    source: "/_next/static/:path*",
    headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
  },
];

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }, ...cacheHeaders];
  },
};

export default nextConfig;

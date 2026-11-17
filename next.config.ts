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

/* ★ v3.24.2: تحديث الكاش إجبارياً — الأصول الموقعة immutable، وsw.js والصفحة الرئيسية
   بلا كاش إطلاقاً كي يصل التحديث الجديد لكل المستخدمين فور نشره بلا إعادة يدوية */
const cacheHeaders = [
  {
    source: "/sw.js",
    headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
  },
  {
    source: "/",
    headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
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

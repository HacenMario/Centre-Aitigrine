import type { NextConfig } from "next";

/**
 * v3.8: رؤوس أمان لكل الاستجابات — حماية من XSS والنفخ وأنواع MIME الخبيثة
 * frame-ancestors يسمح للموقع نفسه ومعاينات النشر (space-z.ai) — ضروري لعمل المعاينة
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
    value: "camera=(), microphone=(), geolocation=(self), payment=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

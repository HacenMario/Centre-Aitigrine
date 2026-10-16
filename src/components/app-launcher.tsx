"use client";
/**
 * v3.21.0 — مغلف إقلاع التطبيق (client-only كما كان تماماً)
 * فُصل عن page.tsx كي تصبح الصفحة خادمية وتصدّر generateMetadata
 * (معاينة روابط فايسبوك/واتساب) دون أي تغيير في سلوك الإقلاع أو شاشة التحميل
 */
import dynamic from "next/dynamic";

const AppShell = dynamic(() => import("@/components/app-shell"), {
  ssr: false,
  loading: () => (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <span className="absolute inset-0 rounded-3xl bg-primary/25 animate-ping" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="relative h-20 w-20 object-contain animate-pulse" />
        </div>
        <div className="w-48 space-y-2.5" aria-hidden="true">
          <div className="ait-shimmer h-3 rounded-full" />
          <div className="ait-shimmer h-3 w-2/3 mx-auto rounded-full" />
        </div>
      </div>
    </div>
  ),
});

export default function AppLauncher() {
  return <AppShell />;
}

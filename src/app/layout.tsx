import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "مركز آيت تقرين — العناية النفسية، الأرطفونية و التكوين",
  description:
    "مركز آيت تقرين للعناية النفسية، الأرطفونية و التكوين — جلسات نفسية احترافية، أرطفونية علاجية، وتكوينات معتمدة في الجزائر العاصمة.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "أيت تقرين", statusBarStyle: "default" },
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0d7a6f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  /* الوضع الليلي يُقرأ من الكوكي على الخادم — class="dark" قبل أول رسم (بلا وميض) */
  const theme = (await cookies()).get("ait_theme")?.value === "dark" ? "dark" : "light";
  return (
    <html lang="ar" dir="rtl" className={theme === "dark" ? "dark" : ""} style={{ colorScheme: theme }} suppressHydrationWarning>
      <head>
        {/* v3.6: الخطوط (Inter + Cairo) مستضافة محلياً في /fonts — بلا Google Fonts وقت
            التشغيل: لا انتظار شبكة، لا أوزان ناقصة، لا تشوّه حروف في FR/EN على أي جهاز */}
        <link rel="preload" href="/fonts/cairo-arabic.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="antialiased bg-background text-foreground font-cairo min-h-dvh">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}

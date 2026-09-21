"use client";
/**
 * مركز أيت تقرين — هيكل التطبيق v4 (صفحة واحدة: تنقّل عبر السياق)
 * ★ كل الصفحات موصولة: الرئيسية، الأخصائيون، اتصل بالمركز، لوحة القيادة، المرضى، الملفات
 * ★ مزوّد الوضع الليلي/النهاري (كوكي على الخادم — بلا وميض)
 * ★ الصلاحيات تُراجع عند تغيّر المستخدم وبعد اكتمال الإقلاع
 */
import { useEffect } from "react";
import { AppProvider, useApp } from "@/lib/app-context";
import type { ViewKey } from "@/lib/nav";
import { ThemeProvider } from "@/components/theme-provider";
import Header from "@/components/header";
import SidebarNav from "@/components/sidebar-nav";
import Footer from "@/components/footer";
import WhatsappButton from "@/components/whatsapp-button";
import QuickHide from "@/components/quick-hide";
import ReassurancePopup from "@/components/reassurance-popup";
import BackToTop from "@/components/back-to-top";
import FloatingAd from "@/components/floating-ad";
import Landing from "@/components/views/landing";
import Login from "@/components/views/login";
import Appointments from "@/components/views/appointments";
import Services from "@/components/views/services";
import Courses from "@/components/views/courses";
import Ads from "@/components/views/ads";
import Ebooks from "@/components/views/ebooks";
import Accounts from "@/components/views/accounts";
import CenterSettings from "@/components/views/center-settings";
import Feedback from "@/components/views/feedback";
import InfoPage from "@/components/views/info-page";
import Profile from "@/components/views/profile";
import Specialists from "@/components/views/specialists";
import Contact from "@/components/views/contact";
import Dashboard from "@/components/views/dashboard";
import Patients from "@/components/views/patients";
import Documents from "@/components/views/documents";
import Record from "@/components/views/record";
import BrandSkeleton from "@/components/brand-skeleton";

const STAFF_ONLY: ViewKey[] = ["accounts", "settings", "dashboard", "patients", "record"];
/* إدارة الوثائق: صفحة خاصة بحساب الإدارة فقط — طلب المستخدم */
const ADMIN_ONLY: ViewKey[] = ["documents"];

function Shell() {
  const { t, me, hidden, ready, view, viewId, navigate } = useApp();

  /* مراجعة الصلاحيات عند تغيّر المستخدم أو الصفحة — بعد اكتمال الإقلاع فقط */
  useEffect(() => {
    if (!ready) return;
    if (view === "login" && me) navigate("home");
    /* إدارة الوثائق: للإدارة فقط */
    if (ADMIN_ONLY.includes(view) && me?.role !== "admin") {
      navigate("home");
      return;
    }
    if (STAFF_ONLY.includes(view) && (!me || (me.role !== "admin" && me.role !== "assistant"))) {
      /* المرضى والملفات مسموح بها للأخصائي أيضاً */
      if ((view === "patients" || view === "record") && me?.role === "specialist") return;
      navigate("home");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, view, ready]);

  /* شاشة الإخفاء السريع تغطي كل شيء */
  if (hidden) return <QuickHide />;

  /* هيكل التحميل بشعار المركز عند إقلاع التطبيق */
  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col">
        <div className="h-16 border-b bg-card" aria-hidden="true" />
        <BrandSkeleton className="flex-1" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {/* الهيدر ثابت fixed — لا يتأثر بقفل التمرير عند فتح النوافذ */}
      <Header />
      <div className="h-16 shrink-0" aria-hidden="true" />

      <div className="flex flex-1 w-full mx-auto max-w-[100rem]">
        {/* v3.5: القائمة الجانبية على الحاسوب أيضاً تظهر فقط بالضغط على زر القائمة (مثل الهاتف)
            — نُزعت القائمة الثابتة على الحاسوب بطلب المستخدم */}

        {/* المحتوى — التمرير على body */}
        <main id="ait-main" className="flex-1 min-w-0 px-4 py-6 w-full sm:px-6 sm:py-8 lg:px-8">
          <div className="ait-view mx-auto max-w-6xl" key={view + (viewId || "")}>
            {view === "home" && <Landing navigate={navigate} />}
            {view === "login" && <Login onDone={() => navigate("home")} />}
            {view === "appointments" && <Appointments navigate={navigate} />}
            {view === "specialists" && <Specialists navigate={navigate} />}
            {view === "contact" && <Contact navigate={navigate} />}
            {view === "services" && <Services navigate={navigate} />}
            {view === "courses" && <Courses navigate={navigate} />}
            {view === "ads" && <Ads navigate={navigate} />}
            {view === "ebooks" && <Ebooks navigate={navigate} />}
            {view === "ebook" && <Ebooks navigate={navigate} />}
            {view === "accounts" && <Accounts navigate={navigate} />}
            {view === "dashboard" && <Dashboard navigate={navigate} />}
            {view === "patients" && <Patients navigate={navigate} />}
            {view === "documents" && <Documents navigate={navigate} />}
            {view === "record" && <Record patientId={viewId} navigate={navigate} />}
            {view === "settings" && <CenterSettings navigate={navigate} />}
            {view === "feedback" && <Feedback navigate={navigate} />}
            {view === "profile" && <Profile navigate={navigate} />}
            {view === "faq" && <InfoPage page="faq" navigate={navigate} />}
            {view === "about" && <InfoPage page="about" navigate={navigate} />}
            {view === "privacy" && <InfoPage page="privacy" navigate={navigate} />}
            {view === "terms" && <InfoPage page="terms" navigate={navigate} />}
          </div>
        </main>
      </div>

      <Footer navigate={navigate} />
      <WhatsappButton />
      {/* نافذة لحظة اطمئنان — تظهر مرة واحدة في الجلسة عند ولوج الرئيسية */}
      <ReassurancePopup />
      {/* الإعلان العائم — للعملاء والأخصائيين (نمط طمأنينة) */}
      <FloatingAd />
      {/* زر العودة إلى الأعلى — في كل الصفحات */}
      <BackToTop />
    </div>
  );
}

export default function AppShell() {
  return (
    <ThemeProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ThemeProvider>
  );
}

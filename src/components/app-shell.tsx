"use client";
/**
 * مركز أيت تقرين — هيكل التطبيق v6 (صفحة واحدة: تنقّل عبر السياق)
 * ★ v3.22.1: تحسينات بعد المراجعة — دون أي تغيير وظيفي:
 *   - الشريط الجانبي لم يعد دائماً: درج تنقّل موحّد (جوال + حاسوب) يفتح بزر ☰ في الشريط
 *     أو تبويب «المزيد» في الشريط السفلي (الجوال)
 *   - الشعار مع الاسم الكامل ظاهر دائماً في شريط التطبيق
 *   - سلّم الطبقات محكم: النوافذ z-100+ فوق كل عناصر الواجهة، والقوائم z-120 فوقها
 * ★ v3.22.2: إخفاء شريط التبويبات والأزرار العائمة عند فتح أي نافذة (نمط التطبيقات)
 *   — يعالج نهائياً ظهور النوافذ خلف الشريط على متصفحات الجوال (backdrop-filter)
 * ★ كل الصفحات موصولة كما هي — لم يُزال أي عنصر من التنقل
 * ★ مزوّد الوضع الليلي/النهاري (كوكي على الخادم — بلا وميض)
 * ★ الصلاحيات تُراجع عند تغيّر المستخدم وبعد اكتمال الإقلاع
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppProvider, useApp } from "@/lib/app-context";
import type { ViewKey } from "@/lib/nav";
import { ThemeProvider } from "@/components/theme-provider";
import Header from "@/components/header";
import NavDrawer from "@/components/nav-drawer";
import BottomTabs from "@/components/bottom-tabs";
import Footer from "@/components/footer";
import WhatsappButton from "@/components/whatsapp-button";
import QuickHide from "@/components/quick-hide";
import ReassurancePopup from "@/components/reassurance-popup";
import BackToTop from "@/components/back-to-top";
import FloatingAd from "@/components/floating-ad";
import ChatbotWidget from "@/components/chatbot-widget";
import GooglePhoneDialog from "@/components/google-phone-dialog";
import EbookOrderPopup from "@/components/ebook-order-popup";
import SocialProofPopup from "@/components/social-proof-popup";
import Landing from "@/components/views/landing";
import Login from "@/components/views/login";
import Appointments from "@/components/views/appointments";
import Services from "@/components/views/services";
import Courses from "@/components/views/courses";
import Ads from "@/components/views/ads";
import Ebooks from "@/components/views/ebooks";
import Articles from "@/components/views/articles";
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
import EbookOrders from "@/components/views/ebook-orders";
import Record from "@/components/views/record";
import Earnings from "@/components/views/earnings";
import Payroll from "@/components/views/payroll";
import Reports from "@/components/views/reports";
import Testimonials from "@/components/views/testimonials";
import BrandSkeleton from "@/components/brand-skeleton";

const STAFF_ONLY: ViewKey[] = ["accounts", "patients", "record", "orders"];
/* ★ v3.23: لوحة القيادة + إعدادات المركز + الأجور + التقارير + الوثائق — للإدارة فقط
   (حُجبت لوحة القيادة والإعدادات عن حساب المساعد — طلب المستخدم) */
const ADMIN_ONLY: ViewKey[] = ["documents", "dashboard", "settings", "payroll", "reports"];

function Shell() {
  const { t, me, hidden, ready, view, viewId, navigate } = useApp();
  /* درج التنقّل — يُفتح من زر ☰ في شريط التطبيق (كل الأجهزة)
     أو من تبويب «المزيد» في الشريط السفلي (الجوال) ★ v3.22.1 */
  const [navOpen, setNavOpen] = useState(false);

  /* ★ v3.9.0: رسائل العودة من Google — نجاح واضح أو سبب فشل صريح
     (كانت تُكتب صامتة فلا يرى المستخدم شيئاً بعد التحويل من Google) */
  useEffect(() => {
    if (!ready) return;
    try {
      const w = sessionStorage.getItem("ait_gauth_welcome");
      const e = sessionStorage.getItem("ait_gauth_error");
      if (w) {
        toast.success(t("gauth.welcome"));
        sessionStorage.removeItem("ait_gauth_welcome");
      } else if (e) {
        const key = `gauth.${e}`;
        const msg = t(key);
        toast.error(msg === key ? t("gauth.error") : msg, { duration: 9000 });
        sessionStorage.removeItem("ait_gauth_error");
      }
    } catch {}
  }, [ready]);

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
      /* المرضى والملفات مسموح بها للأخصائي أيضاً — والمكوّن (ملفاته المعيَّنة له) ★ v3.11 */
      if (
        (view === "patients" || view === "record") &&
        (me?.role === "specialist" || me?.role === "trainer")
      )
        return;
      navigate("home");
    }
    /* ★ v3.11: المكوّن لا يستقبل مواعيد — أي وصول مباشر لصفحة المواعيد يُعاد للرئيسية */
    if (view === "appointments" && me?.role === "trainer") {
      navigate("home");
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, view, ready]);
  /* شاشة الإخفاء السريع تغطي كل شيء */
  if (hidden) return <QuickHide />;

  /* هيكل التحميل بشعار المركز عند إقلاع التطبيق */
  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col">
        <div className="h-14 border-b bg-card" aria-hidden="true" />
        <BrandSkeleton className="flex-1" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      {/* ★ v3.22.1: درج التنقّل الموحّد — كل الصفحات وبوابات الدخول كما هي
          يُفتح بزر ☰ في شريط التطبيق (جوال وحاسوب) أو تبويب «المزيد» (جوال) */}
      <NavDrawer open={navOpen} onOpenChange={setNavOpen} />

      <div className="flex min-h-dvh flex-col">
        {/* شريط التطبيق ثابت fixed — لا يتأثر بقفل التمرير عند فتح النوافذ */}
        <Header onMenu={() => setNavOpen(true)} />
        <div className="h-14 shrink-0" aria-hidden="true" />

        {/* المحتوى — التمرير على body */}
        <main id="ait-main" className="flex-1 min-w-0 w-full px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
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
            {/* v3.6.0: المقالات العلمية — للجميع، النشر للأخصائيين والإدارة */}
            {view === "articles" && <Articles navigate={navigate} />}
            {/* v3.8.0: شهادات وقصص النجاح */}
            {view === "testimonials" && <Testimonials navigate={navigate} />}
            {view === "accounts" && <Accounts navigate={navigate} />}
            {view === "dashboard" && <Dashboard navigate={navigate} />}
            {view === "patients" && <Patients navigate={navigate} />}
            {view === "documents" && <Documents navigate={navigate} />}
            {/* v3.20: طلبات شراء الكتب — إدارة ومساعد */}
            {view === "orders" && <EbookOrders navigate={navigate} />}
            {view === "record" && <Record patientId={viewId} navigate={navigate} />}
            {view === "earnings" && <Earnings navigate={navigate} />}
            {view === "payroll" && <Payroll navigate={navigate} />}
            {view === "reports" && <Reports navigate={navigate} />}
            {view === "settings" && <CenterSettings navigate={navigate} />}
            {view === "feedback" && <Feedback navigate={navigate} />}
            {view === "profile" && <Profile navigate={navigate} />}
            {view === "faq" && <InfoPage page="faq" navigate={navigate} />}
            {view === "about" && <InfoPage page="about" navigate={navigate} />}
            {view === "privacy" && <InfoPage page="privacy" navigate={navigate} />}
            {view === "terms" && <InfoPage page="terms" navigate={navigate} />}
          </div>
        </main>

        {/* فوتر مدمج بأسلوب تطبيق — سطر واحد أنيق */}
        <Footer navigate={navigate} />
      </div>

      {/* ★ v3.22.0: شريط التبويبات السفلي للجوال — قلب واجهة التطبيق */}
      <BottomTabs onMore={() => setNavOpen(true)} />

      {/* ★ v3.8.1: حزمة الأزرار العائمة — عمود واحد في الزاوية يمنع أي تراكب
          ★ v3.22.1: z-[45] — فوق شريط التطبيق وتحت النوافذ المنبثقة دائماً
          ★ v3.22.0: مرفوعة فوق شريط التبويبات على الجوال/التابلت (< lg)
          ★ v3.22.2: صنف ait-floaters — ينسحب مع شريط التبويبات عند فتح أي نافذة */}
      <div className="ait-floaters fixed z-[45] bottom-[5.75rem] end-4 lg:bottom-6 lg:end-6 flex flex-col items-center gap-2.5 pointer-events-none">
        <div className="pointer-events-auto"><ChatbotWidget /></div>
        <div className="pointer-events-auto"><WhatsappButton /></div>
        <div className="pointer-events-auto"><BackToTop /></div>
      </div>
      {/* نافذة لحظة اطمئنان — تظهر مرة واحدة في الجلسة عند ولوج الرئيسية */}
      <ReassurancePopup />
      {/* ★ v3.20: نافذة طلبات شراء الكتب للإدارة — صوت + قبول/تخطي فوق كل شيء */}
      <EbookOrderPopup />
      {/* ★ v3.20: نافذة الإثبات الاجتماعي — تحفيز لطيف للجميع (كل 5 دقائق، 10 ثوانٍ) */}
      <SocialProofPopup />
      {/* ★ v3.10: نافذة الهاتف الإلزامية لحسابات Google — أول مرة فقط، بلا تجاوز ممكن */}
      <GooglePhoneDialog />
      {/* الإعلان العائم — للعملاء والأخصائيين (نمط طمأنينة) */}
      <FloatingAd />
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

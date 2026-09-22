"use client";
/**
 * القائمة الجانبية v4 — التنقل عبر useApp().navigate (مصدر وحيد)
 * ★ تمرير كامل يضمن الوصول لكل العناصر (نمط طمأنينة)
 * ★ ترتيب حسب أهمية الصفحة لنوع المستخدم: صفحات الدور أولاً ثم العامة
 * ★ للزوار: بوابات دخول مستقلة (عميل / أخصائي / إدارة)
 */
import { useApp } from "@/lib/app-context";
import { NAV_ITEMS, LOGIN_ENTRIES, ROLE_IMPORTANT, type Role } from "@/lib/nav";
import { getQuickHideConfig, saveQuickHideConfig } from "@/lib/quick-hide";
import {
  Home,
  CalendarClock,
  Sparkles,
  GraduationCap,
  BookOpenText,
  Newspaper,
  UsersRound,
  Settings,
  MessageSquareHeart,
  CircleHelp,
  Info,
  ShieldCheck,
  FileText,
  Mail,
  Stethoscope,
  LayoutDashboard,
  ClipboardPlus,
  FileBadge2,
  LogIn,
  LogOut,
  UserRound,
  EyeOff,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ICONS: Record<string, LucideIcon> = {
  Home,
  CalendarClock,
  Sparkles,
  GraduationCap,
  BookOpenText,
  Newspaper,
  UsersRound,
  Settings,
  MessageSquareHeart,
  CircleHelp,
  Info,
  ShieldCheck,
  FileText,
  Mail,
  Stethoscope,
  LayoutDashboard,
  ClipboardPlus,
  FileBadge2,
};

export default function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t, me, logout, fontUp, fontDown, navigate, view, setHidden } = useApp();
  const role: Role = (me?.role as Role) ?? "guest";

  /* إخفاء سريع: إن لم يُفعّل بعد — نافذة اختيار الرمز السري أولاً */
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  const openQuickHide = () => {
    onNavigate?.();
    if (getQuickHideConfig().enabled) {
      setHidden(true);
      return;
    }
    setPin("");
    setPin2("");
    setPinOpen(true);
  };

  const savePin = async () => {
    if (!/^\d{4,8}$/.test(pin)) { toast.error(t("qh.pinInvalid")); return; }
    if (pin !== pin2) { toast.error(t("qh.pinMismatch")); return; }
    setPinBusy(true);
    try {
      await saveQuickHideConfig(true, pin);
      toast.success(t("qh.setupDone"));
      setPinOpen(false);
      setHidden(true);
    } catch {
      toast.error(t("qh.pinInvalid"));
    }
    setPinBusy(false);
  };

  /** تنقل فعلي + إغلاق نافذة الجوال إن وُجدت */
  const go = (key: string, id?: string) => {
    onNavigate?.();
    navigate(key as Parameters<typeof navigate>[0], id);
  };

  const doLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    logout();
    onNavigate?.();
    toast.success(t("common.logout"));
    navigate("home");
  };

  /* ── الترتيب حسب الأهمية للدور ──
     صفحات الدور المهمة أولاً (الموجودة فعلاً في عناصره)، ثم البقية بترتيبها */
  const all = NAV_ITEMS.filter((i) => i.roles.includes(role));
  const important = (role === "guest" ? [] : ROLE_IMPORTANT[role]) || [];
  const importantItems = important
    .map((k) => all.find((i) => i.key === k))
    .filter(Boolean) as typeof all;
  const rest = all.filter((i) => !important.includes(i.key));
  const items = [...importantItems, ...rest];
  const lastImportant = importantItems.length - 1;

  const Row = ({
    icon: Icon, label, active, onClick, danger, subtle,
  }: {
    icon: LucideIcon;
    label: string;
    active?: boolean;
    onClick: () => void;
    danger?: boolean;
    subtle?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[0.93rem] font-semibold",
        "transition-colors hover:bg-primary/10 hover:text-primary active:bg-primary/15",
        active
          ? "bg-primary/12 text-primary shadow-sm shadow-primary/10"
          : danger
            ? "text-destructive/90 hover:bg-destructive/10 hover:text-destructive"
            : subtle
              ? "text-foreground/70 hover:bg-muted hover:text-foreground"
              : "text-foreground/85"
      )}
    >
      <Icon className="h-5 w-5 shrink-0 opacity-90" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );

  return (
    <nav className="ait-sidebar flex flex-col gap-1 p-3 pb-6" aria-label={t("header.menu")}>
      {/* بوابات الدخول الثلاث للزوار — دائماً في الأعلى (نمط طمأنينة) */}
      {role === "guest" && (
        <>
          <p className="px-3.5 pb-1 pt-1 text-[11px] font-black uppercase tracking-wide text-muted-foreground">
            {t("login.portalsTitle")}
          </p>
          {LOGIN_ENTRIES.map((e) => {
            const Icon = ICONS[e.icon] || LogIn;
            return (
              <Row
                key={e.as}
                icon={Icon}
                label={t(e.label)}
                onClick={() => go("login", e.as)}
              />
            );
          })}
          <div className="my-2 border-t" />
        </>
      )}

      {/* الصفحات مرتبة حسب أهمية الدور */}
      {items.map((item, idx) => {
        const Icon = ICONS[item.icon] || Home;
        return (
          <div key={item.key}>
            <Row
              icon={Icon}
              label={t(item.label)}
              active={view === item.key}
              onClick={() => go(item.key)}
            />
            {(item.divider || idx === lastImportant) && <div className="my-2 border-t" />}
          </div>
        );
      })}

      <div className="mt-3 border-t pt-3">
        {/* حجم النص — متاح داخل القائمة للهواتف الضيقة */}
        <div className="flex items-center justify-between rounded-xl px-3.5 py-2">
          <span className="text-sm font-semibold text-muted-foreground">{t("header.textZoom")}</span>
          <span className="flex items-center gap-1 rounded-full border bg-card p-0.5">
            <button
              type="button"
              onClick={fontDown}
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-black hover:bg-primary/10 hover:text-primary"
              aria-label={t("header.textZoom")}
            >
              أ-
            </button>
            <span className="h-4 w-px bg-border" />
            <button
              type="button"
              onClick={fontUp}
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-black hover:bg-primary/10 hover:text-primary"
              aria-label={t("header.textZoom")}
            >
              أ+
            </button>
          </span>
        </div>
        {me && <Row icon={UserRound} label={t("nav.profile")} active={view === "profile"} onClick={() => go("profile")} />}
        {/* إخفاء سريع — حاسبة حقيقية تحجب كل شيء (لكل المستخدمين — خصوصية) */}
        <Row icon={EyeOff} label={t("qh.quickHide")} subtle onClick={openQuickHide} />
        {me && <Row icon={LogOut} label={t("common.logout")} danger onClick={doLogout} />}
      </div>

      {/* نافذة تفعيل الإخفاء السريع — اختيار الرمز السري */}
      <Dialog open={pinOpen} onOpenChange={(v) => !v && setPinOpen(false)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-start flex items-center gap-2">
              <EyeOff className="h-5 w-5 text-primary" />
              {t("qh.setupTitle")}
            </DialogTitle>
            <DialogDescription className="text-start leading-relaxed">
              {t("qh.setupSub")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="qh-pin">{t("qh.pin")}</Label>
              <Input
                id="qh-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                dir="ltr"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="h-12 text-center text-lg tracking-[0.4em] font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qh-pin2">{t("qh.pinConfirm")}</Label>
              <Input
                id="qh-pin2"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                dir="ltr"
                maxLength={8}
                value={pin2}
                onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
                className="h-12 text-center text-lg tracking-[0.4em] font-bold"
              />
            </div>
            <Button onClick={savePin} disabled={pinBusy} className="w-full h-12 rounded-xl text-base">
              {t("common.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </nav>
  );
}

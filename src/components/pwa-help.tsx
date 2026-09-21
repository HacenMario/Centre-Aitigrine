"use client";
/**
 * مساعد التثبيت والإشعارات — نافذة تشرح خطوة بخطوة كيفية:
 * 1) تثبيت موقع المركز كتطبيق على الحاسوب والهاتف (PWA)
 * 2) تفعيل إشعارات الجهاز (تذكيرات المواعيد)
 * مع زرّي تثبيت/تفعيل مباشرين عندما يدعم المتصفح ذلك
 */
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { enablePushNotifications } from "@/lib/enable-push";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MonitorSmartphone, Bell, Download, Share, PlusSquare, MoreVertical,
  Monitor, Chrome, Puzzle, SquarePlus, BellRing, CheckCircle2, Globe,
} from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Platform = "desktop" | "android" | "ios";

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[13px] font-black shadow-sm">
        {n}
      </span>
      <p className="text-[13.5px] leading-relaxed pt-0.5">{children}</p>
    </li>
  );
}

export default function PwaHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useApp();
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [notifsOn, setNotifsOn] = useState(false);

  /* التقاط حدث التثبيت + حالة الإشعارات */
  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") setNotifsOn(true);
    } catch {}
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const installNow = async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    const choice = await installEvt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallEvt(null);
  };

  const enableNow = async () => {
    const okRes = await enablePushNotifications(t("header.pushOn"));
    if (okRes) setNotifsOn(true);
  };

  const plats: { key: Platform; label: string; icon: React.ReactNode }[] = [
    { key: "desktop", label: t("pwa.desktop"), icon: <Monitor className="h-4 w-4" /> },
    { key: "android", label: t("pwa.android"), icon: <Chrome className="h-4 w-4" /> },
    { key: "ios", label: t("pwa.ios"), icon: <Globe className="h-4 w-4" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-start flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md">
              <MonitorSmartphone className="h-5 w-5" />
            </span>
            {t("pwa.title")}
          </DialogTitle>
          <DialogDescription className="text-start leading-relaxed">
            {t("pwa.sub")}
          </DialogDescription>
        </DialogHeader>

        {/* أزرار مباشرة */}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={installNow} disabled={!installEvt || installed} className="h-12 rounded-xl gap-2 font-bold">
            {installed ? <CheckCircle2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}
            {installed ? t("pwa.installed") : installEvt ? t("pwa.installNow") : t("pwa.installUnavailable")}
          </Button>
          <Button onClick={enableNow} disabled={notifsOn} variant="outline" className="h-12 rounded-xl gap-2 font-bold">
            {notifsOn ? <CheckCircle2 className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
            {notifsOn ? t("pwa.notifsDone") : t("pwa.enableNow")}
          </Button>
        </div>

        {/* تبويبات المنصات */}
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-muted/70 p-1.5">
          {plats.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPlatform(p.key)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[12.5px] font-bold transition-all",
                platform === p.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>

        {/* خطوات التثبيت */}
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <p className="flex items-center gap-2 text-sm font-black">
            <Download className="h-4 w-4 text-primary" />
            {t("pwa.installSection")}
            <Badge variant="outline" className="border-primary/30 bg-primary/8 text-primary text-[10px] font-bold">
              {t("pwa.pwaTag")}
            </Badge>
          </p>
          <ul className="space-y-2.5">
            {platform === "desktop" && (
              <>
                <Step n={1}>
                  {t("pwa.d1")} <Puzzle className="inline h-4 w-4 align-[-2px] text-primary" /> {t("pwa.d1b")} <MoreVertical className="inline h-4 w-4 align-[-2px]" />
                </Step>
                <Step n={2}>{t("pwa.d2")}</Step>
                <Step n={3}>{t("pwa.d3")}</Step>
              </>
            )}
            {platform === "android" && (
              <>
                <Step n={1}>
                  {t("pwa.a1")} <MoreVertical className="inline h-4 w-4 align-[-2px]" />
                </Step>
                <Step n={2}>
                  {t("pwa.a2")} <SquarePlus className="inline h-4 w-4 align-[-2px] text-primary" />
                </Step>
                <Step n={3}>{t("pwa.a3")}</Step>
              </>
            )}
            {platform === "ios" && (
              <>
                <Step n={1}>
                  {t("pwa.i1")} <Share className="inline h-4 w-4 align-[-2px] text-primary" />
                </Step>
                <Step n={2}>
                  {t("pwa.i2")} <PlusSquare className="inline h-4 w-4 align-[-2px]" />
                </Step>
                <Step n={3}>{t("pwa.i3")}</Step>
              </>
            )}
          </ul>
        </div>

        {/* خطوات الإشعارات */}
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <p className="flex items-center gap-2 text-sm font-black">
            <Bell className="h-4 w-4 text-primary" />
            {t("pwa.notifsSection")}
          </p>
          <ul className="space-y-2.5">
            <Step n={1}>{t("pwa.n1")}</Step>
            <Step n={2}>{t("pwa.n2")}</Step>
            <Step n={3}>{t("pwa.n3")}</Step>
          </ul>
          <p className="text-xs text-muted-foreground leading-relaxed rounded-xl bg-muted/60 p-3">
            {t("pwa.note")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

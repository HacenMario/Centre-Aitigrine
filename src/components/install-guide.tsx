"use client";
/**
 * دليل تثبيت الموقع كتطبيق + تفعيل الإشعارات
 * نافذة إرشادية أنيقة تعمل على كل الأنظمة (أندرويد / آيفون / حاسوب)
 */
import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { BadgeCheck, Bell, Chrome, MonitorSmartphone, Share, Smartphone, SquarePlus } from "lucide-react";
import { toast } from "sonner";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

let deferredPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
}

export default function InstallGuide() {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const installNow = async () => {
    if (!deferredPrompt) {
      toast.info(t("install.manualHint"));
      return;
    }
    setBusy(true);
    try {
      await deferredPrompt.prompt();
      deferredPrompt = null;
      toast.success(t("install.doneToast"));
      setOpen(false);
    } catch {
      toast.info(t("install.manualHint"));
    }
    setBusy(false);
  };

  const enableNotifs = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") toast.success(t("header.pushOn"));
      else toast.error(t("install.notifDenied"));
    } catch {
      toast.error(t("install.notifDenied"));
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={t("install.title")}
        title={t("install.title")}
        className="hidden min-[430px]:inline-flex h-9 w-9 shrink-0 rounded-full border-primary/25 bg-gradient-to-br from-primary/10 to-accent/15 shadow-sm hover:from-primary/20 hover:to-accent/25 hover:shadow transition-all"
      >
        <MonitorSmartphone className="h-5 w-5 text-primary" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[88dvh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-start flex items-center gap-2">
              <MonitorSmartphone className="h-5 w-5 text-primary" />
              {t("install.title")}
            </DialogTitle>
            <DialogDescription className="text-start leading-relaxed">
              {t("install.sub")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* زر التثبيت المباشر إن توفر */}
            <Button onClick={installNow} disabled={busy} className="w-full h-12 rounded-xl gap-2 text-base">
              <Smartphone className="h-5 w-5" />
              {t("install.now")}
            </Button>

            {/* أندرويد / كروم */}
            <div className="rounded-2xl border bg-card p-4 space-y-2">
              <p className="font-bold text-sm flex items-center gap-2">
                <Chrome className="h-4 w-4 text-primary" /> Android / Chrome
              </p>
              <ol className="text-[13px] text-muted-foreground leading-relaxed list-decimal ms-5 space-y-1">
                <li>{t("install.android1")}</li>
                <li>{t("install.android2")}</li>
                <li>{t("install.android3")}</li>
              </ol>
            </div>

            {/* آيفون */}
            <div className="rounded-2xl border bg-card p-4 space-y-2">
              <p className="font-bold text-sm flex items-center gap-2">
                <Share className="h-4 w-4 text-primary" /> iPhone / iPad (Safari)
              </p>
              <ol className="text-[13px] text-muted-foreground leading-relaxed list-decimal ms-5 space-y-1">
                <li>{t("install.ios1")}</li>
                <li>{t("install.ios2")}</li>
                <li>{t("install.ios3")}</li>
              </ol>
            </div>

            {/* الحاسوب */}
            <div className="rounded-2xl border bg-card p-4 space-y-2">
              <p className="font-bold text-sm flex items-center gap-2">
                <SquarePlus className="h-4 w-4 text-primary" /> {t("install.desktopTitle")}
              </p>
              <ol className="text-[13px] text-muted-foreground leading-relaxed list-decimal ms-5 space-y-1">
                <li>{t("install.desktop1")}</li>
                <li>{t("install.desktop2")}</li>
              </ol>
            </div>

            {/* الإشعارات */}
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3">
              <p className="font-bold text-sm flex items-center gap-2 text-primary">
                <Bell className="h-4 w-4" /> {t("install.notifsTitle")}
              </p>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{t("install.notifsSub")}</p>
              <Button variant="outline" onClick={enableNotifs} className="w-full rounded-xl gap-2">
                <BadgeCheck className="h-4 w-4" /> {t("header.enablePush")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

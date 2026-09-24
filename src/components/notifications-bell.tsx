"use client";
/**
 * جرس الإشعارات — قائمة الإشعارات الداخلية (تُعرض بلغة المستخدم) + تفعيل إشعارات الجهاز
 * كل إشعار يحمل نصوصه بثلاث لغات — الواجهة تختار لغة المستخدم الحالية
 * ★ الضغط على الإشعار ينقل المستخدم مباشرة إلى موضع الإشعار (نمط طمأنينة):
 *   موعد → المواعيد، طلب استعادة → الحسابات، رد على تعليق → الإعلانات…
 *   الوجهة تخضع لصلاحيات المستخدم: صفحة غير متاحة لدوره → يبقى مكانه
 * ★ v3.6: زر «تعيين الكل كمقروء» + زر «حذف الكل» (بتأكيد نقرتين)
 *   + خريطة توجيه مكتملة لكل أنواع الإشعارات (courses/like/comment/ebook…)
 */
import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, CheckCheck, MonitorSmartphone, Trash2 } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { enablePushNotifications } from "@/lib/enable-push";
import { NAV_ITEMS, type Role, type ViewKey } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { localeOf } from "@/components/tri-input";

type TriMap = { ar?: string; fr?: string; en?: string; tr?: string; es?: string };
type Notif = {
  _id: string;
  title: string;
  body: string;
  titles?: TriMap;
  bodies?: TriMap;
  kind?: string;
  link?: string;
  read: boolean;
  createdAt: string;
};

export default function NotificationsBell() {
  const { t, me, lang, dir, navigate } = useApp();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  /* v3.6: تأكيد نقرتين لحذف كل الإشعارات */
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (!me) return;
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setItems(j.notifications || []);
        setUnread(j.unread || 0);
      }
    } catch {}
  }, [me]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const markAll = async () => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    load();
  };

  /* v3.6: حذف كل الإشعارات — نقرتان للتأكيد، ثم مسح كامل */
  const deleteAll = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setConfirmDelete(false);
    const r = await fetch("/api/notifications", { method: "DELETE" });
    if (r.ok) {
      toast.success(t("header.allDeleted"));
      load();
    } else toast.error(t("common.error"));
  };

  const markOne = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {}
    load();
  };

  /* ─── الضغط على الإشعار يفتح مقصده مباشرة (نمط طمأنينة) ───
     link = "view" أو "view:id" — يُراجَع ضد صلاحيات دور المستخدم أولاً
     ★ v3.6: خريطة مكتملة لكل أنواع الإشعارات الفعلية في المنصة —
     الإشعارات القديمة بلا رابط تُوجّه حسب نوعها: منحدرات منسية
     (courses/like/comment) كانت تبقى بلا توجيه، و ebook يذهب الآن
     لصفحة الكتب حيث تُعرض إجابات العملاء فعلياً */
  const KIND_LINK: Record<string, string> = {
    reminder_day: "appointments",
    reminder_hour: "appointments",
    booking: "appointments",
    status: "appointments",
    account: "accounts",
    reset: "accounts",
    ads: "ads",
    ad: "ads",
    /* تعليقات وإعجابات الإعلانات → صفحة الإعلانات (كانت بلا توجيه) */
    like: "ads",
    comment: "ads",
    /* تسجيل في تكوين → صفحة التكوينات (كانت بلا توجيه) */
    courses: "courses",
    course: "courses",
    /* إجابة عميل على كتاب → صفحة الكتب الإلكترونية حيث تُعرض الإجابات */
    ebook: "ebooks",
    feedback: "feedback",
    welcome: "home",
  };

  const openTarget = (n: Notif) => {
    const link = String(n.link || KIND_LINK[n.kind || ""] || "");
    const [rawView, rawId] = link.split(":");
    const view = rawView as ViewKey;
    let go: { view: ViewKey; id?: string } | null = null;

    if (view === "login") {
      /* إشعار معالجة كلمة المرور → بوابة الدخول المناسبة (أو الرئيسية إن كان مسجلاً) */
      const as = rawId === "specialist" || rawId === "admin" ? rawId : "client";
      go = me ? { view: "home" } : { view: "login", id: as };
    } else if (view === "home") {
      go = { view: "home" };
    } else if (view && me) {
      const item = NAV_ITEMS.find((i) => i.key === view);
      if (item && item.roles.includes(me.role as Role)) {
        go = { view, id: rawId || undefined };
      }
    }
    setOpen(false);
    if (go) navigate(go.view, go.id);
    markOne(n._id);
  };

  const enablePush = () => enablePushNotifications(t("header.pushOn"));

  if (!me) return null;

  /* النص بلغة المستخدم — سقوط تلقائي إلى العربية */
  const pick = (map: TriMap | undefined, fallback: string) =>
    (map && (map[lang] || map.ar || map.fr || map.en || map.tr || map.es)) || fallback;

  const locale = localeOf(lang);

  return (
    <DropdownMenu open={open} onOpenChange={(v) => { setOpen(v); setConfirmDelete(false); if (v) load(); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label={t("header.notifications")}>
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -end-0.5">
              <Badge className="h-5 min-w-5 rounded-full px-1 text-[10px] tabular-nums bg-destructive hover:bg-destructive justify-center">
                {unread > 9 ? "9+" : unread}
              </Badge>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-bold text-sm flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            {t("header.notifications")}
          </p>
          {/* v3.6: تعيين الكل كمقروء + حذف الكل — الزرين معاً دائماً */}
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={markAll} className="text-xs h-7 gap-1 text-primary">
                <CheckCheck className="h-3.5 w-3.5" />
                {t("header.markAllRead")}
              </Button>
            )}
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteAll}
                className={"text-xs h-7 gap-1 " + (confirmDelete ? "bg-destructive text-white hover:bg-destructive" : "text-destructive hover:bg-destructive/10")}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmDelete ? t("header.confirmDeleteAll") : t("header.deleteAll")}
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("header.noNotifications")}</p>
          ) : (
            items.map((n) => (
              <button
                key={n._id}
                type="button"
                onClick={() => openTarget(n)}
                dir={dir}
                className={
                  "w-full text-start px-4 py-3 transition-colors hover:bg-muted/50 " +
                  (n.read ? "opacity-60" : "bg-primary/5")
                }
              >
                <span className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0 animate-pulse" aria-hidden="true" />}
                  <span className="min-w-0 flex-1 block">
                    <span className="block font-semibold text-sm break-words">{pick(n.titles, n.title)}</span>
                    <span className="block text-sm text-muted-foreground leading-relaxed break-words">{pick(n.bodies, n.body)}</span>
                    <span className="block mt-1 text-[11px] text-muted-foreground/70">
                      {new Date(n.createdAt).toLocaleString(locale)}
                    </span>
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="border-t p-3">
          <Button variant="outline" size="sm" onClick={enablePush} className="w-full gap-2">
            <MonitorSmartphone className="h-4 w-4" />
            {t("header.enablePush")}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

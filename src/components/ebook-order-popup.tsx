"use client";
/**
 * نافذة طلبات شراء الكتب للإدارة (v3.20) — طلب صاحب المركز:
 * «يصل الطلب في حساب الأدمين مع اشعار و نافذة تظهر بكل تفاصيل الطلب مرفقة بصوت بسيط
 *  مباشرة بعد الدخول لحساب الأدمين واذا كان مسجل الدخول تظهر مباشرة فوق أي صفحة أو نافذة
 *  مفتوحة مع زر تخطي الآن و زر قبول الطلب»
 *
 * - استطلاع دوري (كل 25 ثانية) لطلبات pending — تظهر فوراً عند أول طلب بعد الدخول
 *   أو لحظة وصول طلب جديد أثناء التصفح — فوق كل نوافذ التطبيق (z-[650])
 * - صوت بسيط (WebAudio نغمتان) مع كل ظهور — لا يزعج ولا يتكرر لنفس الطلب
 * - «تخطي الآن»: يؤجل هذا الطلب لبقية الجلسة (يبقى في صفحة الطلبات والجرس)
 * - «قبول الطلب»: يقبل خادمياً + إشعار موجّه للعميل بالتواصل عبر واتساب
 * - بعد القبول أو التخطي: الطلب الموالي المعلق يظهر تباعاً — طلب طلب
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import FullImage from "@/components/full-image";
import { BookOpenText, Clock3, Phone, ShoppingBag, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { playOrderChime } from "@/lib/chime";

type Order = {
  _id: string;
  ebookId: string;
  price: number;
  status: string;
  createdAt: string;
  book: { title: string; coverBase64?: string; price?: number } | null;
  client: { name: string; phone: string } | null;
};

const SKIP_KEY = "ait_ord_skipped";

/** معرفات الطلبات المؤجلة لهذه الجلسة — تنزول بإغلاق التبويب (ولوج جديد = عودة النافذة) */
function skipped(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SKIP_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

export default function EbookOrderPopup() {
  const { t, me } = useApp();
  const isStaff = me?.role === "admin" || me?.role === "assistant";
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const announced = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    if (!isStaff) return;
    try {
      const r = await fetch("/api/ebook-orders?status=pending", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      const list = (j.orders || []) as Order[];
      const sk = skipped();
      /* أقدم طلب معلق غير مؤجل — يُعرض الآن؛ الجديد (غير المعلن) يصدر نغمته دائماً */
      const next = list.find((o) => !sk.has(o._id)) || null;
      for (const o of list) {
        if (!announced.current.has(o._id)) {
          announced.current.add(o._id);
          if (!sk.has(o._id)) playOrderChime();
        }
      }
      setOrder(next);
    } catch {}
  }, [isStaff]);

  useEffect(() => {
    if (!isStaff) { setOrder(null); return; }
    poll();
    const iv = setInterval(poll, 25_000);
    return () => clearInterval(iv);
  }, [isStaff, poll]);

  if (!isStaff || !order) return null;

  const skip = () => {
    try {
      const s = skipped();
      s.add(order._id);
      sessionStorage.setItem(SKIP_KEY, JSON.stringify([...s]));
    } catch {}
    setOrder(null);
    poll();
  };

  const accept = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/ebook-orders/${order._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (r.ok) {
        toast.success(t("ord.acceptedToast"), { duration: 6000 });
        announced.current.add(order._id);
        setOrder(null);
        poll();
      } else {
        const j = await r.json().catch(() => null);
        toast.error(j?.error || t("common.error"));
      }
    } catch {
      toast.error(t("err.conn"));
    }
    setBusy(false);
  };

  const when = (() => {
    try {
      const mins = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
      if (mins < 1) return t("sp.justNow");
      if (mins < 60) return t("sp.minsAgo", { n: mins });
      const h = Math.floor(mins / 60);
      if (h < 24) return t("sp.hoursAgo", { n: h });
      return new Date(order.createdAt).toLocaleDateString();
    } catch {
      return "";
    }
  })();

  return (
    /* z-[650]: فوق نوافذ الإدارة (z-600) وتحت نافذة إكمال Google (لا تلتقيان أصلاً) */
    <div className="fixed inset-0 z-[650] flex items-end justify-center bg-foreground/40 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-label={t("ord.popupTitle")}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl border bg-card shadow-2xl">
        {/* رأس ملون */}
        <div className="bg-gradient-to-r from-primary to-primary/85 p-4 text-primary-foreground">
          <div className="flex items-start justify-between gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
              <ShoppingBag className="h-5.5 w-5.5" />
            </span>
            <button type="button" onClick={skip} aria-label={t("ord.skipNow")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-base font-black leading-snug">{t("ord.popupTitle")}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs opacity-90">
            <Clock3 className="h-3.5 w-3.5" /> {when}
          </p>
        </div>

        <div className="space-y-4 p-5">
          {/* الكتاب */}
          <div className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-3">
            <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
              {order.book?.coverBase64 ? (
                <FullImage src={order.book.coverBase64} alt={order.book.title} className="h-16 w-12" />
              ) : (
                <span className="flex h-full w-full items-center justify-center"><BookOpenText className="h-6 w-6 text-primary/50" /></span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="break-words whitespace-normal text-sm font-black leading-snug">{order.book?.title || "—"}</p>
              <Badge className="mt-1 bg-amber-100 text-amber-800 border-0 hover:bg-amber-100">
                {order.price} {t("eb.dzd")}
              </Badge>
            </div>
          </div>

          {/* العميل */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-background p-3 text-sm">
            <span className="flex items-center gap-1.5 font-bold min-w-0">
              <UserRound className="h-4 w-4 shrink-0 text-primary" />
              <span className="break-words whitespace-normal">{order.client?.name || "—"}</span>
            </span>
            {order.client?.phone && (
              <span dir="ltr" className="ms-auto flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-bold tracking-wider">
                <Phone className="h-3.5 w-3.5" /> {order.client.phone}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            <Button variant="outline" onClick={skip} disabled={busy} className="h-12 rounded-xl text-sm font-bold">
              {t("ord.skipNow")}
            </Button>
            <Button onClick={accept} disabled={busy} className="h-12 rounded-xl text-sm font-bold shadow-md shadow-primary/20">
              {busy ? t("common.saving") : t("ord.accept")}
            </Button>
          </div>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">{t("ord.acceptHint")}</p>
        </div>
      </div>
    </div>
  );
}

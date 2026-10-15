"use client";
/**
 * طلبات شراء الكتب الإلكترونية — صفحة الإدارة والمساعد (v3.20)
 * «وصل الطلب في حساب الأدمين» — هنا يجد كل الطلبات حتى المؤجلة من النافذة المنبثقة:
 *  قبول (إشعار للعميل بالتواصل عبر واتساب) → تأكيد الدفع والتفعيل (يفتح الكتاب للعميل)
 *  والإدارة وحدها تلغي الطلب المكرر/المشوه — كل شيء خادمي محمي وموثق في سجل التدقيق
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { CardsSkeleton } from "@/components/brand-skeleton";
import FullImage from "@/components/full-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BookOpenText, Check, CircleAlert, Clock3, Phone, ShoppingBag, Trash2, UserRound, Wallet } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppGlyph } from "@/components/whatsapp-button";
import { cn } from "@/lib/utils";

type Order = {
  _id: string;
  ebookId: string;
  price: number;
  status: "pending" | "accepted" | "paid";
  createdAt: string;
  acceptedAt?: string | null;
  paidAt?: string | null;
  book: { _id: string; title: string; coverBase64?: string; price: number } | null;
  client: { name: string; phone: string } | null;
};

type Filter = "all" | "pending" | "accepted" | "paid";

export default function EbookOrders({ navigate }: { navigate: (v: "ebooks", id?: string) => void }) {
  const { t, me, settings } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState("");
  const [delId, setDelId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/ebook-orders", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setOrders(j.orders || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (o: Order, action: "accept" | "paid") => {
    setBusy(o._id + action);
    try {
      const r = await fetch(`/api/ebook-orders/${o._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (r.ok) {
        toast.success(action === "accept" ? t("ord.acceptedToast") : t("ord.paidToast"), { duration: 6000 });
        load();
      } else {
        const j = await r.json().catch(() => null);
        toast.error(j?.error || t("common.error"));
      }
    } catch {
      toast.error(t("err.conn"));
    }
    setBusy("");
  };

  const del = async () => {
    if (!delId) return;
    const r = await fetch(`/api/ebook-orders/${delId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
    if (r.ok) { toast.success(t("ord.cancelledToast")); setDelId(null); load(); }
    else toast.error(t("common.error"));
  };

  const isAdmin = me?.role === "admin";
  const counts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    accepted: orders.filter((o) => o.status === "accepted").length,
    paid: orders.filter((o) => o.status === "paid").length,
  };
  const shown = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const waNum = (settings?.whatsapp || settings?.phone || "").replace(/[^\d]/g, "");
  const waHref = (o: Order) =>
    `https://wa.me/${waNum}?text=${encodeURIComponent(`${t("ord.waMsg")} «${o.book?.title || ""}» — ${o.price} ${t("eb.dzd")}`)}`;

  const statusBadge = (s: Order["status"]) =>
    s === "pending" ? (
      <Badge className="gap-1 border-0 bg-amber-100 text-amber-800 hover:bg-amber-100"><Clock3 className="h-3 w-3" /> {t("ord.stPending")}</Badge>
    ) : s === "accepted" ? (
      <Badge className="gap-1 border-0 bg-sky-100 text-sky-800 hover:bg-sky-100"><CircleAlert className="h-3 w-3" /> {t("ord.stAccepted")}</Badge>
    ) : (
      <Badge className="gap-1 border-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><Check className="h-3 w-3" /> {t("ord.stPaid")}</Badge>
    );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <BackButton onBack={() => navigate("home")} />
          <h1 className="text-xl sm:text-2xl font-black">{t("nav.orders")}</h1>
        </div>
        <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1.5">
          <ShoppingBag className="h-3.5 w-3.5" /> {counts.pending} {t("ord.pendingCount")}
        </Badge>
      </div>

      {/* مرشحات الحالة */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "pending", "accepted", "paid"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors",
              filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
            )}
          >
            {f === "all" ? t("ord.all") : f === "pending" ? t("ord.stPending") : f === "accepted" ? t("ord.stAccepted") : t("ord.stPaid")}
            <span className="ms-1.5 opacity-70">({counts[f]})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <CardsSkeleton count={3} />
      ) : shown.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-14 text-center text-muted-foreground">{t("ord.none")}</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((o) => (
            <Card key={o._id} className="overflow-hidden rounded-2xl">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                {/* غلاف الكتاب */}
                <button
                  type="button"
                  onClick={() => o.book && navigate("ebooks", o.book._id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-start"
                  title={t("ord.openBook")}
                >
                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {o.book?.coverBase64 ? (
                      <FullImage src={o.book.coverBase64} alt={o.book.title} className="h-16 w-12" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center"><BookOpenText className="h-6 w-6 text-primary/50" /></span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="break-words whitespace-normal text-sm font-black leading-snug hover:text-primary">{o.book?.title || "—"}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-bold"><UserRound className="h-3.5 w-3.5" /> {o.client?.name || "—"}</span>
                      {o.client?.phone && <span dir="ltr" className="flex items-center gap-1 tracking-wider"><Phone className="h-3 w-3" />{o.client.phone}</span>}
                      <span className="font-bold text-primary">{o.price} {t("eb.dzd")}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                      {new Date(o.createdAt).toLocaleString()} {o.paidAt ? `· ${t("ord.paidAt")} ${new Date(o.paidAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                </button>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {statusBadge(o.status)}
                  {o.status === "pending" && (
                    <Button size="sm" onClick={() => act(o, "accept")} disabled={busy === o._id + "accept"} className="gap-1.5 rounded-xl text-xs">
                      <Check className="h-3.5 w-3.5" /> {t("ord.accept")}
                    </Button>
                  )}
                  {o.status !== "paid" && (
                    <Button size="sm" variant="outline" onClick={() => act(o, "paid")} disabled={busy === o._id + "paid"} className="gap-1.5 rounded-xl text-xs">
                      <Wallet className="h-3.5 w-3.5" /> {t("ord.markPaid")}
                    </Button>
                  )}
                  {o.status === "accepted" && waNum && (
                    <a href={waHref(o)} target="_blank" rel="noopener noreferrer"
                      className="flex h-8 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-xs font-bold text-white transition-transform hover:scale-[1.03]" dir="ltr">
                      <WhatsAppGlyph className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  )}
                  {isAdmin && o.status !== "paid" && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDelId(o._id)} aria-label={t("common.delete")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ord.cancelConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("ord.cancelHint")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={del}>{t("common.yes")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

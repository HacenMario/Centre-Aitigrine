"use client";
/**
 * نافذة التقييمات — نمط طمأنينة:
 * • عرض متوسط النجوم + التوزيع + آخر التقييمات (للجميع)
 * • العميل الذي أتمّ جلسة مع الأخصائي يمكنه التقييم (1-5 نجوم + تعليق)
 * تُفتح من بطاقات الأخصائيين ومن مواعيدي بعد انتهاء الجلسة
 */
import { useCallback, useEffect, useState } from "react";
import { Star, Sparkles, MessageSquareQuote } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { localeOf } from "@/components/tri-input";

const STARS = [1, 2, 3, 4, 5];

export function StarsRow({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" dir="ltr" aria-label={`${value}/5`}>
      {STARS.map((s) => (
        <Star
          key={s}
          className={cn(size, s <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
        />
      ))}
    </span>
  );
}

type RatingsData = {
  avg: number;
  count: number;
  distribution: { stars: number; count: number }[];
  items: { _id: string; stars: number; comment: string; clientName: string; createdAt: string }[];
  myRating: { stars: number; comment: string } | null;
  canRate: boolean;
};

export default function RatingsDialog({
  specialistId,
  specialistName,
  open,
  onOpenChange,
}: {
  specialistId: string;
  specialistName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t, me, lang } = useApp();
  const [data, setData] = useState<RatingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!specialistId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ specialistId });
      if (me?._id) qs.set("viewerId", me._id);
      const r = await fetch(`/api/ratings?${qs.toString()}`, { cache: "no-store" });
      if (r.ok) {
        const d: RatingsData = await r.json();
        setData(d);
        if (d.myRating) {
          setStars(d.myRating.stars);
          setComment(d.myRating.comment || "");
        }
      }
    } catch {}
    setLoading(false);
  }, [specialistId, me?._id]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const submit = async () => {
    if (!stars) {
      toast.error(t("rate.pickStars"));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialistId, stars, comment }),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success(j.updated ? t("rate.updated") : t("rate.thanks"));
        load();
      } else toast.error(j.error || t("common.error"));
    } catch {
      toast.error(t("err.conn"));
    }
    setBusy(false);
  };

  const locale = localeOf(lang);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-start">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            </span>
            {t("rate.title")} — {specialistName}
          </DialogTitle>
          <DialogDescription className="text-start">{t("rate.sub")}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* الملخص */}
            <div className="ait-rate-summary flex items-center gap-4 rounded-2xl border bg-card p-4">
              <div className="text-center">
                <p className="text-3xl font-black text-foreground" dir="ltr">
                  {data?.avg ? data.avg.toFixed(1) : "—"}
                </p>
                <StarsRow value={data?.avg || 0} />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {data?.count || 0} {t("rate.votes")}
                </p>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                {(data?.distribution || []).map((d) => (
                  <div key={d.stars} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="w-3 text-end" dir="ltr">{d.stars}</span>
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all"
                        style={{ width: `${data?.count ? (d.count / data.count) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-5 tabular-nums">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* نموذج التقييم — للعميل الذي أتمّ جلسة */}
            {data?.canRate ? (
              <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
                <p className="text-sm font-black flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {data.myRating ? t("rate.editYours") : t("rate.yours")}
                </p>
                <div className="flex items-center justify-center gap-1" dir="ltr" role="radiogroup" aria-label={t("rate.yours")}>
                  {STARS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStars(s)}
                      onMouseEnter={() => setHover(s)}
                      onMouseLeave={() => setHover(0)}
                      className="rounded-full p-1 transition-transform hover:scale-125"
                      aria-label={`${s} ★`}
                    >
                      <Star
                        className={cn(
                          "h-8 w-8 transition-colors",
                          s <= (hover || stars) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/35"
                        )}
                      />
                    </button>
                  ))}
                </div>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  maxLength={600}
                  placeholder={t("rate.commentPlaceholder")}
                />
                <Button onClick={submit} disabled={busy} className="w-full rounded-xl">
                  {busy ? t("common.saving") : data.myRating ? t("rate.updateBtn") : t("rate.sendBtn")}
                </Button>
              </div>
            ) : me?.role === "client" ? (
              <p className="rounded-xl bg-muted/60 p-3 text-center text-xs leading-relaxed text-muted-foreground">
                {t("rate.needSession")}
              </p>
            ) : null}

            {/* آخر التقييمات */}
            {(data?.items?.length || 0) > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-black flex items-center gap-1.5">
                  <MessageSquareQuote className="h-4 w-4 text-primary" />
                  {t("rate.latest")}
                </p>
                <div className="ait-rate-list max-h-52 space-y-2 overflow-y-auto pe-1">
                  {data!.items.map((it) => (
                    <div key={it._id} className="rounded-xl border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold truncate">{it.clientName}</p>
                        <StarsRow value={it.stars} size="h-3.5 w-3.5" />
                      </div>
                      {it.comment && (
                        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{it.comment}</p>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground/70">
                        {new Date(it.createdAt).toLocaleDateString(locale)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(data?.count || 0) === 0 && !data?.canRate && (
              <p className="rounded-xl bg-muted/60 p-4 text-center text-sm text-muted-foreground">
                {t("rate.empty")}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

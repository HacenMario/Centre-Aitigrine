"use client";
/**
 * الإعلانات (اعلانات) — نمط طمأنينة v1.15 مكيَّف لمركز آيت تقرين
 * صفحة عمومية: الإعلانات المنشورة بسلايدر وسائط (5 صور + فيديو) + إعجاب + تعليق
 * الإدارة: تصيغ الإعلانات وتنشرها/تؤرشفها وتحذفها، ترد على التعليقات وتحجبها
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { PageSkeleton } from "@/components/brand-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Megaphone, SearchX, Heart, MessageCircle, RefreshCw, ChevronLeft, ChevronRight, Plus,
  Pencil, Trash2, Power, Eye, EyeOff, Reply, Loader2, Send, Images, Megaphone as MegaphoneIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/client-api";
import { MediaPicker } from "@/components/media-input";
import ShareButtons from "@/components/share-buttons";
import FullImage from "@/components/full-image";
import Pagination from "@/components/pagination";
import type { Navigate } from "@/lib/nav";

const ADS_PAGE_SIZE = 8;

type PublicComment = {
  name: string;
  text: string;
  reply: { text: string | null; at: string | null } | null;
  createdAt: string | null;
};
type AdItem = {
  id: string;
  title: string;
  body: string;
  media: string[];
  publishedAt: string;
  likesCount: number;
  likedByMe: boolean;
  commentsCount: number;
  comments: PublicComment[];
};
type StaffAd = {
  _id: string;
  title: string;
  body: string;
  media: string[];
  float: boolean;
  floatPerUser: number;
  floatDays: number;
  status: string;
  views: number;
  likesCount: number;
  commentsCount: number;
  comments: { id: string; name: string; text: string; hidden: boolean; reply: { text: string | null; at: string | null } | null; createdAt: string | null }[];
  createdAt: string;
};

function isVideo(url: string) {
  return url.startsWith("data:video/") || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

/* ─────────── سلايدر وسائط الإعلان ─────────── */
function AdMediaCarousel({ media, title }: { media: string[]; title: string }) {
  const [idx, setIdx] = useState(0);
  const touchX = useRef<number | null>(null);
  if (!media.length) return null;
  const next = () => setIdx((i) => (i + 1) % media.length);
  const prev = () => setIdx((i) => (i - 1 + media.length) % media.length);
  return (
    <div
      className="relative overflow-hidden rounded-2xl border bg-muted/30 select-none"
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const sx = touchX.current;
        touchX.current = null;
        if (sx === null) return;
        const dx = (e.changedTouches[0]?.clientX ?? 0) - sx;
        if (Math.abs(dx) < 50) return;
        if (dx < 0) next();
        else prev();
      }}
    >
      {isVideo(media[idx]) ? (
        <video src={media[idx]} controls className="max-h-[60dvh] w-full bg-black object-contain" />
      ) : (
        /* ارتفاع ثابت: الصورة تظهر كاملة (object-contain) دون قصّ */
        <FullImage src={media[idx]} alt={title} className="h-[60dvh] w-full" />
      )}
      {media.length > 1 && (
        <>
          <button type="button" onClick={prev} aria-label="prev"
            className="absolute start-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-md hover:bg-background">
            <ChevronRight className="h-4.5 w-4.5 rtl:-scale-x-100" />
          </button>
          <button type="button" onClick={next} aria-label="next"
            className="absolute end-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-md hover:bg-background">
            <ChevronLeft className="h-4.5 w-4.5 rtl:-scale-x-100" />
          </button>
          <div className="absolute bottom-2 start-1/2 flex -translate-x-1/2 gap-1 rtl:translate-x-1/2">
            {media.map((_, i) => (
              <span key={i} className={cn("h-1.5 w-1.5 rounded-full transition-all", i === idx ? "w-4 bg-primary" : "bg-foreground/30")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Ads({ navigate }: { navigate: Navigate }) {
  const { t, me, viewId } = useApp();
  const isStaff = me?.role === "admin" || me?.role === "assistant";
  const canReact = !!me && ["client", "specialist"].includes(me.role);

  const [ads, setAds] = useState<AdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentOpen, setCommentOpen] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  /* ترقيم الصفحات الاحترافي */
  const [page, setPage] = useState(1);

  /* لوحة الإدارة */
  const [staffAds, setStaffAds] = useState<StaffAd[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<{ adId: string; idx: number; name: string } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [showManage, setShowManage] = useState(true);

  const loadPublic = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const qs = new URLSearchParams({ pageSize: "20" });
      if (me?._id) qs.set("viewerId", me._id);
      const r = await fetch(`/api/ads?${qs.toString()}`, { cache: "no-store" });
      const j = await r.json();
      setAds(j.ads || []);
    } catch {
      setAds([]);
    }
    setLoading(false);
  }, [me?._id]);

  const loadStaff = useCallback(async () => {
    if (!isStaff) return;
    setStaffLoading(true);
    try {
      const r = await fetch("/api/ads?staff=1&pageSize=50", { cache: "no-store" });
      const j = await r.json();
      setStaffAds(j.ads || []);
    } catch {
      setStaffAds([]);
    }
    setStaffLoading(false);
  }, [isStaff]);

  useEffect(() => {
    loadPublic();
    loadStaff();
  }, [loadPublic, loadStaff]);

  /* ★ v3.21: الرابط المنشور يوجه مباشرة إلى الإعلان نفسه — ?view=ads&id=…
     تمرير سلس + إبراز مؤقت (الإعلان كله معروض في البطاقة أصلًا) */
  const deepDone = useRef(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  useEffect(() => {
    if (!viewId || deepDone.current || loading) return;
    if (!ads.some((a) => a.id === viewId)) return;
    deepDone.current = true;
    document
      .querySelector(`[data-ad-id="${viewId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlight(viewId);
    const tm = setTimeout(() => setHighlight(null), 3200);
    return () => clearTimeout(tm);
  }, [viewId, ads, loading]);

  /* تسجيل مشاهدة أول إعلان — مرة واحدة لكل إعلان في الجلسة */
  const viewedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const a of ads) {
      if (viewedRef.current.has(a.id)) continue;
      viewedRef.current.add(a.id);
      void fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "view", id: a.id }),
      }).catch(() => {});
    }
  }, [ads]);

  const toggleLike = async (adId: string) => {
    if (!canReact) {
      toast.info(t("ads.loginToReact"));
      navigate("login");
      return;
    }
    setBusy(adId);
    try {
      const r = await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-auth-token": getToken() || "" },
        body: JSON.stringify({ action: "like", id: adId }),
      });
      const data = await r.json();
      if (r.ok && data.ok !== false) {
        setAds((prev) => prev.map((a) => (a.id === adId ? { ...a, likedByMe: data.likedByMe, likesCount: data.likesCount } : a)));
      } else toast.error(data.error || t("common.error"));
    } finally {
      setBusy(null);
    }
  };

  const submitComment = async (adId: string) => {
    if (!canReact) {
      toast.info(t("ads.loginToReact"));
      navigate("login");
      return;
    }
    const text = commentText.trim();
    if (!text) return;
    setBusy(adId);
    try {
      const r = await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-auth-token": getToken() || "" },
        body: JSON.stringify({ action: "comment", id: adId, text }),
      });
      const j = await r.json();
      if (r.ok) {
        setCommentText("");
        setCommentOpen(null);
        loadPublic(true);
        toast.success(t("ads.commentSent"));
      } else toast.error(j.error || t("common.error"));
    } finally {
      setBusy(null);
    }
  };

  const staffAction = async (payload: Record<string, unknown>, okMsg?: string) => {
    const r = await fetch("/api/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      if (okMsg) toast.success(okMsg);
      loadStaff();
      loadPublic(true);
      return true;
    }
    toast.error(j.error || t("common.error"));
    return false;
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <BackButton onBack={() => navigate("home")} />
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-black">
            <Megaphone className="h-6 w-6 text-primary" />
            {t("nav.ads")}
          </h1>
        </div>
        {isStaff && (
          <div className="flex items-center gap-2">
            <Button onClick={() => setEditing({ float: false, floatPerUser: 3, floatDays: 7, media: [] })} className="gap-2 rounded-xl shadow-md shadow-primary/20">
              <Plus className="h-4.5 w-4.5" /> {t("ads.newAd")}
            </Button>
          </div>
        )}
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{t("ads.desc")}</p>

      {/* ── لوحة إدارة الإعلانات (للإدارة) ── */}
      {isStaff && showManage && (
        <Card className="rounded-3xl border-primary/20">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <button type="button" onClick={() => setShowManage(false)} className="flex w-full items-center justify-between gap-2 text-start">
              <span className="flex items-center gap-2 text-sm font-black">
                <MegaphoneIcon className="h-4.5 w-4.5 text-primary" />
                {t("ads.manageTitle")}
                <Badge variant="secondary">{staffAds.length}</Badge>
              </span>
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            </button>
            {staffLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : staffAds.length === 0 ? (
              <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">{t("ads.noAds")}</p>
            ) : (
              <div className="grid gap-2.5">
                {staffAds.map((a) => (
                  <div key={a._id} className="rounded-2xl border bg-muted/20 p-3.5 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 break-words text-sm font-bold">{a.title}</span>
                      <Badge variant={a.status === "PUBLISHED" ? "default" : a.status === "DRAFT" ? "secondary" : "outline"} className="text-[10px]">
                        {t(a.status === "PUBLISHED" ? "ads.published" : a.status === "DRAFT" ? "ads.draft" : "ads.archived")}
                      </Badge>
                      {a.float && <Badge variant="outline" className="text-[10px] text-primary">{t("ads.floatBadge")}</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{a.views}</span>
                      <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{a.likesCount}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{a.commentsCount}</span>
                      <span>{fmtDate(a.createdAt)}</span>
                    </div>
                    {/* التعليقات */}
                    {a.comments.length > 0 && (
                      <div className="space-y-1.5 rounded-xl bg-background/70 p-2">
                        {a.comments.map((c) => (
                          <div key={c.id} className={cn("rounded-lg px-2.5 py-1.5 space-y-1", c.hidden && "opacity-50")}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-black">{c.name}</p>
                              <div className="flex items-center gap-1">
                                <button type="button" title={t(c.hidden ? "ads.unhide" : "ads.hideComment")}
                                  onClick={() => staffAction({ action: "comment-hide", id: a._id, commentIndex: Number(c.id), hidden: !c.hidden })}
                                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                                  {c.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                </button>
                                {!c.reply && (
                                  <button type="button" title={t("ads.reply")}
                                    onClick={() => { setReplyFor({ adId: a._id, idx: Number(c.id), name: c.name }); setReplyText(""); }}
                                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-primary">
                                    <Reply className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground" dir="auto">{c.text}</p>
                            {c.reply?.text && (
                              <div className="rounded-lg border border-primary/20 bg-primary/5 px-2 py-1">
                                <p className="text-[10px] font-black text-primary">{t("ads.centerReply")}</p>
                                <p className="text-xs font-semibold" dir="auto">{c.reply.text}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => setEditing({ ...a, media: a.media || [] })}>
                        <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
                      </Button>
                      {a.status !== "PUBLISHED" ? (
                        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-emerald-600" onClick={() => staffAction({ action: "publish", id: a._id }, t("ads.publishDone"))}>
                          <Power className="h-3.5 w-3.5" /> {t("ads.publish")}
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-amber-600" onClick={() => staffAction({ action: "archive", id: a._id }, t("ads.archiveDone"))}>
                          <Power className="h-3.5 w-3.5" /> {t("ads.archive")}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="ms-auto h-8 gap-1.5 text-xs text-destructive" onClick={() => setDelId(a._id)}>
                        <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {isStaff && !showManage && (
        <button type="button" onClick={() => setShowManage(true)} className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5">
          <MegaphoneIcon className="h-4 w-4" /> {t("ads.manageTitle")} ({staffAds.length})
        </button>
      )}

      {/* ── الإعلانات المنشورة ── */}
      {loading ? (
        <PageSkeleton kind="cards" count={6} label={t("common.loading")} />
      ) : ads.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="space-y-3 py-14 text-center text-muted-foreground">
            <SearchX className="mx-auto h-10 w-10 opacity-40" />
            <p className="font-semibold">{t("ads.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="grid gap-4">
          {ads.slice((page - 1) * ADS_PAGE_SIZE, page * ADS_PAGE_SIZE).map((a) => (
            <Card
              key={a.id}
              data-ad-id={a.id}
              className={cn(
                "overflow-hidden rounded-3xl shadow-sm hover:shadow-md transition-shadow",
                highlight === a.id && "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}
            >
              <CardContent className="space-y-3.5 p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 text-lg font-black leading-snug">{a.title}</h2>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary">
                    <Megaphone className="h-3 w-3" />
                    {t("ads.badge")}
                  </span>
                </div>
                {a.media.length > 0 && <AdMediaCarousel media={a.media} title={a.title} />}
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{a.body}</p>
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy === a.id}
                      onClick={() => void toggleLike(a.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition-all",
                        a.likedByMe
                          ? "border-rose-400/50 bg-rose-500/10 text-rose-500"
                          : "border-border bg-card text-muted-foreground hover:border-rose-400/40 hover:text-rose-500"
                      )}
                    >
                      <Heart className={cn("h-3.5 w-3.5", a.likedByMe && "fill-rose-500")} />
                      {a.likesCount}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCommentOpen(commentOpen === a.id ? null : a.id); setCommentText(""); }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition-all",
                        commentOpen === a.id
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
                      )}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {t("ads.comments")}
                      <span className="rounded-full bg-muted px-1.5 font-mono text-[10px]">{a.commentsCount}</span>
                    </button>
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground">{fmtDate(a.publishedAt)}</span>
                </div>

                {commentOpen === a.id && (
                  <div className="space-y-2">
                    {a.comments.length > 0 && (
                      <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-2">
                        {a.comments.map((c, ci) => (
                          <div key={ci} className="space-y-1 rounded-xl bg-muted/40 px-3 py-2">
                            <p className="text-[11px] font-black">{c.name}</p>
                            <p className="text-xs leading-relaxed text-muted-foreground" dir="auto">{c.text}</p>
                            {c.reply?.text && (
                              <div className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5">
                                <p className="text-[10px] font-black text-primary">{t("ads.centerReply")}</p>
                                <p className="text-xs font-semibold leading-relaxed" dir="auto">{c.reply.text}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {canReact ? (
                      <div className="flex items-center gap-2">
                        <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} maxLength={400} className="h-10 rounded-xl" placeholder="" />
                        <Button size="icon" className="h-10 w-10 shrink-0 rounded-xl" disabled={busy === a.id || !commentText.trim()} onClick={() => void submitComment(a.id)} aria-label={t("common.send")}>
                          {busy === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:-scale-x-100" />}
                        </Button>
                      </div>
                    ) : (
                      <p className="rounded-xl bg-muted/60 p-2.5 text-center text-xs font-semibold text-muted-foreground">{t("ads.loginToReact")}</p>
                    )}
                  </div>
                )}
              </CardContent>
              {/* ★ v3.21/3.21.1: نشر الإعلان على انستغرام/فايسبوك — للإدارة والمساعد فقط (إعلان المركز بلا مؤلف) */}
              {isStaff && (
                <CardContent className="border-t px-4 py-2.5">
                  <ShareButtons
                    target={{
                      kind: "ad",
                      id: a.id,
                      title: a.title,
                      summary: a.body,
                      image: a.media.find((m) => !isVideo(m)) || "",
                    }}
                  />
                </CardContent>
              )}
            </Card>
          ))}
        </div>
        <Pagination page={page} pageCount={Math.max(1, Math.ceil(ads.length / ADS_PAGE_SIZE))} onPage={setPage} total={ads.length} pageSize={ADS_PAGE_SIZE} />
        </>
      )}

      {/* نافذة تصيير/تعديل إعلان */}
      <AdEditor
        editing={editing}
        onClose={() => setEditing(null)}
        onSave={async (payload) => {
          const done = await staffAction({ ...payload, action: payload._id ? "update" : "create" }, t("common.saved"));
          if (done) setEditing(null);
        }}
      />

      {/* نافذة الرد على تعليق */}
      <Dialog open={!!replyFor} onOpenChange={(v) => !v && setReplyFor(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-start">{t("ads.replyTo", { name: replyFor?.name || "" })}</DialogTitle>
            <DialogDescription className="text-start">{t("ads.replyNote")}</DialogDescription>
          </DialogHeader>
          <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} maxLength={400} />
          <Button
            disabled={!replyText.trim()}
            onClick={async () => {
              if (!replyFor) return;
              const done = await staffAction({ action: "comment-reply", id: replyFor.adId, commentIndex: replyFor.idx, text: replyText.trim() }, t("ads.replySent"));
              if (done) setReplyFor(null);
            }}
            className="h-11 w-full rounded-xl"
          >
            {t("common.send")}
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                const done = await staffAction({ action: "delete", id: delId }, t("ads.deleteDone"));
                if (done) setDelId(null);
              }}>
              {t("common.yes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─────────── محرر الإعلان ─────────── */
function AdEditor({
  editing,
  onClose,
  onSave,
}: {
  editing: Record<string, unknown> | null;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const { t } = useApp();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<string[]>([]);
  const [float, setFloat] = useState(false);
  const [floatPerUser, setFloatPerUser] = useState(3);
  const [floatDays, setFloatDays] = useState(7);
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing) {
      setTitle(String(editing.title || ""));
      setBody(String(editing.body || ""));
      setMedia((editing.media as string[]) || []);
      setFloat(editing.float === true);
      setFloatPerUser(Number(editing.floatPerUser) || 3);
      setFloatDays(Number(editing.floatDays) || 7);
      setPublish(String(editing.status || "") !== "DRAFT");
    }
  }, [editing]);

  if (!editing) return null;

  return (
    <Dialog open={!!editing} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-start">{editing._id ? t("ads.editAd") : t("ads.newAd")}</DialogTitle>
          <DialogDescription className="text-start">{t("ads.editorNote")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("ads.adTitle")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>{t("ads.adBody")}</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1500} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Images className="h-4 w-4 text-primary" /> {t("ads.adMedia")}</Label>
            <MediaPicker value={media} onChange={setMedia} max={6} />
            <p className="text-[11px] text-muted-foreground">{t("ads.mediaHint")}</p>
          </div>
          <div className="space-y-3 rounded-2xl border p-3.5">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{t("ads.floatToggle")}</span>
              <Switch checked={float} onCheckedChange={setFloat} />
            </label>
            {float && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("ads.floatPerUser")}</Label>
                  <Input type="number" min={1} max={20} value={floatPerUser} onChange={(e) => setFloatPerUser(Number(e.target.value))} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("ads.floatDays")}</Label>
                  <Input type="number" min={1} max={365} value={floatDays} onChange={(e) => setFloatDays(Number(e.target.value))} className="h-10" />
                </div>
              </div>
            )}
          </div>
          <label className="flex items-center justify-between rounded-xl border p-3">
            <span className="text-sm font-semibold">{t("ads.publishNow")}</span>
            <Switch checked={publish} onCheckedChange={setPublish} />
          </label>
          <Button
            disabled={busy || title.trim().length < 3 || body.trim().length < 3}
            className="h-12 w-full rounded-xl text-base"
            onClick={async () => {
              setBusy(true);
              await onSave({ ...editing, title, body, media, float, floatPerUser, floatDays, publish });
              setBusy(false);
            }}
          >
            {busy ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

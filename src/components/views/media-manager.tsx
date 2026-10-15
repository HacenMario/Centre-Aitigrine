"use client";
/**
 * الوسائط المخزنة (v3.18) — تبويب في إعدادات المركز
 * قائمة كل ملفات GridFS مرتبة من الأكبر: معاينة + نوع + حجم + تاريخ + شارات
 * الاستخدام (سلايدر/إعلان/تكوين/فاتورة/…) + حذف فردي آمن + تنظيف اليتيمة بضغطة.
 *
 * الحماية (مطابقة للخادم):
 *  - الملف المستخدم: زر الحذف معطّل ويظهر مكان استخدامه — الخادم يرفضه بـ 409 أيضاً.
 *  - تعذر فحص الاستخدام: الحذف معطّل كلياً (وضع محافظ).
 *  - الفواتير تظهر بشارة خاصة (سجلات مالية).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  HardDrive, Trash2, ShieldCheck, ShieldAlert, Image as ImageIcon, Film,
  FileText, Search, Loader2, RefreshCw, Eraser, FileQuestion,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type MediaRow = {
  name: string;
  size: number;
  contentType: string;
  date: string;
  usage: string[];
  used: boolean;
};
type MediaStats = {
  count: number;
  total: number;
  orphans: number;
  orphanBytes: number;
  scanOk: boolean;
};

const human = (b: number): string => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const extOf = (name: string) => name.split(".").pop()?.toLowerCase() || "";
const isImage = (name: string) => ["jpg", "jpeg", "png", "webp", "gif"].includes(extOf(name));
const isVideo = (name: string) => ["mp4", "webm", "mov"].includes(extOf(name));
const isPdf = (name: string) => extOf(name) === "pdf";

const KIND_KEY: Record<string, string> = {
  slider: "media.usedSlider",
  settings: "media.usedSettings",
  ads: "media.usedAds",
  courses: "media.usedCourses",
  services: "media.usedServices",
  ebooks: "media.usedEbooks",
  articles: "media.usedArticles",
  users: "media.usedUsers",
  pages: "media.usedPages",
  invoice: "media.usedInvoice",
};

export default function MediaManager() {
  const { t, lang } = useApp();
  const [rows, setRows] = useState<MediaRow[] | null>(null);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmDel, setConfirmDel] = useState<MediaRow | null>(null);
  const [confirmClean, setConfirmClean] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/media");
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || t("common.error")); setRows([]); return; }
      setRows(j.files || []);
      setStats(j.stats || null);
    } catch {
      toast.error(t("err.conn"));
      setRows([]);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const del = async (row: MediaRow) => {
    setBusy(row.name);
    try {
      const r = await fetch(`/api/media/${encodeURIComponent(row.name)}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({} as { error?: string; usage?: string[] }));
      if (r.ok) {
        toast.success(`${t("media.deleted")} — ${human(row.size)}`);
        setConfirmDel(null);
        load();
      } else if (r.status === 409) {
        toast.error(`${t("media.protected")} ${(j.usage || []).map((k) => t(KIND_KEY[k] || k)).join(" · ")}`);
        setConfirmDel(null);
        load();
      } else {
        toast.error(j.error || t("common.error"));
      }
    } catch {
      toast.error(t("err.conn"));
    }
    setBusy("");
  };

  const cleanup = async () => {
    setBusy("cleanup");
    try {
      const r = await fetch("/api/media/cleanup", { method: "POST" });
      const j = await r.json().catch(() => ({} as { error?: string; deleted?: { name: string; size: number }[]; freed?: number }));
      if (r.ok) {
        toast.success(`${t("media.cleanupDone")} ${human(j.freed || 0)}`);
        setConfirmClean(false);
        load();
      } else {
        toast.error(j.error || t("common.error"));
      }
    } catch {
      toast.error(t("err.conn"));
    }
    setBusy("");
  };

  const filtered = useMemo(() => {
    if (!rows) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(needle));
  }, [rows, q]);

  const orphans = useMemo(() => (rows || []).filter((r) => !r.used), [rows]);
  const dateFmt = (iso: string) => {
    if (!iso) return "—";
    const loc = { ar: "ar-DZ", fr: "fr-FR", en: "en-GB", tr: "tr-TR", es: "es-ES" }[lang] || "ar-DZ";
    try { return new Date(iso).toLocaleDateString(loc, { year: "numeric", month: "short", day: "numeric" }); }
    catch { return iso.slice(0, 10); }
  };

  const scanBlocked = !!stats && !stats.scanOk;

  return (
    <div className="space-y-4">
      {/* ── الإحصاءات + التنظيف ── */}
      <Card className="ait-card rounded-3xl border-primary/25">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
              <HardDrive className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-black">{t("media.tab")}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{t("media.sub")}</p>
            </div>
            <Button variant="outline" size="icon" className="shrink-0 rounded-xl" onClick={load} aria-label="refresh">
              <RefreshCw className={cn("h-4 w-4", !rows && "animate-spin")} />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-muted/60 p-3 text-center">
              <p dir="ltr" className="text-lg font-black tabular-nums">{stats ? stats.count : "—"}</p>
              <p className="text-[11px] text-muted-foreground">{t("media.statFiles")}</p>
            </div>
            <div className="rounded-2xl bg-muted/60 p-3 text-center">
              <p dir="ltr" className="text-lg font-black tabular-nums">{stats ? human(stats.total) : "—"}</p>
              <p className="text-[11px] text-muted-foreground">{t("media.statSize")}</p>
            </div>
            <div className="rounded-2xl bg-amber-500/10 p-3 text-center">
              <p dir="ltr" className="text-lg font-black tabular-nums text-amber-700 dark:text-amber-400">
                {stats ? `${stats.orphans} · ${human(stats.orphanBytes)}` : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">{t("media.statOrphans")}</p>
            </div>
          </div>

          {scanBlocked && (
            <div className="flex items-start gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-700 dark:text-orange-400">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{t("media.scanWarn")}</span>
            </div>
          )}

          <Button
            className="w-full gap-2 rounded-2xl"
            variant={orphans.length ? "destructive" : "secondary"}
            disabled={!orphans.length || scanBlocked || busy === "cleanup" || !rows}
            onClick={() => setConfirmClean(true)}
          >
            {busy === "cleanup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
            {orphans.length
              ? `${t("media.cleanup")} (${orphans.length} — ${human(orphans.reduce((s, r) => s + r.size, 0))})`
              : t("media.cleanup")}
          </Button>
        </CardContent>
      </Card>

      {/* ── البحث ── */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} className="ps-9 h-11 rounded-2xl" />
      </div>

      {/* ── القائمة ── */}
      {!filtered ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-3xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">{rows?.length ? t("common.search") : t("media.empty")}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => {
            const delBlocked = row.used || scanBlocked;
            return (
              <Card key={row.name} className="ait-card rounded-3xl">
                <CardContent className="p-3 flex items-center gap-3">
                  {/* معاينة */}
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted/70">
                    {isImage(row.name) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={`/api/media/${row.name}`} alt="" loading="lazy" className="h-12 w-12 object-cover" />
                    ) : isVideo(row.name) ? (
                      <Film className="h-5 w-5 text-violet-600" />
                    ) : isPdf(row.name) ? (
                      <FileText className="h-5 w-5 text-rose-600" />
                    ) : (
                      <FileQuestion className="h-5 w-5 text-muted-foreground" />
                    )}
                  </span>

                  {/* الاسم + الشارات */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p dir="ltr" className="text-xs font-semibold truncate text-start">{row.name}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <Badge variant="outline" dir="ltr" className="tabular-nums text-[10px]">{human(row.size)}</Badge>
                      <Badge variant="outline" className="text-[10px]">{dateFmt(row.date)}</Badge>
                      {row.used ? (
                        row.usage.map((k) => (
                          <Badge key={k} className="text-[10px] border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400" variant="outline">
                            <ShieldCheck className="h-3 w-3 shrink-0" /> {t(KIND_KEY[k] || k)}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                          {t("media.unused")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* حذف */}
                  <Button
                    variant={row.used ? "ghost" : "destructive"}
                    size="icon"
                    className="shrink-0 rounded-xl h-10 w-10"
                    disabled={delBlocked || busy === row.name}
                    aria-label={row.used ? t("media.protected") : t("common.delete")}
                    title={row.used ? t("media.protected") : t("common.delete")}
                    onClick={() => (row.used ? toast.info(`${t("media.protected")} ${row.usage.map((k) => t(KIND_KEY[k] || k)).join(" · ")}`) : setConfirmDel(row))}
                  >
                    {busy === row.name ? <Loader2 className="h-4 w-4 animate-spin" /> : row.used ? <ShieldCheck className="h-4 w-4 text-sky-600" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── تأكيد حذف فردي ── */}
      <Dialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t("media.delTitle")}</DialogTitle>
            <DialogDescription dir="ltr" className="text-start break-all">{confirmDel?.name}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDel(null)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={() => confirmDel && del(confirmDel)} disabled={busy === confirmDel?.name} className="gap-1.5">
              {busy === confirmDel?.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── تأكيد التنظيف الشامل ── */}
      <Dialog open={confirmClean} onOpenChange={setConfirmClean}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t("media.cleanTitle")}</DialogTitle>
            <DialogDescription className="text-start">{t("media.cleanSub")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-44 overflow-y-auto rounded-2xl border bg-muted/40 p-2 space-y-1">
            {orphans.map((o) => (
              <div key={o.name} className="flex items-center justify-between gap-2 text-xs px-2 py-1">
                <span dir="ltr" className="truncate">{o.name}</span>
                <span className="tabular-nums text-muted-foreground shrink-0">{human(o.size)}</span>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmClean(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={cleanup} disabled={busy === "cleanup"} className="gap-1.5">
              {busy === "cleanup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
              {t("media.cleanBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";
/**
 * المقالات العلمية (v3.6.0) — علم النفس والأرطفونية
 * • القراءة عامة للجميع: الزوار والمستخدمون — بلا حساب
 * • النشر: الأخصائيون وإدارة المركز فقط (الإدارة + المساعد)
 * • ثلاثي اللغة كاملاً: العنوان والنبذة والمتن — يقرأ كل زائر المقال بلغته
 *   (إن فارغت الترجمة سقطت تلقائياً إلى العربية مع اتجاه نص صحيح)
 * • تصفية بالمجال: الكل / علم النفس / الأرطفونية
 * • الإدارة تعدّل أي مقال — الأخصائي يعدّل مقالاته هو فقط
 * • الحذف: الأدمين أي مقال — الأخصائي مقاله هو فقط (نمط الكتب الإلكترونية)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { CardsSkeleton } from "@/components/brand-skeleton";
import ImageInput from "@/components/image-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Newspaper, Plus, Pencil, Trash2, Power, X, ArrowRight, ArrowLeft, ShieldCheck, PenLine, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { TriInput, TriTextarea, flattenTri, localeOf, pickTri, triFrom } from "@/components/tri-input";
import FullImage from "@/components/full-image";
import Pagination from "@/components/pagination";
import { cn } from "@/lib/utils";
import type { Navigate } from "@/lib/nav";

const PAGE_SIZE = 9;

type Article = {
  _id: string;
  title: string; titleFr?: string; titleEn?: string;
  summary: string; summaryFr?: string; summaryEn?: string;
  content?: string; contentFr?: string; contentEn?: string;
  category: "psychology" | "orthophony" | "general";
  coverBase64: string;
  authorId?: string; authorName: string; authorRole: string;
  authorTitle?: string; authorTitleFr?: string; authorTitleEn?: string;
  active: boolean;
  createdAt: string;
};

type CatFilter = "all" | "psychology" | "orthophony";

const CATS: { value: Article["category"]; key: string }[] = [
  { value: "general", key: "art.catGeneral" },
  { value: "psychology", key: "art.catPsychology" },
  { value: "orthophony", key: "art.catOrthophony" },
];

/** اتجاه النص حسب محتواه — مقال عربي يُعرض RTL حتى داخل واجهة فرنسية */
function dirOf(text: string): "rtl" | "ltr" {
  return /[\u0600-\u06FF]/.test(text.slice(0, 200)) ? "rtl" : "ltr";
}

/** تاريخ النشر بلغة القارئ */
function fmtDate(iso: string, lang: "ar" | "fr" | "en"): string {
  try {
    return new Date(iso).toLocaleDateString(
      localeOf(lang),
      { year: "numeric", month: "long", day: "numeric" }
    );
  } catch {
    return "";
  }
}

export default function Articles({ navigate }: { navigate: Navigate }) {
  const { t, me, lang } = useApp();
  const isStaff = me?.role === "admin" || me?.role === "assistant";
  const isSpecialist = me?.role === "specialist";
  /** النشر متاح للأخصائيين والإدارة فقط — طلب المستخدم */
  const canPublish = !!me && (isStaff || isSpecialist);

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CatFilter>("all");
  const [reading, setReading] = useState<Article | null>(null);
  const [editing, setEditing] = useState<Partial<Article> | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      if (isStaff) {
        const r = await fetch("/api/articles?all=1", { cache: "no-store" });
        const j = await r.json();
        setArticles(j.articles || []);
      } else if (isSpecialist) {
        /* الأخصائي: المقالات المفعّلة + مقالاته هو حتى المعطّلة منها */
        const [pub, mine] = await Promise.all([
          fetch("/api/articles", { cache: "no-store" }),
          fetch("/api/articles?mine=1", { cache: "no-store" }),
        ]);
        const pj = pub.ok ? await pub.json() : { articles: [] };
        const mj = mine.ok ? await mine.json() : { articles: [] };
        const map = new Map<string, Article>();
        for (const a of [...(pj.articles || []), ...(mj.articles || [])]) map.set(a._id, a);
        setArticles([...map.values()]);
      } else {
        const r = await fetch("/api/articles", { cache: "no-store" });
        const j = await r.json();
        setArticles(j.articles || []);
      }
    } catch {}
    setLoading(false);
  }, [isStaff, isSpecialist]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filter, articles.length]);

  const titleOf = (a: Article) => pickTri(a as unknown as Record<string, unknown>, "title", lang) || a.title;
  const summaryOf = (a: Article) => pickTri(a as unknown as Record<string, unknown>, "summary", lang);
  const authorTitleOf = (a: Article) => pickTri(a as unknown as Record<string, unknown>, "authorTitle", lang);
  const catKeyOf = (a: Article) => CATS.find((c) => c.value === a.category)?.key || "art.catGeneral";

  /* وقت القراءة التقديري — ~180 كلمة في الدقيقة */
  const readTimeOf = (a: Article) => {
    const text = `${a.summary || ""} ${(a as { content?: string }).content || ""}`;
    const words = text.split(/\s+/).filter(Boolean).length;
    return t("art.readTime", { n: Math.max(1, Math.round(words / 180)) });
  };

  /* تصفية بالمجال */
  const filtered = useMemo(
    () => (filter === "all" ? articles : articles.filter((a) => a.category === filter)),
    [articles, filter]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const canManage = (a: Article) =>
    !!me && (me.role === "admin" || (isSpecialist && String(a.authorId || "") === String(me._id)));
  const canDelete = (a: Article) =>
    me?.role === "admin" || (isSpecialist && String(a.authorId || "") === String(me._id));

  const toggleActive = async (a: Article) => {
    const r = await fetch(`/api/articles/${a._id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !a.active }),
    });
    if (r.ok) {
      toast.success(a.active ? t("toast.articleDeactivated") : t("toast.articleActivated"));
      load();
    } else toast.error(t("common.error"));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <BackButton onBack={() => navigate("home")} />
          <h1 className="text-xl sm:text-2xl font-black">{t("nav.articles")}</h1>
        </div>
        {canPublish && (
          <Button
            onClick={() => setEditing({ title: "", titleFr: "", titleEn: "", summary: "", summaryFr: "", summaryEn: "", content: "", contentFr: "", contentEn: "", category: "general", coverBase64: "", active: true })}
            className="gap-2 rounded-xl shadow-md shadow-primary/20"
          >
            <Plus className="h-4.5 w-4.5" /> {t("art.new")}
          </Button>
        )}
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-primary/6 border border-primary/15 px-4 py-2.5 text-sm text-primary/90 leading-relaxed">
        <Newspaper className="h-4 w-4 shrink-0 mt-0.5" />
        <span className="min-w-0">{t("art.desc")}</span>
      </p>

      {/* تصفية بالمجال — علم النفس / الأرطفونية */}
      {!loading && articles.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label={t("art.category")}>
          {([
            { v: "all" as CatFilter, label: t("common.all") },
            { v: "psychology" as CatFilter, label: t("art.catPsychology") },
            { v: "orthophony" as CatFilter, label: t("art.catOrthophony") },
          ]).map((f) => (
            <button
              key={f.v}
              type="button"
              role="tab"
              aria-selected={filter === f.v}
              onClick={() => setFilter(f.v)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-bold transition-all ring-1",
                filter === f.v
                  ? "bg-primary text-primary-foreground ring-primary shadow-sm shadow-primary/25"
                  : "bg-card text-foreground/75 ring-border hover:ring-primary/40 hover:text-primary"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <CardsSkeleton count={3} />
      ) : filtered.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-14 text-center text-muted-foreground">
            {canPublish && articles.length === 0 ? t("art.emptyStaff") : t("art.empty")}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((a) => (
              <Card
                key={a._id}
                className={cn(
                  "overflow-hidden rounded-3xl shadow-sm hover:shadow-lg transition-all group flex flex-col",
                  !a.active && "opacity-60"
                )}
              >
                <button
                  type="button"
                  className="block w-full text-start flex-1 flex flex-col"
                  onClick={() => setReading(a)}
                  aria-label={`${t("art.read")} — ${titleOf(a)}`}
                >
                  <div className="relative h-48 sm:h-52 bg-muted/30">
                    {a.coverBase64 ? (
                      <FullImage src={a.coverBase64} alt={titleOf(a)} className="h-48 w-full sm:h-52" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/15 to-accent/15">
                        <Newspaper className="h-14 w-14 text-primary/40" />
                      </span>
                    )}
                    <Badge className="absolute top-3 start-3 bg-background/90 text-primary border-0 shadow">
                      {t(catKeyOf(a))}
                    </Badge>
                    {!a.active && isStaff && (
                      <Badge className="absolute top-3 end-3 bg-muted text-muted-foreground border-0">
                        {t("common.inactive")}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="flex-1 space-y-2 p-5">
                    <h3 className="font-black leading-snug break-words whitespace-normal line-clamp-2">{titleOf(a)}</h3>
                    {summaryOf(a) && (
                      <p className="text-sm text-muted-foreground leading-relaxed break-words whitespace-pre-line line-clamp-3">
                        {summaryOf(a)}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
                      {a.authorName && (
                        <span className="font-semibold text-foreground/75 break-words">
                          {t("art.by")} {a.authorName}
                          {authorTitleOf(a) ? ` — ${authorTitleOf(a)}` : ""}
                        </span>
                      )}
                      {a.authorRole && (
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-bold text-primary">
                          {t(`roles.${a.authorRole}`)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {readTimeOf(a)}
                      </span>
                    </div>
                  </CardContent>
                </button>
                {canManage(a) && (
                  <CardContent className="flex items-center gap-1 border-t py-2 px-2 flex-wrap">
                    <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={() => setEditing(a)}>
                      <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={() => toggleActive(a)}>
                      <Power className="h-3.5 w-3.5" /> {a.active ? t("common.deactivate") : t("common.activate")}
                    </Button>
                    {canDelete(a) && (
                      <Button
                        size="icon" variant="ghost"
                        className="ms-auto h-8 w-8 text-destructive"
                        onClick={() => setDelId(a._id)}
                        aria-label={t("common.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
        </>
      )}

      {/* القارئ — يفتح للجميع بلا حساب */}
      {reading && (
        <ArticleReader
          article={reading}
          onClose={() => setReading(null)}
          onEdit={canManage(reading) ? () => { setEditing(reading); setReading(null); } : undefined}
        />
      )}

      {/* المحرر — للأخصائيين والإدارة فقط */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-start">{editing?._id ? t("common.edit") : t("art.new")}</DialogTitle>
            <DialogDescription className="text-start flex items-start gap-1.5 leading-relaxed">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              {t("art.editorNote")}
            </DialogDescription>
          </DialogHeader>
          <ArticleEditor article={editing} onChange={setEditing} onDone={() => { setEditing(null); load(); }} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                const r = await fetch(`/api/articles/${delId}`, { method: "DELETE" });
                if (r.ok) { toast.success(t("toast.articleDeleted")); setDelId(null); load(); }
                else toast.error(t("common.error"));
              }}
            >
              {t("common.yes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ───────────────── القارئ — مفتوح للجميع ───────────────── */
function ArticleReader({
  article, onClose, onEdit,
}: {
  article: Article;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const { t, lang } = useApp();
  const [full, setFull] = useState<Article>(article);
  const [loadingContent, setLoadingContent] = useState(true);
  const dir = document.documentElement.getAttribute("dir");
  const NavIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  /* المتن الكامل يُجلب من الخادم — القائمة لا تحمل المتون */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/articles/${article._id}`, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (alive && j.article) setFull(j.article);
        }
      } catch {}
      if (alive) setLoadingContent(false);
    })();
    return () => { alive = false; };
  }, [article._id]);

  const title = pickTri(full as unknown as Record<string, unknown>, "title", lang) || full.title;
  const summary = pickTri(full as unknown as Record<string, unknown>, "summary", lang);
  const content = pickTri(full as unknown as Record<string, unknown>, "content", lang);
  const authorTitle = pickTri(full as unknown as Record<string, unknown>, "authorTitle", lang);
  const bodyDir = dirOf(content || title);
  const paragraphs = useMemo(
    () => (content || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    [content]
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-3xl max-h-[92dvh] overflow-y-auto rounded-3xl">
        {/* رأس القارئ — سطر العنوان وسطر الأزرار منفصلان: لا تداخل */}
        <DialogHeader className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 pb-3 pt-1 backdrop-blur border-b">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-start break-words whitespace-normal leading-relaxed">{title}</DialogTitle>
              <DialogDescription className="text-start mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{t("art.publishedOn", { date: fmtDate(full.createdAt, lang) })}</span>
                {full.authorName && (
                  <span className="font-semibold">
                    · {t("art.by")} {full.authorName}{authorTitle ? ` — ${authorTitle}` : ""}
                  </span>
                )}
                {full.authorRole && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                    {t(`roles.${full.authorRole}`)}
                  </span>
                )}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {onEdit && (
                <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5 rounded-full">
                  <Pencil className="h-4 w-4" />
                  <span className="hidden min-[420px]:inline">{t("common.edit")}</span>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5 rounded-full">
                <NavIcon className="h-4 w-4" />
                <span className="hidden min-[420px]:inline">{t("common.back")}</span>
              </Button>
              <Button
                variant="outline" size="icon" onClick={onClose}
                aria-label={t("common.close")} title={t("common.close")}
                className="h-9 w-9 shrink-0 rounded-full border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-4.5 w-4.5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pb-4">
          {full.coverBase64 && (
            <FullImage src={full.coverBase64} alt={title} className="h-56 sm:h-72 w-full rounded-2xl" />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/10 text-primary border-0">{t(full.category === "psychology" ? "art.catPsychology" : full.category === "orthophony" ? "art.catOrthophony" : "art.catGeneral")}</Badge>
          </div>
          {summary && (
            <p
              dir={dirOf(summary)}
              className="rounded-2xl bg-muted/40 border px-4 py-3 text-[0.95rem] font-semibold leading-relaxed text-foreground/85 break-words"
            >
              {summary}
            </p>
          )}
          {loadingContent && !content ? (
            <div className="space-y-2.5 py-2" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${100 - (i % 3) * 12}%` }} />
              ))}
            </div>
          ) : (
            <div dir={bodyDir} className="space-y-4">
              {paragraphs.map((p, i) => (
                <p key={i} className="text-[1.02rem] leading-loose whitespace-pre-line text-foreground/90 break-words">
                  {p}
                </p>
              ))}
              {paragraphs.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
              )}
            </div>
          )}
          <p className="flex items-center justify-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            {t("art.publishedByCenter")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────── المحرر — الأخصائيون والإدارة ───────────────── */
function ArticleEditor({
  article, onChange, onDone,
}: {
  article: Partial<Article> | null;
  onChange: (a: Partial<Article> | null) => void;
  onDone: () => void;
}) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  const upd = (patch: Partial<Article>) => onChange({ ...article, ...patch });

  const save = async () => {
    if (!article?.title?.trim()) { toast.error(t("err.required")); return; }
    if (!String(article.content || "").trim()) { toast.error(t("art.contentRequired")); return; }
    setBusy(true);
    const isNew = !article._id;
    const r = await fetch(isNew ? "/api/articles" : `/api/articles/${article._id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(article),
    });
    setBusy(false);
    if (r.ok) {
      toast.success(isNew ? t("toast.articleSaved") : t("toast.articleUpdated"));
      onDone();
    } else {
      try {
        const j = await r.json();
        toast.error(j?.error || t("common.error"));
      } catch {
        toast.error(t("common.error"));
      }
    }
  };

  return (
    <div className="space-y-4">
      <TriInput
        label={t("common.title")}
        value={triFrom(article as Record<string, unknown>, "title")}
        onChange={(v) => upd({ ...flattenTri("title", v) } as Partial<Article>)}
      />
      <TriTextarea
        label={t("art.summary")}
        value={triFrom(article as Record<string, unknown>, "summary")}
        onChange={(v) => upd({ ...flattenTri("summary", v) } as Partial<Article>)}
        rows={2}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("art.category")}</Label>
          <Select
            value={article?.category || "general"}
            onValueChange={(v) => upd({ category: v as Article["category"] })}
          >
            <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{t(c.key)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("art.cover")}</Label>
          <ImageInput
            value={article?.coverBase64 || ""}
            onChange={(v) => upd({ coverBase64: v })}
            label={t("common.uploadImage")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <PenLine className="h-3.5 w-3.5 text-primary" /> {t("art.content")}
        </Label>
        <TriTextarea
          value={triFrom(article as Record<string, unknown>, "content")}
          onChange={(v) => upd({ ...flattenTri("content", v) } as Partial<Article>)}
          rows={10}
          placeholder={t("art.contentHint")}
        />
        <p className="text-xs text-muted-foreground">{t("art.contentHint")}</p>
      </div>

      <label className="flex items-center justify-between rounded-xl border p-3">
        <span className="text-sm font-semibold">{t("common.active")}</span>
        <Switch checked={article?.active !== false} onCheckedChange={(v) => upd({ active: v })} />
      </label>

      <Button onClick={save} disabled={busy} className="w-full h-12 rounded-xl text-base">
        {busy ? t("common.saving") : t("common.save")}
      </Button>
    </div>
  );
}

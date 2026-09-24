"use client";
/**
 * الخدمات — للجميع (المفعّلة) + للإدارة: إضافة/تعديل/حذف/تفعيل-تعطيل/معاينة/تفاصيل
 * حقل الأيقونة يقبل رموز إيموجي من كيبورد الهاتف
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { PageSkeleton } from "@/components/brand-skeleton";
import ImageInput from "@/components/image-input";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Power, Eye, ChevronDown, ChevronUp, Sparkles, Smile } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Navigate } from "@/lib/nav";
import { TriInput, TriTextarea, flattenTri, triFrom, triName, type Tri } from "@/components/tri-input";
import FullImage from "@/components/full-image";
import Pagination from "@/components/pagination";
import { pickByLang } from "@/lib/pick-lang";
import type { TriCat } from "@/lib/app-context";

const PAGE_SIZE = 9;
const emptyTri: Tri = { ar: "", fr: "", en: "" };

type Service = {
  _id: string; title: string; titleFr?: string; titleEn?: string; description: string; descriptionFr?: string; descriptionEn?: string; icon: string; category: string;
  price: number; durationMin: number; coverBase64: string; active: boolean; order: number;
};
const EMPTY: Partial<Service> = { title: "", description: "", icon: "✨", category: "", price: 0, durationMin: 60, coverBase64: "", active: true, order: 0 };

export default function Services({ navigate }: { navigate: Navigate }) {
  const { t, me, settings, lang } = useApp();
  const isStaff = me?.role === "admin" || me?.role === "assistant";
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Service> | null>(null);
  const [triTitle, setTriTitle] = useState<Tri>(emptyTri);
  const [triDesc, setTriDesc] = useState<Tri>(emptyTri);
  const [delId, setDelId] = useState<string | null>(null);
  const [details, setDetails] = useState<Service | null>(null);
  const [showAll, setShowAll] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/services${isStaff ? "?all=1" : ""}`, { cache: "no-store" });
      const j = await r.json();
      setServices(j.services || []);
    } catch {}
    setLoading(false);
  }, [isStaff]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (s: Service) => {
    const r = await fetch(`/api/services/${s._id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    if (r.ok) { toast.success(s.active ? t("common.inactive") : t("common.active")); load(); }
  };

  const openEditor = (s: Partial<Service>) => {
    setEditing(s);
    setTriTitle(triFrom(s as Record<string, unknown>, "title"));
    setTriDesc(triFrom(s as Record<string, unknown>, "description"));
  };

  const save = async () => {
    if (!triTitle.ar.trim()) { toast.error(t("err.required")); return; }
    const isNew = !editing?._id;
    const body = {
      ...editing,
      ...flattenTri("title", triTitle),
      ...flattenTri("description", triDesc),
    };
    const r = await fetch(isNew ? "/api/services" : `/api/services/${editing!._id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) { toast.success(t("toast.serviceSaved")); setEditing(null); load(); }
    else toast.error(t("common.error"));
  };

  const cats = (settings?.options?.serviceCategories || []) as TriCat[];
  const shown = isStaff && !showAll ? services.filter((s) => s.active) : services;

  /* v3.5: التصنيفات ثلاثية اللغة — التخزين بالنص العربي (مفتاح مرجعي) والعرض بلغة المستخدم */
  const catLabel = (value: string): string => {
    if (!value) return "";
    const hit = cats.find((c) => c.ar === value);
    if (!hit) return value;
    return triName(hit, lang);
  };

  /* ترقيم الصفحات الاحترافي */
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [shown.length, showAll]);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageItems = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <BackButton onBack={() => navigate("home")} />
          <h1 className="text-xl sm:text-2xl font-black">{t("nav.services")}</h1>
        </div>
        {isStaff && (
          <Button onClick={() => openEditor({ ...EMPTY })} className="gap-2 rounded-xl shadow-md shadow-primary/20">
            <Plus className="h-4.5 w-4.5" /> {t("srv.newService")}
          </Button>
        )}
      </div>

      {isStaff && (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showAll} onCheckedChange={setShowAll} />
          {t("common.all")} ({services.length}) — {t("common.active")}: {services.filter((s) => s.active).length}
        </label>
      )}

      {loading ? (
        <PageSkeleton kind="cards" count={6} label={t("common.loading")} />
      ) : shown.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-14 text-center text-muted-foreground">{t("srv.noServices")}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((s) => (
            <Card key={s._id} className={cn(
              "group rounded-3xl shadow-sm hover:shadow-lg transition-all duration-300",
              !s.active && "opacity-60"
            )}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl group-hover:scale-110 transition-transform">
                    {s.icon || "✨"}
                  </span>
                  {!s.active && <Badge variant="secondary">{t("common.inactive")}</Badge>}
                </div>
                <h3 className="font-bold leading-snug break-words whitespace-normal">{pickByLang(lang, s.title, s.titleFr, s.titleEn)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed break-words whitespace-pre-line">{pickByLang(lang, s.description, s.descriptionFr, s.descriptionEn)}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {s.category && <Badge variant="outline" className="break-words whitespace-normal">{catLabel(s.category)}</Badge>}
                  {s.price > 0 && <span className="font-bold text-primary">{s.price.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-DZ")} {t("common.currency")}</span>}
                  <span>{s.durationMin} {t("common.min")}</span>
                </div>
                <div className="flex items-center gap-1 pt-1 border-t flex-wrap">
                  <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setDetails(s)}>
                    <Eye className="h-3.5 w-3.5" /> {t("common.details")}
                  </Button>
                  {isStaff && (
                    <>
                      <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => openEditor(s)}>
                        <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => toggleActive(s)}>
                        <Power className="h-3.5 w-3.5" /> {s.active ? t("common.deactivate") : t("common.activate")}
                      </Button>
                      {me?.role === "admin" && (
                        <Button size="icon" variant="ghost" className="ms-auto h-8 w-8 text-destructive" aria-label={t("common.delete")}
                          onClick={() => setDelId(s._id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} onPage={setPage} total={shown.length} pageSize={PAGE_SIZE} />

      {/* نافذة التفاصيل / المعاينة */}
      <Dialog open={!!details} onOpenChange={(v) => !v && setDetails(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-start">
              <span className="text-3xl shrink-0">{details?.icon}</span>
              <span className="min-w-0 break-words whitespace-normal">{details ? pickByLang(lang, details.title, details.titleFr, details.titleEn) : ""}</span>
            </DialogTitle>
            <DialogDescription className="text-start">
              {details?.category ? catLabel(details.category) : ""}{details?.category ? " · " : ""}{details?.durationMin} {t("common.min")}
              {details?.price ? ` · ${details.price.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-DZ")} ${t("common.currency")}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {details?.coverBase64 && (
              /* ارتفاع ثابت + object-contain: الصورة تظهر كاملة دائماً دون قصّ */
              <FullImage src={details.coverBase64} alt={details ? pickByLang(lang, details.title, details.titleFr, details.titleEn) : ""} className="w-full h-56 sm:h-64" rounded="rounded-2xl" />
            )}
            <p className="text-sm leading-loose whitespace-pre-wrap break-words">{details ? pickByLang(lang, details.description, details.descriptionFr, details.descriptionEn) : ""}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* نافذة الإضافة/التعديل */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-start">{editing?._id ? t("srv.editService") : t("srv.newService")}</DialogTitle>
            <DialogDescription className="text-start flex items-center gap-1.5">
              <Smile className="h-4 w-4 text-primary" />
              {t("srv.iconHint")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <TriInput label={t("common.title")} value={triTitle} onChange={setTriTitle} required />
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-2">
                <Label>{t("srv.icon")}</Label>
                <Input
                  value={editing?.icon || ""}
                  onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                  className="h-11 text-center text-xl"
                  maxLength={8}
                  inputMode="text"
                  placeholder="✨"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("common.category")}</Label>
                {cats.length ? (
                  <Select value={editing?.category || ""} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                    <SelectTrigger className="h-11 w-40"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {cats.map((c) => <SelectItem key={c.ar} value={c.ar}>{triName(c, lang)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={editing?.category || ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="h-11 w-40" />
                )}
              </div>
            </div>
            <TriTextarea label={t("common.description")} value={triDesc} onChange={setTriDesc} rows={3} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("common.price")}</Label>
                <Input type="number" min={0} value={editing?.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>{t("srv.duration")}</Label>
                <Input type="number" min={15} step={5} value={editing?.durationMin ?? 60} onChange={(e) => setEditing({ ...editing, durationMin: Number(e.target.value) })} className="h-11" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("common.uploadImage")}</Label>
              <ImageInput value={editing?.coverBase64 || ""} onChange={(v) => setEditing({ ...editing, coverBase64: v })} />
            </div>
            <label className="flex items-center justify-between rounded-xl border p-3">
              <span className="text-sm font-semibold">{t("common.active")}</span>
              <Switch checked={editing?.active !== false} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
            </label>
            <Button onClick={save} className="w-full h-12 rounded-xl text-base">
              {t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                const r = await fetch(`/api/services/${delId}`, { method: "DELETE" });
                if (r.ok) { toast.success(t("toast.serviceDeleted")); setDelId(null); load(); }
              }}>
              {t("common.yes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

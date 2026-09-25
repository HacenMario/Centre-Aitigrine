"use client";
/**
 * شهادات وقصص النجاح (v3.8)
 * — العرض العام: بطاقات الشهادات المعتمدة بأسماء محولة (بلا أسماء كاملة — سياسة الخصوصية)
 * — للإدارة/المساعد: لوحة تحرير كاملة (إضافة/اعتماد/تعديل/حذف) مع الاسم الحقيقي سرياً
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Quote, Star, Plus, Pencil, Trash2, ShieldCheck, Sparkles, Loader2, CheckCircle2, XCircle,
} from "lucide-react";
import type { Navigate } from "@/lib/nav";

type Item = {
  _id: string;
  author: string;
  authorReal?: string;
  text: string;
  textFr: string;
  textEn: string;
  rating: number;
  kind: "testimonial" | "story";
  approved: boolean;
  at?: string;
};

const STARS = [1, 2, 3, 4, 5];

export default function Testimonials({ navigate }: { navigate: Navigate }) {
  const { t, lang, me } = useApp();
  const isStaff = !!me && (me.role === "admin" || me.role === "assistant");
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/testimonials", { cache: "no-store" });
      if (r.ok) setItems((await r.json()).items || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const isNew = !editing._id;
      const res = await fetch(isNew ? "/api/testimonials" : `/api/testimonials?id=${editing._id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditing(null);
        load();
      } else {
        alert(j.error || t("common.error"));
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t("testi.confirmDelete"))) return;
    setBusy(true);
    try {
      await fetch(`/api/testimonials?id=${id}`, { method: "DELETE" });
      load();
    } finally {
      setBusy(false);
    }
  };

  const toggleApprove = async (it: Item) => {
    setBusy(true);
    try {
      await fetch(`/api/testimonials?id=${it._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: !it.approved }),
      });
      load();
    } finally {
      setBusy(false);
    }
  };

  const pickText = (i: Item) =>
    lang === "fr" ? i.textFr || i.text : lang === "en" ? i.textEn || i.text : i.text;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <BackButton onBack={() => navigate("home")} />
        <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2">
          <Quote className="h-5 w-5 text-primary" />
          {t("testi.title")}
        </h1>
        {isStaff && (
          <Button onClick={() => setEditing({ rating: 5, kind: "testimonial", approved: false })} className="ms-auto rounded-full gap-1.5">
            <Plus className="h-4 w-4" /> {t("testi.add")}
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground font-semibold max-w-2xl leading-relaxed">
        {t("testi.subtitle")}
      </p>

      {!items ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 rounded-3xl" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="ait-card rounded-3xl">
          <CardContent className="p-10 text-center space-y-3">
            <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="font-bold">{t("testi.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((it) => (
            <Card key={it._id} className={cn("ait-card rounded-3xl shadow-sm relative overflow-hidden", !it.approved && "border-dashed")}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Quote className="h-6 w-6 text-primary/30" />
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {it.kind === "story" && (
                      <Badge className="rounded-full bg-primary/10 text-primary text-[10px]">{t("testi.story")}</Badge>
                    )}
                    {isStaff && !it.approved && (
                      <Badge variant="outline" className="rounded-full text-[10px] border-amber-500/50 text-amber-600">{t("testi.pending")}</Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-line font-medium">
                  {pickText(it)}
                </p>
                <div className="flex items-center gap-2.5 pt-1">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">
                      {(it.author || "?").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-black text-sm break-words">{it.author}</p>
                    <div className="flex gap-0.5">
                      {STARS.map((s) => (
                        <Star key={s} className={cn("h-3 w-3", s <= (it.rating || 5) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                      ))}
                    </div>
                  </div>
                  {isStaff && (
                    <div className="ms-auto flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => toggleApprove(it)} disabled={busy} title={t("testi.approve")}>
                        {it.approved ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setEditing({ ...it })} title={t("common.edit")}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-red-600" onClick={() => remove(it._id)} disabled={busy} title={t("common.delete")}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                {isStaff && it.authorReal && it.authorReal !== it.author && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 border-t pt-2">
                    <ShieldCheck className="h-3 w-3" /> {t("testi.realName")}: {it.authorReal}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* نافذة الإضافة/التعديل — للإدارة */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?._id ? t("testi.edit") : t("testi.add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("testi.authorReal")}</Label>
                <Input value={editing?.authorReal || ""} onChange={(e) => setEditing((v) => ({ ...v, authorReal: e.target.value }))} placeholder={t("testi.authorRealPh")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("testi.authorPublic")}</Label>
                <Input value={editing?.author || ""} onChange={(e) => setEditing((v) => ({ ...v, author: e.target.value }))} placeholder={t("testi.authorPublicPh")} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{t("testi.anonNote")}</p>
            <div className="space-y-1.5">
              <Label>{t("testi.text")}</Label>
              <Textarea rows={4} value={editing?.text || ""} onChange={(e) => setEditing((v) => ({ ...v, text: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("testi.textFr")}</Label>
                <Textarea rows={3} value={editing?.textFr || ""} onChange={(e) => setEditing((v) => ({ ...v, textFr: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("testi.textEn")}</Label>
                <Textarea rows={3} value={editing?.textEn || ""} onChange={(e) => setEditing((v) => ({ ...v, textEn: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="space-y-1.5">
                <Label>{t("testi.rating")}</Label>
                <div className="flex gap-1">
                  {STARS.map((s) => (
                    <button key={s} type="button" onClick={() => setEditing((v) => ({ ...v, rating: s }))} className="p-0.5">
                      <Star className={cn("h-5 w-5 transition", s <= (editing?.rating || 5) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("testi.kind")}</Label>
                <div className="flex gap-2">
                  <Button variant={editing?.kind !== "story" ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setEditing((v) => ({ ...v, kind: "testimonial" }))}>
                    {t("testi.testimonial")}
                  </Button>
                  <Button variant={editing?.kind === "story" ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setEditing((v) => ({ ...v, kind: "story" }))}>
                    {t("testi.story")}
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 ms-auto">
                <Switch checked={!!editing?.approved} onCheckedChange={(v) => setEditing((x) => ({ ...x, approved: v }))} id="ap" />
                <Label htmlFor="ap" className="cursor-pointer">{t("testi.approved")}</Label>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

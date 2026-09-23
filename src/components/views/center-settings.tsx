"use client";
/**
 * إعدادات المركز — للإدارة: معلومات + تواصل + موقع GPS/خريطة + سوشيال + لغات On/Off
 * + خيارات الحقول + سلايدر الوسائط + صفحات المحتوى (FAQ/عن المركز/خصوصية/شروط)
 */
import { useEffect, useState } from "react";
import { useApp, type CenterSettings, type TriCat, type DayHours } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import MapPicker from "@/components/map-picker";
import ImageInput from "@/components/image-input";
import MediaInput from "@/components/media-input";
import { TriInput, TriTextarea, triFrom, flattenTri, LANG_FLAGS, LANG_NAMES } from "@/components/tri-input";
import type { Tri } from "@/components/tri-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Trash2, X, Building2, Save, Images, MapPin, Share2, Languages, SlidersHorizontal, FileStack, Lock, Stethoscope, Sparkles, Pencil, Quote as QuoteIcon, Clock, Copy } from "lucide-react";
import { toast } from "sonner";
import type { Navigate } from "@/lib/nav";

const emptyTri: Tri = { ar: "", fr: "", en: "", tr: "", es: "" };
type SpecialtyRow = { _id: string; ar: string; fr?: string; en?: string; tr?: string; es?: string; builtin: boolean };

type PageItem = { q?: string; a?: string; title?: string; text?: string };
type QuoteRow = { id: string; textAr: string; textFr?: string; textEn?: string; textTr?: string; textEs?: string; author: string; active: boolean };
type PageLang = "ar" | "fr" | "en" | "tr" | "es";

export default function CenterSettings({ navigate }: { navigate: Navigate }) {
  const { t, settings, refreshSettings, me } = useApp();
  const [form, setForm] = useState<CenterSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [pages, setPages] = useState<Record<string, PageItem[]>>({});
  const [pageLang, setPageLang] = useState<PageLang>("ar");

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  useEffect(() => {
    /* تحميل الصفحات حسب اللغة المختارة للتحرير */
    const keys = ["faq", "about", "privacy", "terms"];
    Promise.all(
      keys.map((k) =>
        fetch(`/api/pages?key=${k}&lang=${pageLang}`)
          .then((r) => r.json())
          .then((j) => [k, j.items || []] as const)
      )
    )
      .then((rows) => setPages(Object.fromEntries(rows)))
      .catch(() => {});
  }, [pageLang]);

  if (!me || (me.role !== "admin" && me.role !== "assistant")) {
    return <p className="text-center text-muted-foreground py-16">{t("common.error")}</p>;
  }
  if (!form) return <p className="text-center text-muted-foreground py-16">{t("common.loading")}</p>;

  const upd = (patch: Partial<CenterSettings>) => setForm({ ...form, ...patch });

  const save = async () => {
    setBusy(true);
    const r = await fetch("/api/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (r.ok) { toast.success(t("toast.settingsSaved")); refreshSettings(); }
    else toast.error(t("common.error"));
  };

  const savePage = async (key: string, items: PageItem[]) => {
    const r = await fetch("/api/pages", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, lang: pageLang, items }),
    });
    if (r.ok) toast.success(t("toast.settingsSaved"));
  };

  /* تحرير قائمة وسائط السلايدر — النظام v3: رفع فوري للقرص + روابط خفيفة في الإعدادات */
  const slider = form.sliderMedia || [];
  const updSlider = (arr: typeof slider) => upd({ sliderMedia: arr });
  const addSliderRow = () =>
    updSlider([...slider, { type: "image", url: "", data: "", title: "" }]);
  const mediaSrc = (m: typeof slider[number]) => m.url || m.data;
  const mediaType = (m: typeof slider[number]): "image" | "video" =>
    m.url ? (/\.(mp4|webm|mov)$/i.test(m.url) ? "video" : "image") : m.type;

  /* تحرير خيارات القوائم */
  const opt = form.options;
  const updOpt = (patch: Partial<CenterSettings["options"]>) => upd({ options: { ...opt, ...patch } });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BackButton onBack={() => navigate("home")} />
        <h1 className="text-xl sm:text-2xl font-black">{t("set.centerSettings")}</h1>
      </div>
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        {t("set.noAdminHint")}
      </p>

      <Tabs defaultValue="general" dir="rtl">
        <TabsList className="h-auto flex-wrap justify-start w-full bg-muted/60">
          <TabsTrigger value="general" className="gap-1.5"><Building2 className="h-4 w-4" />{t("set.general")}</TabsTrigger>
          <TabsTrigger value="media" className="gap-1.5"><Images className="h-4 w-4" />{t("set.slider")}</TabsTrigger>
          <TabsTrigger value="location" className="gap-1.5"><MapPin className="h-4 w-4" />{t("set.location")}</TabsTrigger>
          <TabsTrigger value="social" className="gap-1.5"><Share2 className="h-4 w-4" />{t("set.social")}</TabsTrigger>
          <TabsTrigger value="specialties" className="gap-1.5"><Stethoscope className="h-4 w-4" />{t("set.specialties")}</TabsTrigger>
          <TabsTrigger value="quotes" className="gap-1.5"><Sparkles className="h-4 w-4" />{t("set.quotes")}</TabsTrigger>
          <TabsTrigger value="langs" className="gap-1.5"><Languages className="h-4 w-4" />{t("set.languages")}</TabsTrigger>
          <TabsTrigger value="options" className="gap-1.5"><SlidersHorizontal className="h-4 w-4" />{t("set.options")}</TabsTrigger>
          <TabsTrigger value="pages" className="gap-1.5"><FileStack className="h-4 w-4" />{t("set.legal")}</TabsTrigger>
        </TabsList>

        {/* ── معلومات عامة (ثلاثية اللغة) ── */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <TriInput
            label={t("set.centerName")}
            value={triFrom(form as unknown as Record<string, unknown>, "centerName")}
            onChange={(v) => upd({ ...flattenTri("centerName", v) } as Partial<CenterSettings>)}
          />
          <TriInput
            label={t("set.tagline")}
            value={triFrom(form as unknown as Record<string, unknown>, "tagline")}
            onChange={(v) => upd({ ...flattenTri("tagline", v) } as Partial<CenterSettings>)}
          />
          <TriTextarea
            label={t("set.aboutShort")}
            value={triFrom(form as unknown as Record<string, unknown>, "aboutShort")}
            onChange={(v) => upd({ ...flattenTri("aboutShort", v) } as Partial<CenterSettings>)}
            rows={2}
          />
          <div className="space-y-2">
            <Label>{t("set.logo")}</Label>
            <ImageInput value={form.logoBase64} onChange={(v) => upd({ logoBase64: v })} maxWidth={400} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("common.phone")}</Label>
              <Input dir="ltr" value={form.phone} onChange={(e) => upd({ phone: e.target.value })} className="h-11 text-start" />
            </div>
            <div className="space-y-2">
              <Label>{t("set.whatsappNum")}</Label>
              <Input dir="ltr" value={form.whatsapp} onChange={(e) => upd({ whatsapp: e.target.value })} className="h-11 text-start" placeholder="213xxxxxxxxx" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("nav.contact")} — Email</Label>
              <Input dir="ltr" type="email" value={form.email} onChange={(e) => upd({ email: e.target.value })} className="h-11 text-start" />
            </div>
          </div>
          <TriInput
            label={t("landing.location")}
            value={triFrom(form as unknown as Record<string, unknown>, "address")}
            onChange={(v) => upd({ ...flattenTri("address", v) } as Partial<CenterSettings>)}
          />
          <div className="space-y-2">
            <Label>{t("set.mapsUrl")}</Label>
            <Input
              dir="ltr"
              value={form.mapsUrl || ""}
              onChange={(e) => upd({ mapsUrl: e.target.value })}
              className="h-11 text-start"
              placeholder="https://maps.app.goo.gl/…"
            />
            <p className="text-xs text-muted-foreground leading-relaxed">{t("set.mapsUrlHint")}</p>
          </div>
          <Button onClick={save} disabled={busy} className="w-full sm:w-auto h-12 rounded-xl gap-2 px-8 text-base">
            <Save className="h-4.5 w-4.5" /> {busy ? t("common.saving") : t("common.save")}
          </Button>
        </TabsContent>

        {/* ── سلايدر الوسائط ── */}
        <TabsContent value="media" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">{t("set.sliderHint")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={addSliderRow} className="gap-2 rounded-xl">
              <Plus className="h-4.5 w-4.5" /> {t("media.add")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("media.hint")}</p>
          </div>
          {slider.length === 0 && (
            <p className="text-sm text-muted-foreground/70 rounded-2xl border-2 border-dashed p-8 text-center">{t("media.empty")}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {slider.map((m, i) => (
              <Card key={i} className="overflow-hidden rounded-2xl">
                <CardContent className="p-3 space-y-3">
                  {mediaSrc(m) ? (
                    <div className="relative h-40 bg-muted rounded-xl overflow-hidden">
                      {mediaType(m) === "video" ? (
                        <video src={mediaSrc(m)} className="h-full w-full object-cover" muted playsInline controls />
                      ) : (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={mediaSrc(m)} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl opacity-40" />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={mediaSrc(m)} alt={m.title || ""} className="relative h-full w-full object-contain" />
                        </>
                      )}
                      <Badge className="absolute top-2 start-2 bg-background/90 z-10">{mediaType(m) === "video" ? "Video" : "Image"}</Badge>
                    </div>
                  ) : (
                    <MediaInput
                      value=""
                      onChange={(url) =>
                        updSlider(
                          slider.map((x, k) =>
                            k === i
                              ? { ...x, url, data: "", type: /\.(mp4|webm|mov)$/i.test(url) ? ("video" as const) : ("image" as const) }
                              : x
                          )
                        )
                      }
                      label={t("media.pick")}
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <Input value={m.title} onChange={(e) => updSlider(slider.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))}
                      placeholder={t("common.title")} className="h-9 text-sm" />
                    <Button size="icon" variant="destructive" className="h-9 w-9 rounded-xl shrink-0"
                      onClick={() => updSlider(slider.filter((_, k) => k !== i))} aria-label={t("common.delete")}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button onClick={save} disabled={busy} className="w-full sm:w-auto h-12 rounded-xl gap-2 px-8 text-base">
            <Save className="h-4.5 w-4.5" /> {busy ? t("common.saving") : t("common.save")}
          </Button>
        </TabsContent>

        {/* ── الموقع ── */}
        <TabsContent value="location" className="space-y-4 mt-4">
          <MapPicker
            lat={form.lat} lng={form.lng}
            onChange={(lat, lng) => upd({ lat, lng })}
          />
          <p className="text-xs text-muted-foreground tabular-nums" dir="ltr">
            Lat: {form.lat.toFixed(5)} — Lng: {form.lng.toFixed(5)}
          </p>
          <Button onClick={save} disabled={busy} className="w-full sm:w-auto h-12 rounded-xl gap-2 px-8 text-base">
            <Save className="h-4.5 w-4.5" /> {busy ? t("common.saving") : t("common.save")}
          </Button>
        </TabsContent>

        {/* ── سوشيال ── */}
        <TabsContent value="social" className="space-y-4 mt-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {([
              ["facebook", "Facebook"], ["instagram", "Instagram"], ["tiktok", "TikTok"],
              ["youtube", "YouTube"], ["telegram", "Telegram"],
            ] as const).map(([k, label]) => (
              <div key={k} className="space-y-2">
                <Label dir="ltr" className="text-start">{label}</Label>
                <Input dir="ltr" value={form.social[k]} onChange={(e) => upd({ social: { ...form.social, [k]: e.target.value } })} className="h-11 text-start" placeholder="https://…" />
              </div>
            ))}
          </div>
          <Button onClick={save} disabled={busy} className="w-full sm:w-auto h-12 rounded-xl gap-2 px-8 text-base">
            <Save className="h-4.5 w-4.5" /> {busy ? t("common.saving") : t("common.save")}
          </Button>
        </TabsContent>

        {/* ── التخصصات (افتراضية دائمة + إضافات الإدارة) ── */}
        <TabsContent value="specialties" className="mt-4">
          <SpecialtiesManager />
        </TabsContent>

        {/* ── العبارات الترحيبية (نمط طمأنينة) ── */}
        <TabsContent value="quotes" className="mt-4">
          <QuotesManager />
        </TabsContent>

        {/* ── اللغات ── */}
        <TabsContent value="langs" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">{t("set.langHint")}</p>
          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-2xl border p-4">
              <span className="font-bold">{LANG_NAMES.ar}</span>
              <Switch checked disabled />
            </label>
            <label className="flex items-center justify-between rounded-2xl border p-4">
              <span className="font-bold">{t("set.langFr")}</span>
              <Switch checked={form.langFr} onCheckedChange={(v) => upd({ langFr: v })} />
            </label>
            <label className="flex items-center justify-between rounded-2xl border p-4">
              <span className="font-bold">{t("set.langEn")}</span>
              <Switch checked={form.langEn} onCheckedChange={(v) => upd({ langEn: v })} />
            </label>
            <label className="flex items-center justify-between rounded-2xl border p-4">
              <span className="font-bold flex items-center gap-2"><span aria-hidden="true">{LANG_FLAGS.tr}</span>{t("set.langTr")}</span>
              <Switch checked={form.langTr !== false} onCheckedChange={(v) => upd({ langTr: v })} />
            </label>
            <label className="flex items-center justify-between rounded-2xl border p-4">
              <span className="font-bold flex items-center gap-2"><span aria-hidden="true">{LANG_FLAGS.es}</span>{t("set.langEs")}</span>
              <Switch checked={form.langEs !== false} onCheckedChange={(v) => upd({ langEs: v })} />
            </label>
          </div>
          <Button onClick={save} disabled={busy} className="w-full sm:w-auto h-12 rounded-xl gap-2 px-8 text-base">
            <Save className="h-4.5 w-4.5" /> {busy ? t("common.saving") : t("common.save")}
          </Button>
        </TabsContent>

        {/* ── خيارات الحقول ── */}
        <TabsContent value="options" className="space-y-5 mt-4">
          <TriCatList
            label={t("set.optServiceCat")}
            values={opt.serviceCategories}
            onChange={(v) => updOpt({ serviceCategories: v })}
          />
          <TriCatList
            label={t("set.optCourseCat")}
            values={opt.courseCategories}
            onChange={(v) => updOpt({ courseCategories: v })}
          />
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>{t("set.slotMinutes")}</Label>
              <Input type="number" min={15} step={5} value={opt.slotMinutes} onChange={(e) => updOpt({ slotMinutes: Number(e.target.value) })} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>{t("set.dayStart")}</Label>
              <Input type="time" value={opt.dayStart} onChange={(e) => updOpt({ dayStart: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>{t("set.dayEnd")}</Label>
              <Input type="time" value={opt.dayEnd} onChange={(e) => updOpt({ dayEnd: e.target.value })} className="h-11" />
            </div>
          </div>
          <DayHoursEditor
            dayHours={opt.dayHours || {}}
            dayStart={opt.dayStart}
            dayEnd={opt.dayEnd}
            onChange={(v) => updOpt({ dayHours: v })}
          />
          <Button onClick={save} disabled={busy} className="w-full sm:w-auto h-12 rounded-xl gap-2 px-8 text-base">
            <Save className="h-4.5 w-4.5" /> {busy ? t("common.saving") : t("common.save")}
          </Button>
        </TabsContent>

        {/* ── صفحات المحتوى (ثلاثي اللغة) ── */}
        <TabsContent value="pages" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{t("header.language")}:</span>
            <div className="flex items-center gap-1 rounded-full border bg-muted/50 p-1">
              {(["ar", "fr", "en", "tr", "es"] as const).map((lg) => (
                <button key={lg} type="button" onClick={() => setPageLang(lg)}
                  className={"min-w-11 h-8 rounded-full text-xs font-bold transition-all " +
                    (pageLang === lg ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-accent")}>
                  {lg === "ar" ? "ع" : lg.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <Accordion type="multiple" className="space-y-3">
            {/* FAQ */}
            <AccordionItem value="faq" className="rounded-2xl border px-4 bg-card">
              <AccordionTrigger className="font-bold">{t("fbt.faq")}</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <FaqEditor items={(pages.faq || []) as { q: string; a: string }[]} onSave={(items) => savePage("faq", items)} />
              </AccordionContent>
            </AccordionItem>
            {(["about", "privacy", "terms"] as const).map((key) => (
              <AccordionItem key={key} value={key} className="rounded-2xl border px-4 bg-card">
                <AccordionTrigger className="font-bold">{t(`fbt.${key}`)}</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <SectionsEditor items={(pages[key] || []) as { title: string; text: string }[]} onSave={(items) => savePage(key, items)} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── مدير التخصصات: الافتراضية الدائمة (ثابتة) + إضافات الإدارة بثلاث لغات ── */
function SpecialtiesManager() {
  const { t, lang } = useApp();
  const [rows, setRows] = useState<SpecialtyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSpec, setNewSpec] = useState<Tri>(emptyTri);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const r = await fetch("/api/specialties", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setRows(j.specialties || []);
      }
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newSpec.ar.trim()) { toast.error(t("err.required")); return; }
    setBusy(true);
    const r = await fetch("/api/specialties", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSpec),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { toast.success(t("toast.specialtyAdded")); setNewSpec(emptyTri); load(); }
    else toast.error(j.error || t("common.error"));
  };

  const remove = async (id: string) => {
    const r = await fetch(`/api/specialties?id=${id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { toast.success(t("toast.specialtyDeleted")); load(); }
    else toast.error(j.error || t("common.error"));
  };

  const nameOf = (sp: SpecialtyRow) => {
    const v =
      lang === "fr" ? sp.fr :
      lang === "en" ? sp.en :
      lang === "tr" ? (sp.tr || sp.en || sp.fr) :
      lang === "es" ? (sp.es || sp.en || sp.fr) :
      sp.ar;
    return v || sp.ar;
  };

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">{t("set.specHint")}</p>

      {/* إضافة تخصص جديد بثلاث لغات */}
      <Card className="rounded-2xl border-primary/20 bg-primary/[0.03]">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-black flex items-center gap-1.5">
            <Plus className="h-4 w-4 text-primary" />
            {t("set.addSpecialty")}
          </p>
          <TriInput label={t("set.specialtyName")} value={newSpec} onChange={setNewSpec} />
          <Button onClick={add} disabled={busy} className="w-full sm:w-auto rounded-xl gap-2">
            <Plus className="h-4 w-4" /> {busy ? t("common.saving") : t("common.add")}
          </Button>
        </CardContent>
      </Card>

      {/* القائمة */}
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((sp) => (
            <div
              key={sp._id}
              className="flex items-center gap-2.5 rounded-xl border bg-card p-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Stethoscope className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{nameOf(sp)}</p>
                <p className="truncate text-[11px] text-muted-foreground" dir="ltr">
                  <span aria-hidden="true">{LANG_FLAGS.ar}</span> {sp.ar}
                  {sp.fr && <> · <span aria-hidden="true">{LANG_FLAGS.fr}</span> {sp.fr}</>}
                  {sp.en && <> · <span aria-hidden="true">{LANG_FLAGS.en}</span> {sp.en}</>}
                  {sp.tr && <> · <span aria-hidden="true">{LANG_FLAGS.tr}</span> {sp.tr}</>}
                  {sp.es && <> · <span aria-hidden="true">{LANG_FLAGS.es}</span> {sp.es}</>}
                </p>
              </div>
              {sp.builtin ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground" title={t("set.builtinLock")}>
                  <Lock className="h-3 w-3" /> {t("set.builtin")}
                </span>
              ) : (
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive"
                  onClick={() => remove(sp._id)} aria-label={t("common.delete")}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── مدير العبارات الترحيبية «لحظة اطمئنان» — نمط طمأنينة ──
 * مكتبة تديرها الإدارة: إضافة/تعديل/تفعيل/حذف بثلاث لغات + مؤلف اختياري
 * تُزرع المكتبة المدمجة تلقائياً عند أول تشغيل، وتبقى تعديلات الإدارة محفوظة
 */
function QuotesManager() {
  const { t, lang } = useApp();
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<QuoteRow | null>(null);
  const [form, setForm] = useState({ textAr: "", textFr: "", textEn: "", textTr: "", textEs: "", author: "" });
  const [busy, setBusy] = useState(false);
  const [delTarget, setDelTarget] = useState<QuoteRow | null>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list-all" }),
      });
      if (r.ok) {
        const j = await r.json();
        setRows(j.quotes || []);
      }
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ textAr: "", textFr: "", textEn: "", textTr: "", textEs: "", author: "" });
  };
  const openEdit = (q: QuoteRow) => {
    setEditing(q);
    setForm({ textAr: q.textAr, textFr: q.textFr || "", textEn: q.textEn || "", textTr: q.textTr || "", textEs: q.textEs || "", author: q.author || "" });
  };

  const save = async () => {
    if (!form.textAr.trim()) { toast.error(t("err.required")); return; }
    setBusy(true);
    const r = await fetch("/api/quotes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { action: "update", id: editing.id, ...form } : { action: "create", ...form }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      toast.success(editing ? t("toast.quoteUpdated") : t("toast.quoteAdded"));
      setEditing(null);
      openNew();
      load();
    } else toast.error(j.error || t("common.error"));
  };

  const toggle = async (q: QuoteRow) => {
    const r = await fetch("/api/quotes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id: q.id, active: !q.active }),
    });
    if (r.ok) load();
  };

  const remove = async (q: QuoteRow) => {
    const r = await fetch("/api/quotes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: q.id }),
    });
    if (r.ok) { toast.success(t("toast.quoteDeleted")); setDelTarget(null); load(); }
  };

  const showTri = (q: QuoteRow) =>
    lang === "fr" ? (q.textFr || q.textAr)
      : lang === "en" ? (q.textEn || q.textAr)
      : lang === "tr" ? (q.textTr || q.textEn || q.textFr || q.textAr)
      : lang === "es" ? (q.textEs || q.textEn || q.textFr || q.textAr)
      : q.textAr;

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">{t("set.quotesHint")}</p>

      {/* نموذج الإضافة/التعديل */}
      <Card className="rounded-2xl border-primary/20 bg-primary/[0.03]">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-black flex items-center gap-1.5">
            <Plus className="h-4 w-4 text-primary" />
            {editing ? t("set.quoteEdit") : t("set.quoteAdd")}
          </p>
          <TriInput label={t("set.quoteText")}
            value={{ ar: form.textAr, fr: form.textFr, en: form.textEn, tr: form.textTr, es: form.textEs }}
            onChange={(v) => setForm({ ...form, textAr: v.ar, textFr: v.fr, textEn: v.en, textTr: v.tr, textEs: v.es })} />
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label>{t("set.quoteAuthor")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
              <Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="h-11" />
            </div>
            <div className="flex gap-2">
              {editing && (
                <Button variant="outline" onClick={() => { setEditing(null); openNew(); }} className="h-11 rounded-xl">
                  {t("common.cancel")}
                </Button>
              )}
              <Button onClick={save} disabled={busy} className="h-11 rounded-xl gap-2">
                <Plus className="h-4 w-4" /> {busy ? t("common.saving") : editing ? t("common.save") : t("common.add")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* القائمة */}
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">{t("set.quotesEmpty")}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {rows.map((q) => (
            <Card key={q.id} className={"rounded-2xl " + (!q.active ? "opacity-60" : "")}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <QuoteIcon className="h-4 w-4 text-primary shrink-0" />
                  {!q.active && <Badge variant="outline" className="text-[10px] font-bold text-amber-600 border-amber-500/40">{t("common.inactive")}</Badge>}
                  <div className="ms-auto flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-8 rounded-lg font-bold gap-1.5" onClick={() => openEdit(q)}>
                      <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 rounded-lg font-bold" onClick={() => toggle(q)}>
                      {q.active ? t("common.deactivate") : t("common.activate")}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDelTarget(q)} aria-label={t("common.delete")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm font-bold leading-relaxed" dir="auto">{showTri(q)}</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground" dir="ltr">
                  <span aria-hidden="true">{LANG_FLAGS.ar}</span> {q.textAr}
                  {q.textFr && <> · <span aria-hidden="true">{LANG_FLAGS.fr}</span> {q.textFr}</>}
                  {q.textEn && <> · <span aria-hidden="true">{LANG_FLAGS.en}</span> {q.textEn}</>}
                  {q.textTr && <> · <span aria-hidden="true">{LANG_FLAGS.tr}</span> {q.textTr}</>}
                  {q.textEs && <> · <span aria-hidden="true">{LANG_FLAGS.es}</span> {q.textEs}</>}
                </p>
                {q.author && (
                  <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground" dir="auto">{q.author}</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* تأكيد الحذف */}
      {delTarget && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-foreground/30 p-4" onClick={() => setDelTarget(null)}>
          <div className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-black">{t("common.confirmDelete")}</p>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed" dir="auto">{showTri(delTarget)}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDelTarget(null)}>{t("common.cancel")}</Button>
              <Button variant="destructive" onClick={() => remove(delTarget)}>{t("common.delete")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── قائمة تصنيفات خماسية اللغة (إضافة/حذف — كل عنصر { ar, fr, en, tr, es }) ── */
function TriCatList({ label, values, onChange }: { label: string; values: TriCat[]; onChange: (v: TriCat[]) => void }) {
  const { t, lang } = useApp();
  const [nv, setNv] = useState<Tri>(emptyTri);
  const list = values || [];
  const nameOf = (c: TriCat) =>
    lang === "fr" ? (c.fr || c.ar)
      : lang === "en" ? (c.en || c.ar)
      : lang === "tr" ? (c.tr || c.en || c.fr || c.ar)
      : lang === "es" ? (c.es || c.en || c.fr || c.ar)
      : c.ar;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground leading-relaxed">{t("set.catTriHint")}</p>
      <div className="flex flex-wrap gap-2">
        {list.map((c, i) => (
          <span key={i} className="flex max-w-full items-center gap-1 rounded-full border bg-card ps-3 pe-1 py-1 text-sm">
            <span className="break-words whitespace-normal leading-snug">{nameOf(c)}</span>
            <button type="button" onClick={() => onChange(list.filter((_, k) => k !== i))}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-destructive/10 text-destructive" aria-label={t("common.delete")}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="ait-tri space-y-2 rounded-xl border bg-card/40 p-2.5">
        {(["ar", "fr", "en", "tr", "es"] as const).map((l) => (
          <div key={l} className="flex items-center gap-2">
            <span className="flex w-11 shrink-0 items-center justify-center gap-1 rounded-md bg-muted/70 py-1 text-[11px] font-black text-muted-foreground" title={LANG_NAMES[l]}>
              <span aria-hidden="true">{LANG_FLAGS[l]}</span>
              <span className={l === "ar" ? "" : "tracking-wide"}>{l === "ar" ? "ع" : l.toUpperCase()}</span>
            </span>
            <Input dir={l === "ar" ? "rtl" : "ltr"} value={nv[l]} onChange={(e) => setNv({ ...nv, [l]: e.target.value })}
              placeholder={l === "ar" ? t("common.add") : l === "fr" ? "Français…" : l === "en" ? "English…" : l === "tr" ? "Türkçe…" : "Español…"} className="h-10" />
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" className="gap-1.5 self-start"
          onClick={() => {
            if (!nv.ar.trim()) { toast.error(t("err.required")); return; }
            onChange([...list, { ar: nv.ar.trim(), fr: nv.fr.trim(), en: nv.en.trim(), tr: nv.tr.trim(), es: nv.es.trim() }]);
            setNv(emptyTri);
          }}>
          <Plus className="h-4 w-4" /> {t("common.add")}
        </Button>
      </div>
    </div>
  );
}

/* ── محرر أوقات كل يوم من الأسبوع — طلب المستخدم: الأحد 09:00-18:00، الاثنين 10:00-17:00 ──
 * لكل يوم: إغلاق/فتح + بداية + نهاية. اليوم بلا إدخال يسقط على أوقات المركز العامة.
 */
const DAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;

function DayHoursEditor({
  dayHours, dayStart, dayEnd, onChange,
}: {
  dayHours: Record<string, DayHours>;
  dayStart: string;
  dayEnd: string;
  onChange: (v: Record<string, DayHours>) => void;
}) {
  const { t, lang } = useApp();
  const dayNames =
    lang === "ar"
      ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
      : lang === "fr"
        ? ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
        : lang === "tr"
          ? ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"]
          : lang === "es"
            ? ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
            : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const get = (k: string): DayHours | null => dayHours[k] || null;
  const set = (k: string, v: DayHours | null) => {
    const next = { ...dayHours };
    if (v) next[k] = v;
    else delete next[k];
    onChange(next);
  };

  const copyDefaultToAll = () => {
    const next: Record<string, DayHours> = {};
    DAY_KEYS.forEach((k) => { next[k] = { start: dayStart, end: dayEnd, closed: false }; });
    onChange(next);
    toast.success(t("set.dayHoursCopied"));
  };

  return (
    <div className="space-y-3 rounded-2xl border p-4 bg-card/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-black flex items-center gap-1.5 text-sm">
          <Clock className="h-4 w-4 text-primary" /> {t("set.dayHoursTitle")}
        </p>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={copyDefaultToAll}>
          <Copy className="h-3.5 w-3.5" /> {t("set.dayHoursCopyAll")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{t("set.dayHoursHint")}</p>
      <div className="space-y-2">
        {DAY_KEYS.map((k) => {
          const cur = get(k);
          const closed = cur?.closed ?? false;
          const start = cur?.start ?? dayStart;
          const end = cur?.end ?? dayEnd;
          const isCustom = !!cur;
          return (
            <div key={k} className={"flex flex-wrap items-center gap-2 rounded-xl border p-2.5 " + (closed ? "bg-muted/40 opacity-70" : "bg-background")}>
              <span className="w-20 shrink-0 text-sm font-bold">{dayNames[Number(k)]}</span>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Switch checked={!closed} onCheckedChange={(v) => set(k, { start, end, closed: !v })} />
                {closed ? t("set.dayClosed") : t("set.dayOpen")}
              </label>
              <div className="flex items-center gap-1.5 ms-auto">
                <Input type="time" value={start} disabled={closed}
                  onChange={(e) => set(k, { start: e.target.value, end, closed })}
                  className="h-9 w-[7.2rem] text-center tabular-nums" dir="ltr" />
                <span className="text-muted-foreground font-bold">—</span>
                <Input type="time" value={end} disabled={closed}
                  onChange={(e) => set(k, { start, end: e.target.value, closed })}
                  className="h-9 w-[7.2rem] text-center tabular-nums" dir="ltr" />
                <button
                  type="button"
                  title={isCustom ? t("set.dayHoursReset") : t("set.dayHoursCustomize")}
                  onClick={() => set(k, isCustom ? null : { start: dayStart, end: dayEnd, closed: false })}
                  className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors " +
                    (isCustom ? "text-primary border-primary/40 bg-primary/10" : "text-muted-foreground hover:bg-muted")}
                >
                  {isCustom ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-4 w-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* محرر الأسئلة الشائعة */
function FaqEditor({ items, onSave }: { items: { q: string; a: string }[]; onSave: (items: { q: string; a: string }[]) => void }) {
  const { t } = useApp();
  const [list, setList] = useState(items);
  useEffect(() => setList(items), [items]);
  return (
    <div className="space-y-3">
      {list.map((it, i) => (
        <div key={i} className="rounded-xl border p-3 space-y-2 bg-muted/20">
          <div className="flex gap-2">
            <Input value={it.q} onChange={(e) => setList(list.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)))}
              placeholder={t("set.question")} className="h-10 font-semibold" />
            <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 text-destructive"
              onClick={() => setList(list.filter((_, k) => k !== i))} aria-label={t("common.delete")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Textarea value={it.a} onChange={(e) => setList(list.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)))}
            placeholder={t("set.answer")} rows={2} />
        </div>
      ))}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setList([...list, { q: "", a: "" }])}>
          <Plus className="h-4 w-4" /> {t("set.addItem")}
        </Button>
        <Button size="sm" onClick={() => onSave(list)} className="gap-1.5">
          <Save className="h-4 w-4" /> {t("common.save")}
        </Button>
      </div>
    </div>
  );
}

/* محرر أقسام نصية (عن المركز/الخصوصية/الشروط) */
function SectionsEditor({ items, onSave }: { items: { title: string; text: string }[]; onSave: (items: { title: string; text: string }[]) => void }) {
  const { t } = useApp();
  const [list, setList] = useState(items);
  useEffect(() => setList(items), [items]);
  return (
    <div className="space-y-3">
      {list.map((it, i) => (
        <div key={i} className="rounded-xl border p-3 space-y-2 bg-muted/20">
          <div className="flex gap-2">
            <Input value={it.title} onChange={(e) => setList(list.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))}
              placeholder={t("set.sectionTitle")} className="h-10 font-semibold" />
            <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 text-destructive"
              onClick={() => setList(list.filter((_, k) => k !== i))} aria-label={t("common.delete")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Textarea value={it.text} onChange={(e) => setList(list.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
            placeholder={t("set.sectionText")} rows={3} />
        </div>
      ))}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setList([...list, { title: "", text: "" }])}>
          <Plus className="h-4 w-4" /> {t("set.addItem")}
        </Button>
        <Button size="sm" onClick={() => onSave(list)} className="gap-1.5">
          <Save className="h-4 w-4" /> {t("common.save")}
        </Button>
      </div>
    </div>
  );
}

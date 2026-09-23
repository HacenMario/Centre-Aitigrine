"use client";
/**
 * صفحة «اتصل بالمركز» — تُملأ تلقائياً من إعدادات المركز:
 * الهاتف، واتساب، البريد، العنوان، ساعات العمل، الشبكات الاجتماعية، خريطة Google
 * + نموذج رسالة يصل للإدارة عبر الاقتراحات والبلاغات
 */
import { useEffect, useState } from "react";
import { useApp, type DayHours } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { SocialLinks } from "@/components/social-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin, Phone, Mail, Clock, Send, Globe, MessageSquareHeart, CheckCircle2,
} from "lucide-react";
import { gmapsEmbed, gmapsLink } from "@/components/map-picker";
import { toast } from "sonner";

export default function Contact({ navigate }: { navigate?: (v: "feedback" | "home") => void }) {
  const { t, settings, lang } = useApp();
  const s = settings;
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ait_user");
      if (saved) {
        const u = JSON.parse(saved) as { name?: string; phone?: string };
        if (u.name) setName(u.name);
        if (u.phone) setContact(u.phone);
      }
    } catch {}
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error(t("err.required"));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "suggestion", name, contact, message }),
      });
      if (r.ok) {
        setSent(true);
        setMessage("");
        toast.success(t("contact.sent"));
      } else toast.error(t("common.error"));
    } catch {
      toast.error(t("err.conn"));
    }
    setBusy(false);
  };

  const dayNames =
    lang === "ar"
      ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
      : lang === "fr"
        ? ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
        : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const locale = lang === "ar" ? "ar-DZ" : lang === "fr" ? "fr-FR" : "en-GB";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 min-w-0">
        <BackButton onBack={() => navigate?.("home")} />
        <h1 className="truncate text-xl font-black sm:text-2xl">{t("contact.title")}</h1>
      </div>
      <p className="leading-relaxed text-muted-foreground">{t("contact.sub")}</p>

      {/* بطاقات التواصل السريع — تُملأ من إعدادات المركز تلقائياً */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {s?.phone && (
          <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="ait-card group block">
            <Card className="h-full rounded-2xl border shadow-sm transition-shadow group-hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <Phone className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("contact.phone")}</p>
                  <p className="truncate text-sm font-black" dir="ltr">{s.phone}</p>
                </div>
              </CardContent>
            </Card>
          </a>
        )}
        {s?.whatsapp && (
          <a
            href={`https://wa.me/${s.whatsapp.replace(/[^\d]/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ait-card group block"
          >
            <Card className="h-full rounded-2xl border shadow-sm transition-shadow group-hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 transition-transform group-hover:scale-110">
                  <MessageSquareHeart className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">WhatsApp</p>
                  <p className="truncate text-sm font-black" dir="ltr">{s.whatsapp}</p>
                </div>
              </CardContent>
            </Card>
          </a>
        )}
        {s?.email && (
          <a href={`mailto:${s.email}`} className="ait-card group block">
            <Card className="h-full rounded-2xl border shadow-sm transition-shadow group-hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400 transition-transform group-hover:scale-110">
                  <Mail className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("contact.email")}</p>
                  <p className="truncate text-sm font-black" dir="ltr">{s.email}</p>
                </div>
              </CardContent>
            </Card>
          </a>
        )}
        {s?.address && (
          <a href={s?.mapsUrl?.trim() || gmapsLink(s.lat, s.lng)} target="_blank" rel="noopener noreferrer" className="ait-card group block">
            <Card className="h-full rounded-2xl border shadow-sm transition-shadow group-hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent-foreground transition-transform group-hover:scale-110">
                  <MapPin className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase text-muted-foreground">{t("contact.address")}</p>
                  <p className="text-sm font-black leading-snug break-words">{lang === "ar" ? s.address : s.addressFr || s.addressEn || s.address}</p>
                </div>
              </CardContent>
            </Card>
          </a>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* المعلومات الكاملة + ساعات العمل */}
        <div className="space-y-4">
          <Card className="rounded-3xl">
            <CardContent className="space-y-4 p-6">
              <h3 className="flex items-center gap-2 font-black text-lg">
                <Globe className="h-5 w-5 text-primary" />
                {t("contact.infoTitle")}
              </h3>
              <div className="space-y-3 text-sm">
                {s?.address && (
                  <p className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {/* ★ v3.5: عنوان المركز قابل للضغط — يفتح موقع المركز على خرائط Google */}
                    <a
                      href={s?.mapsUrl?.trim() || gmapsLink(s.lat, s.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-start gap-1 leading-relaxed underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                    >
                      {lang === "ar" ? s.address : s.addressFr || s.addressEn || s.address}
                      <MapPin className="mt-1 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                  </p>
                )}
                {s?.phone && (
                  <p className="flex items-center gap-3">
                    <Phone className="h-4 w-4 shrink-0 text-primary" />
                    <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="hover:text-primary transition-colors" dir="ltr">{s.phone}</a>
                  </p>
                )}
                {s?.email && (
                  <p className="flex items-center gap-3">
                    <Mail className="h-4 w-4 shrink-0 text-primary" />
                    <a href={`mailto:${s.email}`} className="break-all hover:text-primary transition-colors" dir="ltr">{s.email}</a>
                  </p>
                )}
              </div>
              {s?.social && <SocialLinks social={{ ...s.social, whatsapp: s.whatsapp }} size="h-9 w-9" />}
            </CardContent>
          </Card>

          {/* ساعات العمل — أوقات كل يوم من الأسبوع من إعدادات المركز (v3.5) */}
          <Card className="rounded-3xl">
            <CardContent className="space-y-3 p-6">
              <h3 className="flex items-center gap-2 font-black text-lg">
                <Clock className="h-5 w-5 text-primary" />
                {t("contact.hoursTitle")}
              </h3>
              <div className="space-y-1.5 text-sm">
                {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                  const cur = ((s?.options?.dayHours || {}) as Record<string, DayHours>)[String(d)];
                  const closed = cur?.closed ?? false;
                  const hours = closed
                    ? null
                    : `${cur?.start || s?.options?.dayStart || "09:00"} — ${cur?.end || s?.options?.dayEnd || "17:00"}`;
                  const isToday = d === new Date().getDay();
                  return (
                    <p
                      key={d}
                      className={
                        "flex items-center justify-between gap-3 rounded-xl px-3.5 py-2 " +
                        (isToday ? "bg-primary/8 font-bold text-foreground ring-1 ring-primary/20" : closed ? "bg-muted/30 text-muted-foreground" : "bg-muted/40")
                      }
                    >
                      <span className="font-semibold">{dayNames[d]}</span>
                      {hours ? (
                        <span dir="ltr" className="font-black tabular-nums">{hours}</span>
                      ) : (
                        <span className="font-semibold">{t("contact.closed")}</span>
                      )}
                    </p>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* الخريطة + نموذج الرسالة */}
        <div className="space-y-4">
          {s && (
            <Card className="overflow-hidden rounded-3xl p-0">
              <a href={s?.mapsUrl?.trim() || gmapsLink(s.lat, s.lng)} target="_blank" rel="noopener noreferrer" className="group/map relative block min-h-48">
                <iframe
                  title="Google Maps"
                  src={gmapsEmbed(s.lat, s.lng, lang)}
                  className="h-48 min-h-full w-full border-0 pointer-events-none"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <span className="absolute bottom-3 end-3 flex items-center gap-1 rounded-full bg-background/95 px-3 py-1.5 text-xs font-bold text-primary shadow transition-transform group-hover/map:scale-105">
                  <MapPin className="h-3.5 w-3.5" />
                  {t("landing.openMap")}
                </span>
              </a>
            </Card>
          )}

          <Card className="rounded-3xl">
            <CardContent className="space-y-4 p-6">
              <h3 className="flex items-center gap-2 font-black text-lg">
                <Send className="h-5 w-5 text-primary" />
                {t("contact.formTitle")}
              </h3>
              {sent ? (
                <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.05] p-5 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
                  <p className="font-black">{t("contact.sentTitle")}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t("contact.sentBody")}</p>
                  <Button variant="outline" size="sm" onClick={() => setSent(false)}>{t("contact.again")}</Button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3.5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="c-name">{t("common.name")}</Label>
                      <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} className="h-10" placeholder={t("common.name")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c-contact">{t("contact.yourContact")}</Label>
                      <Input id="c-contact" value={contact} onChange={(e) => setContact(e.target.value)} className="h-10" placeholder={t("contact.yourContact")} dir="auto" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-msg">{t("contact.message")} *</Label>
                    <Textarea id="c-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} required placeholder={t("contact.messagePlaceholder")} />
                  </div>
                  <Button type="submit" disabled={busy} className="h-11 w-full gap-2 rounded-xl font-bold">
                    <Send className="h-4 w-4" />
                    {busy ? t("common.sending") : t("common.send")}
                  </Button>
                  <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                    {t("contact.formHint")} — {new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

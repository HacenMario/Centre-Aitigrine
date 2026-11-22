"use client";
/**
 * أدوات الإدارة (v3.8) — تبويب في إعدادات المركز
 * 1) تصدير البيانات Excel/CSV: الحجوزات، العملاء، الفواتير
 * 2) نسخة احتياطية كاملة بضغطة (ZIP: قاعدة البيانات + الوسائط)
 * 3) إدارة كوبونات الخصم والعروض
 * 4) سجل التدقيق — من فعل ماذا ومتى
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  FileSpreadsheet, DatabaseBackup, Ticket, ScrollText, Download, Plus, Trash2,
  Loader2, RefreshCw, Search, ShieldCheck, Percent, Coins, UsersRound, CalendarClock, ReceiptText,
} from "lucide-react";
import { toast } from "sonner";
import { localeOf } from "@/components/tri-input";

/* ═══════════ 1+2: التصدير والنسخ الاحتياطي ═══════════ */

/** تحويل base64 إلى Uint8Array — للحم أجزاء النسخة الاحتياطية محلياً */
function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

function DataTools() {
  const { t, lang } = useApp();
  const [busyKey, setBusyKey] = useState("");
  const [progress, setProgress] = useState("");

  const download = async (key: string, url: string, filename: string) => {
    setBusyKey(key);
    try {
      const r = await fetch(url);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(j.error || t("common.error"));
        return;
      }
      const blob = await r.blob();
      const u = URL.createObjectURL(blob);
      const el = document.createElement("a");
      el.href = u;
      el.download = filename;
      el.click();
      URL.revokeObjectURL(u);
      toast.success(t("tools.exportDone"));
    } catch {
      toast.error(t("err.conn"));
    }
    setBusyKey("");
  };

  /* v3.30.0 — النسخة الاحتياطية الكاملة بلا نقصان: EJSON يحفظ أنواع BSON وكل المجموعات
     تشمل وسائط GridFS كاملة (media.files/chunks) — المرحلتان كما هما تمرّان بحدود
     الاستضافة السحابية والملف ينتهي في جهازك مباشرة:
     1) POST يبني ZIP كاملاً داخل قاعدة البيانات (GridFS) ويعيد بياناته
     2) تنزيل أجزاء base64 صغيرة (≤2.5MB) ولحمها في ملف ZIP واحد محلياً */
  const runBackup = async () => {
    setBusyKey("backup");
    setProgress(t("tools.backupBuild"));
    try {
      const r = await fetch("/api/backup", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j.error || t("common.error"));
        return;
      }
      const fileId = String(j.fileId || "");
      const parts = Math.max(1, parseInt(String(j.parts || "1"), 10) || 1);
      const name = String(j.name || `aitigrine-backup-${new Date().toISOString().slice(0, 10)}.zip`);
      if (!fileId) {
        toast.error(t("common.error"));
        return;
      }
      const chunks: Uint8Array[] = [];
      for (let p = 1; p <= parts; p++) {
        setProgress(`${t("tools.backupFetch")} ${p}/${parts}`);
        const pr = await fetch(`/api/backup?file=${encodeURIComponent(fileId)}&part=${p}`);
        const pj = await pr.json().catch(() => ({}));
        if (!pr.ok) {
          toast.error(pj.error || t("common.error"));
          return;
        }
        chunks.push(b64ToU8(String(pj.data || "")));
      }
      const blob = new Blob(chunks as BlobPart[], { type: "application/zip" });
      const u = URL.createObjectURL(blob);
      const el = document.createElement("a");
      el.href = u;
      el.download = name;
      el.click();
      URL.revokeObjectURL(u);
      toast.success(t("tools.exportDone"));
    } catch {
      toast.error(t("err.conn"));
    } finally {
      setBusyKey("");
      setProgress("");
    }
  };

  const rows = [
    {
      key: "appointments", icon: CalendarClock, label: t("tools.exportAppointments"),
      sub: t("tools.exportAppointmentsSub"), url: `/api/export?type=appointments&lang=${lang}`, file: "appointments.csv", cls: "text-sky-600 bg-sky-500/10",
    },
    {
      key: "clients", icon: UsersRound, label: t("tools.exportClients"),
      sub: t("tools.exportClientsSub"), url: `/api/export?type=clients&lang=${lang}`, file: "clients.csv", cls: "text-emerald-600 bg-emerald-500/10",
    },
    {
      key: "invoices", icon: ReceiptText, label: t("tools.exportInvoices"),
      sub: t("tools.exportInvoicesSub"), url: `/api/export?type=invoices&lang=${lang}`, file: "invoices.csv", cls: "text-amber-600 bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-4">
      {/* النسخة الاحتياطية */}
      <Card className="ait-card rounded-3xl border-primary/25">
        <CardContent className="p-5 flex flex-wrap items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
            <DatabaseBackup className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-black">{t("tools.backup")}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{t("tools.backupSub")}</p>
          </div>
          <Button
            onClick={runBackup}
            disabled={busyKey === "backup"}
            className="rounded-xl gap-1.5"
          >
            {busyKey === "backup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {progress || t("tools.backupBtn")}
          </Button>
        </CardContent>
      </Card>

      {/* التصدير */}
      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map((r) => (
          <Card key={r.key} className="ait-card rounded-3xl">
            <CardContent className="p-4 space-y-3">
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", r.cls)}>
                <r.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold text-sm">{r.label}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{r.sub}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl gap-1.5"
                onClick={() => download(r.key, r.url, r.file)}
                disabled={busyKey === r.key}
              >
                {busyKey === r.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                {t("tools.exportBtn")} (Excel/CSV)
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ═══════════ 3: الكوبونات ═══════════ */
type Coupon = {
  _id: string; code: string; kind: "percent" | "fixed"; value: number;
  description: string; maxUses: number; usedCount: number;
  expiresAt: string | null; minPrice: number; active: boolean; expired?: boolean;
};

function CouponsManager() {
  const { t, lang } = useApp();
  const [items, setItems] = useState<Coupon[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ code: "", kind: "percent", value: "", description: "", maxUses: "", expiresAt: "", minPrice: "" });

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/coupons", { cache: "no-store" });
      if (r.ok) setItems((await r.json()).items || []);
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!draft.code.trim() || !draft.value) {
      toast.error(t("err.required"));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: draft.code.trim().toUpperCase(),
          kind: draft.kind,
          value: Number(draft.value),
          description: draft.description,
          maxUses: Number(draft.maxUses) || 0,
          minPrice: Number(draft.minPrice) || 0,
          expiresAt: draft.expiresAt || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        toast.success(t("tools.couponCreated"));
        setAdding(false);
        setDraft({ code: "", kind: "percent", value: "", description: "", maxUses: "", expiresAt: "", minPrice: "" });
        load();
      } else {
        toast.error(j.error || t("common.error"));
      }
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (c: Coupon) => {
    setBusy(true);
    try {
      await fetch(`/api/coupons?id=${c._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !c.active }),
      });
      load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(t("testi.confirmDelete"))) return;
    setBusy(true);
    try {
      await fetch(`/api/coupons?id=${id}`, { method: "DELETE" });
      load();
    } finally {
      setBusy(false);
    }
  };

  const fmtValue = (c: Coupon) =>
    c.kind === "percent" ? `${c.value}%` : `${c.value.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-DZ")} ${lang === "ar" ? "دج" : "DA"}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground font-semibold">{t("tools.couponsSub")}</p>
        <Button size="sm" onClick={() => setAdding(true)} className="rounded-full gap-1.5">
          <Plus className="h-3.5 w-3.5" /> {t("tools.couponAdd")}
        </Button>
      </div>

      {!items ? (
        <Skeleton className="h-24 rounded-3xl" />
      ) : items.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">{t("tools.couponsEmpty")}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-2.5">
          {items.map((c) => (
            <Card key={c._id} className={cn("ait-card rounded-2xl", (!c.active || c.expired) && "opacity-60 border-dashed")}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {c.kind === "percent" ? <Percent className="h-5 w-5" /> : <Coins className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-black tracking-widest ltr:font-mono" dir="ltr">{c.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtValue(c)}
                    {c.description ? ` — ${c.description}` : ""}
                    {c.maxUses > 0 ? ` · ${t("tools.uses")}: ${c.usedCount}/${c.maxUses}` : c.usedCount > 0 ? ` · ${t("tools.uses")}: ${c.usedCount}` : ""}
                    {c.expiresAt ? ` · ${t("tools.until")} ${new Date(c.expiresAt).toLocaleDateString(localeOf(lang))}` : ""}
                  </p>
                </div>
                {c.expired ? (
                  <Badge variant="outline" className="rounded-full border-red-300 text-red-600 text-[10px]">{t("tools.expired")}</Badge>
                ) : null}
                <div className="flex items-center gap-2">
                  <Switch checked={c.active} onCheckedChange={() => toggle(c)} disabled={busy} aria-label={t("common.active")} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-red-600" onClick={() => remove(c._id)} disabled={busy}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* نافذة إنشاء كوبون */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" /> {t("tools.couponAdd")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>{t("tools.couponCode")}</Label>
              <Input
                value={draft.code}
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
                placeholder="WELCOME10"
                dir="ltr"
                className="font-mono font-black tracking-widest"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("tools.couponKind")}</Label>
                <div className="flex gap-1.5">
                  <Button type="button" size="sm" variant={draft.kind === "percent" ? "default" : "outline"} className="flex-1 rounded-xl" onClick={() => setDraft((d) => ({ ...d, kind: "percent" }))}>
                    {t("tools.percent")} %
                  </Button>
                  <Button type="button" size="sm" variant={draft.kind === "fixed" ? "default" : "outline"} className="flex-1 rounded-xl" onClick={() => setDraft((d) => ({ ...d, kind: "fixed" }))}>
                    {t("tools.fixed")} {lang === "ar" ? "دج" : "DA"}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("tools.couponValue")}</Label>
                <Input type="number" min={1} value={draft.value} onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("tools.couponDesc")}</Label>
              <Input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder={t("common.optional")} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t("tools.maxUses")}</Label>
                <Input type="number" min={0} value={draft.maxUses} onChange={(e) => setDraft((d) => ({ ...d, maxUses: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("tools.minPrice")}</Label>
                <Input type="number" min={0} value={draft.minPrice} onChange={(e) => setDraft((d) => ({ ...d, minPrice: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("tools.expiry")}</Label>
                <Input type="date" value={draft.expiresAt} onChange={(e) => setDraft((d) => ({ ...d, expiresAt: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAdding(false)}>{t("common.cancel")}</Button>
            <Button onClick={create} disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════ 4: سجل التدقيق ═══════════ */
type AuditRow = {
  _id: string; actorName: string; actorRole: string; action: string;
  target: string; meta: string; ip: string; at: string;
};

function AuditViewer() {
  const { t, lang, me } = useApp();
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const VISIBLE = 10;

  const load = useCallback(async (query = "") => {
    setLoading(true);
    try {
      const r = await fetch(`/api/audit?limit=150${query ? `&q=${encodeURIComponent(query)}` : ""}`, { cache: "no-store" });
      if (r.ok) setRows((await r.json()).items || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ★ v3.10: تفريغ السجل يدوياً لحظياً (زر للإدارة فقط — طلب صاحب المركز)
     الحذف التلقائي بعد 3 أيام يعمل في الخلفية (TTL + تنظيف الكتابة) */
  const clearAll = async () => {
    setClearing(true);
    try {
      const r = await fetch("/api/audit", { method: "DELETE" });
      if (r.ok) {
        toast.success(t("audit.cleared"));
        setConfirmClear(false);
        setShowAll(false);
        setRows([]);
        /* نعيد التحميل بعد ثانية — آخر حدث سيكون توثيق عملية التفريغ نفسها */
        setTimeout(() => load(q.trim()), 800);
      } else {
        const j = await r.json().catch(() => ({}));
        toast.error(j.error || t("common.error"));
      }
    } catch {
      toast.error(t("err.conn"));
    }
    setClearing(false);
  };

  const fmtAction = (a: string) => {
    const map: Record<string, string> = {
      "auth.login": t("audit.login"), "auth.loginFail": t("audit.loginFail"), "auth.blocked": t("audit.blocked"),
      "auth.bootstrap": t("audit.bootstrap"), "auth.google": t("audit.google"), "auth.googleCreate": t("audit.googleCreate"),
      "appointment.create": t("audit.apptCreate"), "appointment.update": t("audit.apptUpdate"),
      "appointment.cancel": t("audit.apptCancel"), "appointment.delete": t("audit.apptDelete"),
      "coupon.create": t("audit.couponCreate"), "coupon.update": t("audit.couponUpdate"), "coupon.delete": t("audit.couponDelete"),
      "testimonial.create": t("audit.testiCreate"), "testimonial.update": t("audit.testiUpdate"), "testimonial.delete": t("audit.testiDelete"),
      "invoice.download": t("audit.invoiceDl"), "backup.create": t("audit.backup"),
      "export.appointments": t("audit.exportAppts"), "export.clients": t("audit.exportClients"), "export.invoices": t("audit.exportInvoices"),
      "settings.update": t("audit.settings"), "accounts.create": t("audit.accCreate"), "accounts.update": t("audit.accUpdate"), "accounts.delete": t("audit.accDelete"),
      "audit.clear": t("audit.clear"),
    };
    return map[a] || a;
  };

  const roleCls = (r: string) =>
    r === "admin" ? "bg-primary/10 text-primary" :
    r === "assistant" ? "bg-sky-500/10 text-sky-600" :
    r === "specialist" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(q.trim())}
            placeholder={t("audit.search")}
            className="ps-10 h-11 rounded-xl"
          />
        </div>
        <Button variant="outline" onClick={() => load(q.trim())} disabled={loading} className="h-11 rounded-xl gap-1.5 shrink-0">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> <span className="hidden sm:inline">{t("dash.refresh")}</span>
        </Button>
        {me?.role === "admin" && (
          <Button
            variant="outline"
            onClick={() => setConfirmClear(true)}
            disabled={loading || clearing}
            className="h-11 rounded-xl gap-1.5 shrink-0 text-destructive hover:bg-destructive hover:text-white border-destructive/40"
          >
            {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{t("audit.clearBtn")}</span>
          </Button>
        )}
      </div>

      {/* تنبيه الحذف التلقائي بعد 3 أيام + نافذة تأكيد التفريغ اليدوي */}
      <p className="text-[11px] text-muted-foreground leading-relaxed break-words">{t("audit.autoClean")}</p>
      {confirmClear && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-foreground/30 p-4" onClick={() => setConfirmClear(false)}>
          <div className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-black">{t("audit.clearTitle")}</p>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed break-words">{t("audit.clearConfirm")}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmClear(false)}>{t("common.cancel")}</Button>
              <Button variant="destructive" onClick={clearAll} disabled={clearing} className="gap-1.5">
                {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t("audit.clearBtn")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!rows ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
      ) : rows.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">{t("audit.empty")}</CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {/* ★ v3.8.1: 10 أسطر فقط هنا — والبقية في نافذة خاصة بزر «إظهار المزيد» */}
          {rows.slice(0, VISIBLE).map((r) => (
            <div key={r._id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", roleCls(r.actorRole))}>
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold break-words">
                  {r.actorName}
                  <span className="font-normal text-muted-foreground"> — {fmtAction(r.action)}</span>
                  {r.target ? <span className="font-semibold"> · {r.target}</span> : null}
                </p>
                <p className="text-[11px] text-muted-foreground break-words">
                  {r.meta ? `${r.meta} · ` : ""}
                  {new Date(r.at).toLocaleString(localeOf(lang))}
                  {r.ip && r.ip !== "local" ? ` · IP ${r.ip}` : ""}
                </p>
              </div>
            </div>
          ))}

          {/* زر إظهار المزيد */}
          {rows.length > VISIBLE && (
            <Button
              variant="outline"
              onClick={() => setShowAll(true)}
              className="w-full h-11 rounded-2xl gap-2"
            >
              <ScrollText className="h-4 w-4" />
              {t("audit.showMore")}
              <Badge variant="secondary" className="rounded-full">{rows.length - VISIBLE}</Badge>
            </Button>
          )}

          {/* نافذة السجل الكامل */}
          <Dialog open={showAll} onOpenChange={setShowAll}>
            <DialogContent className="max-w-2xl max-h-[85dvh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <ScrollText className="h-4.5 w-4.5 text-primary" /> {t("audit.fullTitle")}
                  <Badge variant="secondary" className="rounded-full">{rows.length}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto -mx-1 px-1 space-y-1.5 pb-1" dir="ltr">
                {[...rows].reverse().map((r) => (
                  <div key={r._id} className="flex items-center gap-3 rounded-2xl border bg-card p-3" dir="auto">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", roleCls(r.actorRole))}>
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold break-words">
                        {r.actorName}
                        <span className="font-normal text-muted-foreground"> — {fmtAction(r.action)}</span>
                        {r.target ? <span className="font-semibold"> · {r.target}</span> : null}
                      </p>
                      <p className="text-[11px] text-muted-foreground break-words">
                        {r.meta ? `${r.meta} · ` : ""}
                        {new Date(r.at).toLocaleString(localeOf(lang))}
                        {r.ip && r.ip !== "local" ? ` · IP ${r.ip}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAll(false)} className="rounded-xl">
                  {t("common.close")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}

/* ═══════════ 5: بطاقة دخول Google — تُظهر رابط redirect الدقيق المطلوب في Google Console ═══════════ */
function GoogleAuthCard() {
  const { t } = useApp();
  const [info, setInfo] = useState<{ configured: boolean; clientId: string; redirectUri: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/google?config=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setInfo({ configured: !!j.configured, clientId: j.clientId || "", redirectUri: j.redirectUri || "" }))
      .catch(() => setInfo({ configured: false, clientId: "", redirectUri: "" }));
  }, []);

  if (!info) return null;
  return (
    <Card className="ait-card rounded-3xl border-primary/25">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-black">{t("google.cardTitle")}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{t("google.cardSub")}</p>
          </div>
          <Badge variant="secondary" className={cn("rounded-full shrink-0", info.configured && "bg-emerald-500/10 text-emerald-600")}>
            {info.configured ? t("google.configured") : t("google.notConfigured")}
          </Badge>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-muted-foreground">{t("google.redirectLabel")}</p>
          <div className="flex items-center gap-2 rounded-xl border bg-muted/40 p-2.5" dir="ltr">
            <code className="flex-1 text-xs break-all leading-relaxed">{info.redirectUri}</code>
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 rounded-lg gap-1"
              onClick={() => {
                try {
                  navigator.clipboard.writeText(info.redirectUri);
                  toast.success(t("google.copied"));
                } catch {}
              }}
            >
              <Download className="h-3.5 w-3.5" /> {t("google.copy")}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{t("google.hint")}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminTools() {
  const { t } = useApp();
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="font-black flex items-center gap-2 text-base">
          <DatabaseBackup className="h-4.5 w-4.5 text-primary" /> {t("tools.dataTitle")}
        </h3>
        <DataTools />
      </section>
      <section className="space-y-3">
        <h3 className="font-black flex items-center gap-2 text-base">
          <Ticket className="h-4.5 w-4.5 text-primary" /> {t("tools.couponsTitle")}
        </h3>
        <CouponsManager />
      </section>
      <section className="space-y-3">
        <h3 className="font-black flex items-center gap-2 text-base">
          <ScrollText className="h-4.5 w-4.5 text-primary" /> {t("audit.title")}
        </h3>
        <AuditViewer />
      </section>
      <section className="space-y-3">
        <h3 className="font-black flex items-center gap-2 text-base">
          <ShieldCheck className="h-4.5 w-4.5 text-primary" /> {t("google.cardTitle")}
        </h3>
        <GoogleAuthCard />
      </section>
    </div>
  );
}

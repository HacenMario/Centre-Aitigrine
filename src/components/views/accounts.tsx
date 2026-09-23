"use client";
/**
 * الحسابات — تُنشأ من الإدارة فقط
 * إضافة/تعديل/تفعيل-تعطيل/حذف + ساعات العمل بالنقر + تعيين الأخصائي المعالج
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { PageSkeleton } from "@/components/brand-skeleton";
import WeekHoursEditor from "@/components/week-hours-editor";
import ImageInput from "@/components/image-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Power, Search, UsersRound, Phone, KeyRound, BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { TriInput, TriTextarea, triFrom, flattenTri } from "@/components/tri-input";
import { FullAvatar } from "@/components/full-image";
import Pagination from "@/components/pagination";
import { cn } from "@/lib/utils";
import type { Navigate } from "@/lib/nav";

const ACC_PAGE_SIZE = 12;

type ResetReq = { id: string; name: string; phone: string; role: string; createdAt: string };

type Account = {
  _id: string; name: string; phone: string; role: "admin" | "assistant" | "specialist" | "client";
  specialty?: string; langs?: string[]; title?: string; titleFr?: string; titleEn?: string;
  bio?: string; bioFr?: string; bioEn?: string; yearsExperience?: number; specialties?: string[];
  photoBase64?: string;
  weeklyHours?: Record<string, string[]>; assignedSpecialistId?: string | null; active: boolean;
};

type SpecialtyRow = { _id: string; ar: string; fr?: string; en?: string; tr?: string; es?: string; builtin: boolean };

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-rose-500/12 text-rose-700 dark:text-rose-400 border-rose-500/25",
  assistant: "bg-violet-500/12 text-violet-700 dark:text-violet-400 border-violet-500/25",
  specialist: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  client: "bg-sky-500/12 text-sky-700 dark:text-sky-400 border-sky-500/25",
};

export default function Accounts({ navigate }: { navigate: Navigate }) {
  const { t, me } = useApp();
  const isAdmin = me?.role === "admin";
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Partial<Account> & { password?: string } | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [resetReqs, setResetReqs] = useState<ResetReq[]>([]);
  const [resetTarget, setResetTarget] = useState<ResetReq | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [specialtyRows, setSpecialtyRows] = useState<SpecialtyRow[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/accounts", { cache: "no-store" });
      const j = await r.json();
      setAccounts(j.users || []);
    } catch {}
    try {
      const rr = await fetch("/api/reset-requests", { cache: "no-store" });
      if (rr.ok) {
        const rj = await rr.json();
        setResetReqs(rj.requests || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* قائمة التخصصات لربطها بالأخصائي */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/specialties", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          setSpecialtyRows(j.specialties || []);
        }
      } catch {}
    })();
  }, []);

  const specialists = useMemo(() => accounts.filter((a) => a.role === "specialist"), [accounts]);

  const filtered = accounts.filter((a) => {
    if (roleFilter !== "all" && a.role !== roleFilter) return false;
    if (query && !a.name.includes(query) && !a.phone.includes(query)) return false;
    return true;
  });
  /* ترقيم الصفحات الاحترافي — يتجدد عند تغيير الفلتر/البحث */
  const [page, setPage] = useState(1);
  const accPageCount = Math.max(1, Math.ceil(filtered.length / ACC_PAGE_SIZE));
  const pageFiltered = filtered.slice((page - 1) * ACC_PAGE_SIZE, page * ACC_PAGE_SIZE);
  useEffect(() => { setPage(1); }, [roleFilter, query]);

  const toggleActive = async (a: Account) => {
    const r = await fetch(`/api/accounts/${a._id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !a.active }),
    });
    if (r.ok) { toast.success(a.active ? t("acc.deactivated") : t("acc.activated")); load(); }
    else toast.error(t("common.error"));
  };

  const applyReset = async () => {
    if (!resetTarget) return;
    if (resetPass.length < 6) { toast.error(t("auth.weakPass")); return; }
    const r = await fetch("/api/reset-requests", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: resetTarget.id, password: resetPass }),
    });
    if (r.ok) {
      toast.success(t("reset.done"));
      setResetTarget(null);
      setResetPass("");
      load();
    } else toast.error(t("common.error"));
  };

  const dismissReset = async (id: string) => {
    const r = await fetch(`/api/reset-requests?id=${id}`, { method: "DELETE" });
    if (r.ok) load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <BackButton onBack={() => navigate("home")} />
          <h1 className="text-xl sm:text-2xl font-black">{t("nav.accounts")}</h1>
        </div>
        {isAdmin && (
          <Button onClick={() => setEditing({ role: "client", langs: ["ar"], active: true, weeklyHours: {} })}
            className="gap-2 rounded-xl shadow-md shadow-primary/20">
            <Plus className="h-4.5 w-4.5" /> {t("acc.newAccount")}
          </Button>
        )}
      </div>

      {/* طلبات استعادة كلمة المرور */}
      {resetReqs.length > 0 && (
        <Card className="rounded-2xl border-amber-500/30 bg-amber-500/[0.05] shadow-sm">
          <CardContent className="p-4 space-y-3">
            <p className="font-bold text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <BellRing className="h-4 w-4" />
              {t("reset.requests")} ({resetReqs.length})
            </p>
            <p className="text-xs text-muted-foreground">{t("reset.hint")}</p>
            <div className="space-y-2">
              {resetReqs.map((rq) => (
                <div key={rq.id} className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{rq.name}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{rq.phone}</p>
                  </div>
                  <Button size="sm" onClick={() => { setResetTarget(rq); setResetPass(""); }} className="gap-1.5 rounded-lg">
                    <KeyRound className="h-3.5 w-3.5" /> {t("reset.setPass")}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => dismissReset(rq.id)} aria-label={t("common.cancel")}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={roleFilter} onValueChange={setRoleFilter}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
            <TabsTrigger value="admin">{t("roles.admin")}</TabsTrigger>
            <TabsTrigger value="assistant">{t("roles.assistant")}</TabsTrigger>
            <TabsTrigger value="specialist">{t("roles.specialist")}</TabsTrigger>
            <TabsTrigger value="client">{t("roles.client")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-44">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("common.search")} className="ps-9 h-10" />
        </div>
      </div>

      {loading ? (
        <PageSkeleton kind="rows" count={4} label={t("common.loading")} className="pt-2" />
      ) : (
        <div className="grid gap-2.5">
          {pageFiltered.map((a) => (
            <Card key={a._id} className={cn("rounded-2xl shadow-sm", !a.active && "opacity-60")}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-black text-primary overflow-hidden">
                  {a.photoBase64 ? (
                    <FullAvatar src={a.photoBase64} alt={a.name} className="h-12 w-12" imgClassName="p-0.5" />
                  ) : a.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm break-words">{a.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5" dir="ltr">
                    <Phone className="h-3 w-3" /> {a.phone}
                  </p>
                </div>
                <Badge variant="outline" className={ROLE_BADGE[a.role]}>{t(`roles.${a.role}`)}</Badge>
                {a.role === "specialist" && a.specialty && (
                  <span className="text-xs text-muted-foreground">
                    {a.specialty === "art_therapy" ? t("acc.art") : a.specialty === "both" ? t("acc.both") : t("acc.psycho")}
                  </span>
                )}
                {a.role === "specialist" && (a.yearsExperience || 0) > 0 && (
                  <span className="text-xs font-bold text-primary">+{a.yearsExperience} {t("spec.years")}</span>
                )}
                {!a.active && <Badge variant="secondary">{t("common.inactive")}</Badge>}
                <div className="flex items-center gap-1 ms-auto flex-wrap">
                  {isAdmin && (
                    <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setEditing(a)}>
                      <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => toggleActive(a)}>
                    <Power className="h-3.5 w-3.5" /> {a.active ? t("common.deactivate") : t("common.activate")}
                  </Button>
                  {isAdmin && a._id !== me?._id && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDelId(a._id)} aria-label={t("common.delete")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card className="rounded-3xl border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <UsersRound className="h-10 w-10 opacity-40" />
                {t("common.noData")} — {t("acc.accountHint")}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <Pagination page={page} pageCount={accPageCount} onPage={setPage} total={filtered.length} pageSize={ACC_PAGE_SIZE} />
      )}

      {/* نافذة إنشاء/تعديل حساب */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-start">{editing?._id ? t("acc.editAccount") : t("acc.newAccount")}</DialogTitle>
            <DialogDescription className="text-start">{t("acc.accountHint")}</DialogDescription>
          </DialogHeader>
          <AccountForm
            value={editing}
            specialists={specialists}
            specialtyRows={specialtyRows}
            onChange={setEditing}
            onDone={() => { setEditing(null); load(); }}
          />
        </DialogContent>
      </Dialog>

      {/* نافذة تعيين كلمة مرور لطلب الاستعادة */}
      <Dialog open={!!resetTarget} onOpenChange={(v) => !v && setResetTarget(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-start">{t("reset.setPass")}</DialogTitle>
            <DialogDescription className="text-start">
              {resetTarget?.name} — <span dir="ltr">{resetTarget?.phone}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-pass">{t("prof.newPass")}</Label>
              <Input id="reset-pass" type="text" value={resetPass} onChange={(e) => setResetPass(e.target.value)}
                placeholder="••••••" className="h-11 rounded-xl" dir="ltr" />
            </div>
            <Button onClick={applyReset} className="w-full h-11 rounded-xl gap-2">
              <KeyRound className="h-4 w-4" /> {t("common.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                const r = await fetch(`/api/accounts/${delId}`, { method: "DELETE" });
                if (r.ok) { toast.success(t("toast.accountDeleted")); setDelId(null); load(); }
              }}>
              {t("common.yes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AccountForm({
  value, specialists, specialtyRows, onChange, onDone,
}: {
  value: (Partial<Account> & { password?: string }) | null;
  specialists: Account[];
  specialtyRows: SpecialtyRow[];
  onChange: (v: (Partial<Account> & { password?: string }) | null) => void;
  onDone: () => void;
}) {
  const { t, lang } = useApp();
  const [busy, setBusy] = useState(false);
  const upd = (patch: Partial<Account> & { password?: string }) => onChange({ ...value, ...patch });
  const isNew = !value?._id;

  const toggleSpecialty = (id: string) => {
    const cur = value?.specialties || [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    upd({ specialties: next });
  };

  const save = async () => {
    if (!value?.name?.trim() || !value?.phone?.trim() || (isNew && !value?.password)) {
      toast.error(t("err.required"));
      return;
    }
    setBusy(true);
    const { password, ...rest } = value;
    const body = isNew ? value : { ...rest, ...(password ? { password } : {}) };
    const r = await fetch(isNew ? "/api/accounts" : `/api/accounts/${value._id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { toast.success(t("toast.accountSaved")); onDone(); }
    else toast.error(j.error || t("common.error"));
  };

  const toggleLang = (l: string) => {
    const cur = value?.langs || ["ar"];
    const next = cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l];
    upd({ langs: next.length ? next : ["ar"] });
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{t("common.name")}</Label>
          <Input value={value?.name || ""} onChange={(e) => upd({ name: e.target.value })} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label>{t("common.phone")}</Label>
          <Input type="tel" dir="ltr" value={value?.phone || ""} onChange={(e) => upd({ phone: e.target.value })} className="h-11 text-start" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{t("common.password")} {value?._id && <span className="text-xs text-muted-foreground">({t("common.optional")})</span>}</Label>
          <Input type="password" value={value?.password || ""} onChange={(e) => upd({ password: e.target.value })} className="h-11" placeholder="••••••" />
        </div>
        <div className="space-y-2">
          <Label>{t("common.role")}</Label>
          <Select value={value?.role || "client"} onValueChange={(v) => upd({ role: v as Account["role"] })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["admin", "assistant", "specialist", "client"] as const).map((r) => (
                <SelectItem key={r} value={r}>{t(`roles.${r}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {value?.role === "specialist" && (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("acc.specialty")}</Label>
              <Select value={value?.specialty || "psychological"} onValueChange={(v) => upd({ specialty: v })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="psychological">{t("acc.psycho")}</SelectItem>
                  <SelectItem value="art_therapy">{t("acc.art")}</SelectItem>
                  <SelectItem value="both">{t("acc.both")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("acc.years")}</Label>
              <Input
                type="number" min={0} max={70}
                value={value?.yearsExperience ?? 0}
                onChange={(e) => upd({ yearsExperience: Math.max(0, Math.min(70, Number(e.target.value) || 0)) })}
                className="h-11"
              />
            </div>
          </div>
          {/* اللقب المهني — ثلاثي اللغة */}
          <TriInput
            label={t("acc.title")}
            value={triFrom(value as Record<string, unknown>, "title")}
            onChange={(v) => upd({ ...flattenTri("title", v) } as Partial<Account> & { password?: string })}
          />
          <div className="space-y-2">
            <Label>{t("acc.langs")}</Label>
            <div className="flex flex-wrap gap-4 pt-1">
              {[
                { k: "ar", label: "العربية" },
                { k: "fr", label: "Français" },
                { k: "en", label: "English" },
              ].map((l) => (
                <label key={l.k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={(value?.langs || ["ar"]).includes(l.k)} onCheckedChange={() => toggleLang(l.k)} />
                  {l.label}
                </label>
              ))}
            </div>
          </div>
          {/* التخصصات المرتبطة بالأخصائي — من القائمة الدائمة + إضافات الإدارة */}
          {specialtyRows.length > 0 && (
            <div className="space-y-2">
              <Label>{t("acc.linkSpecialties")}</Label>
              <div className="flex flex-wrap gap-2 rounded-xl border bg-card/40 p-3">
                {specialtyRows.map((sp) => {
                  const checked = (value?.specialties || []).includes(sp._id);
                  const name =
                    lang === "fr" ? (sp.fr || sp.ar)
                    : lang === "en" ? (sp.en || sp.ar)
                    : lang === "tr" ? (sp.tr || sp.en || sp.fr || sp.ar)
                    : lang === "es" ? (sp.es || sp.en || sp.fr || sp.ar)
                    : sp.ar;
                  return (
                    <label
                      key={sp._id}
                      className={cn(
                        "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
                        checked
                          ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                          : "bg-background text-muted-foreground hover:border-primary/25 hover:text-foreground"
                      )}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleSpecialty(sp._id)} />
                      {name}
                      {sp.builtin && <span className="text-[9px] opacity-60" title={t("acc.builtinStar")}>★</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>{t("acc.weeklyHours")}</Label>
            <WeekHoursEditor value={value?.weeklyHours || {}} onChange={(v) => upd({ weeklyHours: v })} />
          </div>
        </>
      )}

      {value?.role === "client" && (
        <div className="space-y-2">
          <Label>{t("acc.assignSpecialist")}</Label>
          <Select value={value?.assignedSpecialistId || "none"} onValueChange={(v) => upd({ assignedSpecialistId: v === "none" ? null : v })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("common.none")}</SelectItem>
              {specialists.map((s) => (
                <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <TriTextarea
        label={t("acc.bio")}
        value={triFrom(value as Record<string, unknown>, "bio")}
        onChange={(v) => upd({ ...flattenTri("bio", v) } as Partial<Account> & { password?: string })}
        rows={2}
      />
      <div className="space-y-2">
        <Label>{t("common.uploadImage")}</Label>
        <ImageInput value={value?.photoBase64 || ""} onChange={(v) => upd({ photoBase64: v })} label={t("common.uploadImage")} maxWidth={400} />
      </div>

      {!isNew && (
        <label className="flex items-center justify-between rounded-xl border p-3">
          <span className="text-sm font-semibold">{t("common.active")}</span>
          <Switch checked={value?.active !== false} onCheckedChange={(v) => upd({ active: v })} />
        </label>
      )}
      <Button onClick={save} disabled={busy} className="w-full h-12 rounded-xl text-base">
        {busy ? t("common.saving") : t("common.save")}
      </Button>
    </div>
  );
}

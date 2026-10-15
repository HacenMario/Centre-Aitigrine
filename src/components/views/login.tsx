"use client";
/**
 * بوابات الدخول — نمط طمأنينة: بوابة لكل نوع مستخدم
 * ★ viewId يحدد البوابة: client (عميل) | specialist (أخصائي) | admin (إدارة المركز)
 * عميل: دخول / حساب جديد (مع عبارة استرجاع إلزامية) / استرجاع فوري بعبارة الاسترجاع
 * أخصائي: دخول / استعادة عبر الإدارة (تُبلَّغ الإدارة بإشعار فوري)
 * إدارة: بوابة الدخول ببيانات .env — أول دخول ينشئ الحساب تلقائياً
 * ★ حقول التسجيل فارغة تماماً — لا نصوص إرشادية خلف ما يكتبه المستخدم
 */
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LogIn, ShieldCheck, Phone, KeyRound, UserRound, Info, UserPlus, LifeBuoy, Send, Eye, EyeOff, Stethoscope, HeartHandshake, Droplet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BLOOD_TYPES } from "@/lib/blood";

type Tab = "login" | "register" | "forgot";
type Portal = "client" | "specialist" | "admin";

/* ★ v3.8.1: زر دخول Google — يفحص الإعداد ويحول لصفحة الموافقة
 *   + للإدارة: تذكير قبل التحويل بالرابط الدقيق الواجب تسجيله في Google Console
 *     (يمنع خطأ Erreur 400: redirect_uri_mismatch) */
function GoogleButton() {
  const { t, me } = useApp();
  const [configured, setConfigured] = useState<boolean | null>(null);

  const check = async () => {
    try {
      const r = await fetch("/api/auth/google?config=1", { cache: "no-store" });
      const j = await r.json();
      setConfigured(!!j.configured);
      if (j.configured) {
        const isAdmin = me?.role === "admin";
        const uri = String(j.redirectUri || "");
        if (isAdmin && uri) {
          /* إشعار طويل للإدارة مع الرابط الدقيق — لا يعيق التحويل */
          toast.info(t("login.googleAdminHint"), { description: uri, duration: 12000 });
        }
        window.location.href = "/api/auth/google";
      } else {
        toast.info(t("login.googleNotConfigured"), { duration: 8000 });
      }
    } catch {
      toast.error(t("err.conn"));
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 py-0.5" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-bold text-muted-foreground">{t("login.orContinue")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="outline" onClick={check} className="h-12 w-full rounded-xl gap-2.5 bg-card">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z" />
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z" />
        </svg>
        <span>{configured === false ? t("login.googleBtn") : t("login.googleBtn")}</span>
      </Button>
    </>
  );
}

export default function Login({ onDone }: { onDone: () => void }) {
  const { t, setSession, viewId, navigate } = useApp();
  const portal: Portal = viewId === "specialist" || viewId === "admin" ? viewId : "client";
  const [tab, setTab] = useState<Tab>("login");

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [bloodType, setBloodType] = useState(""); /* ★ v3.19: زمرة الدم إلزامية للتسجيل */
  const [newPass, setNewPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);

  /* تبديل البوابة من روابط مباشرة (?view=login&id=admin) */
  useEffect(() => {
    setTab("login");
  }, [portal]);

  const inputCls = "ps-10 h-12 rounded-xl";
  const EyeBtn = (
    <button type="button" onClick={() => setShowPass((v) => !v)} aria-label="eye"
      className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      /* بوابة الإدارة: مسار خاص ببيانات .env */
      const url = portal === "admin" ? "/api/auth/admin-login" : "/api/auth/login";
      const body: Record<string, unknown> = { phone, password };
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok && j.user && j.token) {
        setSession(j.user, j.token);
        toast.success(`${t("common.success")} — ${j.user.name}`);
        onDone();
      } else {
        toast.error(j.error || t("login.invalid"));
      }
    } catch {
      toast.error(t("err.conn"));
    }
    setBusy(false);
  };

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(t("auth.passMismatch"));
      return;
    }
    /* ★ v3.19: زمرة الدم إلزامية عند إنشاء حساب عميل */
    if (!bloodType) {
      toast.error(t("blood.required"));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, password, recoveryPhrase, bloodType }),
      });
      const j = await r.json();
      if (r.ok && j.user && j.token) {
        setSession(j.user, j.token);
        toast.success(t("auth.registerDone"));
        onDone();
      } else {
        toast.error(j.error || t("common.error"));
      }
    } catch {
      toast.error(t("err.conn"));
    }
    setBusy(false);
  };

  /* ── الاسترجاع الفوري (نمط طمأنينة): عبارة الاسترجاع → استعادة فورية داخل التطبيق ── */
  const recoverInstant = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, recoveryPhrase, newPassword: newPass }),
      });
      const j = await r.json();
      if (r.ok && j.user && j.token) {
        setSession(j.user, j.token);
        toast.success(t("auth.recoveredDone"));
        onDone();
      } else {
        toast.error(j.error || t("auth.recoveryInvalid"));
      }
    } catch {
      toast.error(t("err.conn"));
    }
    setBusy(false);
  };

  /* ── استعادة عبر الإدارة (للأخصائي) — تصل الإدارة إشعاراً فورياً ── */
  const forgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (r.ok) {
        toast.success(t("auth.forgotSent"));
        setTab("login");
      } else toast.error(t("common.error"));
    } catch {
      toast.error(t("err.conn"));
    }
    setBusy(false);
  };

  /* عناوين البوابة حسب النوع والتبويب */
  const portalMeta: Record<Portal, { title: string; sub: string; icon: React.ReactNode }> = {
    client: { title: t("login.clientTitle"), sub: t("login.clientSub"), icon: <UserRound className="h-7 w-7" /> },
    specialist: { title: t("login.specialistTitle"), sub: t("login.specialistSub"), icon: <Stethoscope className="h-7 w-7" /> },
    admin: { title: t("login.adminTitle"), sub: t("login.adminSub"), icon: <ShieldCheck className="h-7 w-7" /> },
  };
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "login", label: t("auth.tabLogin"), icon: <LogIn className="h-4 w-4" /> },
    ...(portal === "client" ? [{ key: "register" as Tab, label: t("auth.tabRegister"), icon: <UserPlus className="h-4 w-4" /> }] : []),
    ...(portal !== "admin" ? [{ key: "forgot" as Tab, label: t("auth.tabForgot"), icon: <LifeBuoy className="h-4 w-4" /> }] : []),
  ];
  const titles: Record<Tab, { title: string; sub: string; icon: React.ReactNode }> = {
    login: portalMeta[portal],
    register: { title: t("auth.registerTitle"), sub: t("auth.registerSub"), icon: <UserPlus className="h-7 w-7" /> },
    forgot: {
      title: portal === "client" ? t("auth.recoverTitle") : t("auth.forgotTitle"),
      sub: portal === "client" ? t("auth.recoverSub") : t("auth.forgotSub"),
      icon: <LifeBuoy className="h-7 w-7" />,
    },
  };

  return (
    <div className="mx-auto w-full max-w-md px-1 py-6 sm:py-10">
      {/* شرائح البوابات الثلاث — نمط طمأنينة */}
      <div className="mb-4 grid grid-cols-3 gap-1.5" role="tablist">
        {([
          { as: "client" as Portal, label: t("nav.loginClient"), icon: <UserRound className="h-4 w-4" /> },
          { as: "specialist" as Portal, label: t("nav.loginSpecialist"), icon: <Stethoscope className="h-4 w-4" /> },
          { as: "admin" as Portal, label: t("nav.loginAdmin"), icon: <ShieldCheck className="h-4 w-4" /> },
        ]).map((p) => (
          <button
            key={p.as}
            type="button"
            onClick={() => {
              if (p.as !== portal) navigate("login", p.as);
            }}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-bold transition-all sm:text-[13px]",
              portal === p.as
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {p.icon}
            <span className="break-words">{p.label}</span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden rounded-[1.75rem] border shadow-xl shadow-primary/5">
        <div className="ait-hero-gradient space-y-2 px-6 py-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            {titles[tab].icon}
          </span>
          <h1 className="pt-2 text-lg font-black leading-snug sm:text-xl">{titles[tab].title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{titles[tab].sub}</p>
        </div>

        {/* التبويبات الداخلية */}
        {tabs.length > 1 && (
          <div className="grid gap-1.5 p-3 pb-0" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0,1fr))` }} role="tablist">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                type="button"
                role="tab"
                aria-selected={tab === tb.key}
                onClick={() => setTab(tb.key)}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-bold transition-all sm:text-[13px]",
                  tab === tb.key
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {tb.icon}
                <span className="break-words">{tb.label}</span>
              </button>
            ))}
          </div>
        )}

        <CardContent className="p-5 pt-5 sm:p-7">
          {/* ── دخول ── */}
          {tab === "login" && (
            <form onSubmit={login} className="space-y-4.5">
              <div className="space-y-2">
                <Label htmlFor="phone">{t("common.phone")}</Label>
                <div className="relative">
                  <Phone className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
                  <Input id="phone" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)}
                    required className={inputCls + " text-start"} inputMode="tel" autoComplete="tel" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pass">{t("common.password")}</Label>
                <div className="relative">
                  <KeyRound className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
                  <Input id="pass" type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                    required className={inputCls + " pe-10"} autoComplete="current-password" />
                  {EyeBtn}
                </div>
              </div>
              <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl text-base shadow-lg shadow-primary/20">
                {busy ? t("common.loading") : portal === "admin" ? t("login.adminEnter") : t("common.login")}
              </Button>
              {/* ★ v3.8: دخول عبر Google — لبوابة العملاء بجانب الدخول بالهاتف */}
              {portal === "client" && <GoogleButton />}
              {portal === "admin" ? (
                <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  {t("login.adminHint")}
                </p>
              ) : (
                <div className="flex items-center justify-between gap-2 pt-1 text-[13px]">
                  <button type="button" onClick={() => setTab("forgot")} className="font-semibold text-primary hover:underline">
                    {t("auth.tabForgot")}
                  </button>
                  {portal === "client" && (
                    <button type="button" onClick={() => setTab("register")} className="font-semibold text-primary hover:underline">
                      {t("auth.createOne")}
                    </button>
                  )}
                </div>
              )}
            </form>
          )}

          {/* ── حساب عميل جديد — حقول فارغة تماماً (بلا نصوص خلفية) + عبارة استرجاع ── */}
          {tab === "register" && (
            <form onSubmit={register} className="space-y-4.5">
              <div className="space-y-2">
                <Label htmlFor="rname">{t("common.name")}</Label>
                <div className="relative">
                  <UserRound className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
                  <Input id="rname" value={name} onChange={(e) => setName(e.target.value)} required minLength={3}
                    className={inputCls} autoComplete="name" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rphone">{t("common.phone")}</Label>
                <div className="relative">
                  <Phone className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
                  <Input id="rphone" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)}
                    required className={inputCls + " text-start"} inputMode="tel" autoComplete="tel" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rpass">{t("common.password")}</Label>
                  <div className="relative">
                    <KeyRound className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
                    <Input id="rpass" type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                      required minLength={6} className={inputCls + " pe-10"} autoComplete="new-password" />
                    {EyeBtn}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rconfirm">{t("auth.confirmPass")}</Label>
                  <div className="relative">
                    <KeyRound className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
                    <Input id="rconfirm" type={showPass ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                      required minLength={6} className={inputCls} autoComplete="new-password" />
                  </div>
                </div>
              </div>
              {/* ★ v3.19: زمرة الدم — إلزامية عند إنشاء حساب عميل (تُستعمل في الملف الطلبي والوثائق) */}
              <div className="space-y-2 rounded-xl border border-primary/15 bg-primary/5 p-3">
                <Label htmlFor="rblood" className="flex items-center gap-2">
                  <Droplet className="h-4 w-4 text-primary" />
                  {t("blood.title")} <span className="text-destructive">*</span>
                </Label>
                <Select value={bloodType || "none"} onValueChange={(v) => setBloodType(v === "none" ? "" : v)}>
                  <SelectTrigger id="rblood" className="h-12 rounded-xl" aria-label={t("blood.title")}>
                    <SelectValue placeholder={t("blood.select")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>{t("blood.select")}</SelectItem>
                    {BLOOD_TYPES.map((bt) => (
                      <SelectItem key={bt} value={bt} dir="ltr" className="font-bold">
                        {bt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">{t("blood.note")}</p>
              </div>
              {/* عبارة الاسترجاع — إلزامية (نمط طمأنينة): بها يستعيد العميل حسابه فورياً */}
              <div className="space-y-2 rounded-xl border border-primary/15 bg-primary/5 p-3">
                <Label htmlFor="rrecover" className="flex items-center gap-2">
                  <HeartHandshake className="h-4 w-4 text-primary" />
                  {t("auth.recoveryPhrase")} <span className="text-destructive">*</span>
                </Label>
                <Input id="rrecover" value={recoveryPhrase} onChange={(e) => setRecoveryPhrase(e.target.value)}
                  required minLength={6} className="h-12 rounded-xl" autoComplete="off" />
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">{t("auth.recoveryNote")}</p>
              </div>
              <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl text-base shadow-lg shadow-primary/20">
                {busy ? t("common.loading") : t("auth.createOne")}
              </Button>
            </form>
          )}

          {/* ── استرجاع فوري بعبارة الاسترجاع (عميل) / طلب استعادة (أخصائي) ── */}
          {tab === "forgot" && (
            portal === "client" ? (
              <form onSubmit={recoverInstant} className="space-y-4.5">
                <div className="space-y-2">
                  <Label htmlFor="fphone">{t("common.phone")}</Label>
                  <div className="relative">
                    <Phone className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
                    <Input id="fphone" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)}
                      required className={inputCls + " text-start"} inputMode="tel" autoComplete="tel" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fphrase" className="flex items-center gap-2">
                    <HeartHandshake className="h-4 w-4 text-primary" />
                    {t("auth.recoveryPhrase")}
                  </Label>
                  <Input id="fphrase" value={recoveryPhrase} onChange={(e) => setRecoveryPhrase(e.target.value)}
                    required className={inputCls} autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fnew">{t("auth.newPassword")}</Label>
                  <div className="relative">
                    <KeyRound className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
                    <Input id="fnew" type={showPass ? "text" : "password"} value={newPass} onChange={(e) => setNewPass(e.target.value)}
                      required minLength={6} className={inputCls + " pe-10"} autoComplete="new-password" />
                    {EyeBtn}
                  </div>
                </div>
                <Button type="submit" disabled={busy} className="h-12 w-full gap-2 rounded-xl text-base shadow-lg shadow-primary/20">
                  <LifeBuoy className="h-4.5 w-4.5" />
                  {busy ? t("common.loading") : t("auth.recoverBtn")}
                </Button>
                <div className="space-y-1.5 rounded-xl border border-primary/15 bg-primary/8 p-3.5">
                  <p className="text-sm leading-relaxed">{t("auth.recoverInstantNote")}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{t("auth.recoverAdminNote")}</p>
                </div>
                <button type="button" onClick={() => setTab("login")}
                  className="w-full text-center text-[13px] font-semibold text-primary hover:underline">
                  {t("auth.backToLogin")}
                </button>
              </form>
            ) : (
              <form onSubmit={forgot} className="space-y-4.5">
                <div className="space-y-2">
                  <Label htmlFor="sphone">{t("common.phone")}</Label>
                  <div className="relative">
                    <Phone className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
                    <Input id="sphone" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)}
                      required className={inputCls + " text-start"} inputMode="tel" autoComplete="tel" />
                  </div>
                </div>
                <Button type="submit" disabled={busy} className="h-12 w-full gap-2 rounded-xl text-base shadow-lg shadow-primary/20">
                  <Send className="h-4.5 w-4.5" />
                  {busy ? t("common.loading") : t("common.send")}
                </Button>
                <div className="space-y-2 rounded-xl border border-primary/15 bg-primary/8 p-3.5">
                  <p className="text-sm leading-relaxed">{t("auth.forgotSent")}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{t("auth.forgotHint")}</p>
                </div>
                <button type="button" onClick={() => setTab("login")}
                  className="w-full text-center text-[13px] font-semibold text-primary hover:underline">
                  {t("auth.backToLogin")}
                </button>
              </form>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}

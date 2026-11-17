"use client";
/** ملفي الشخصي — بياناتي + تغيير كلمة المرور + مفاتيح المرور + الإخفاء السريع (رمز كل مستخدم) */
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserRound, KeyRound, Phone, BadgeCheck, EyeOff, ShieldCheck, Trash2, Droplet, Fingerprint, Plus, CloudUpload, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { getQuickHideConfig, saveQuickHideConfig } from "@/lib/quick-hide";
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startRegistration } from "@simplewebauthn/browser";
import type { Navigate } from "@/lib/nav";

type PkRow = { credId: string; deviceType: string; backedUp: boolean; label: string; createdAt: string };

export default function Profile({ navigate }: { navigate: Navigate }) {
  const { t, me, setMe, setHidden } = useApp();
  const [name, setName] = useState(me?.name || "");
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [busy, setBusy] = useState(false);

  /* الإخفاء السريع — كل مستخدم يضع رمزه الخاص من إعداداته (نمط طمأنينة) */
  const [qhEnabled, setQhEnabled] = useState(false);
  const [qhPin, setQhPin] = useState("");
  const [qhPin2, setQhPin2] = useState("");
  const [qhBusy, setQhBusy] = useState(false);

  /* ★ v3.24: مفاتيح المرور — قائمة مفاتيحي + دعم الجهاز */
  const [pkAvail, setPkAvail] = useState(false);
  const [pkList, setPkList] = useState<PkRow[]>([]);
  const [pkBusy, setPkBusy] = useState(false);

  useEffect(() => {
    setQhEnabled(getQuickHideConfig().enabled);
  }, [me]);

  useEffect(() => {
    (async () => {
      try {
        if (browserSupportsWebAuthn?.()) {
          const plat = await platformAuthenticatorIsAvailable().catch(() => false);
          setPkAvail(true);
          if (!plat) setPkAvail(true); /* مفاتيح خارجية مدعومة أيضاً */
        }
      } catch {}
    })();
  }, []);

  const loadPasskeys = async () => {
    try {
      const r = await fetch("/api/auth/passkey", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setPkList(j.passkeys || []);
      }
    } catch {}
  };
  useEffect(() => { if (me) void loadPasskeys(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [me]);

  /* ★ v3.24: تفعيل مفتاح مرور لهذا الجهاز — بصمة/وجه/رمز القفل */
  const addPasskey = async () => {
    setPkBusy(true);
    try {
      const r1 = await fetch("/api/auth/passkey", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register-options" }),
      });
      const o = await r1.json().catch(() => ({}));
      if (!r1.ok) { toast.error(o.error || t("common.error")); setPkBusy(false); return; }
      const att = await startRegistration({ optionsJSON: o.options });
      const r2 = await fetch("/api/auth/passkey", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", response: att }),
      });
      const j = await r2.json().catch(() => ({}));
      if (r2.ok) {
        toast.success(t("pk.registered"));
        await loadPasskeys();
      } else toast.error(j.error || t("common.error"));
    } catch {
      toast.error(t("pk.cancelled"));
    }
    setPkBusy(false);
  };

  const delPasskey = async (credId: string) => {
    setPkBusy(true);
    try {
      const r = await fetch(`/api/auth/passkey?credId=${encodeURIComponent(credId)}`, { method: "DELETE" });
      if (r.ok) { toast.success(t("pk.deleted")); await loadPasskeys(); }
      else toast.error(t("common.error"));
    } catch { toast.error(t("err.conn")); }
    setPkBusy(false);
  };

  if (!me) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <UserRound className="mx-auto h-14 w-14 text-muted-foreground/40" />
        <p className="text-muted-foreground">{t("prof.loginHint")}</p>
        <Button onClick={() => navigate("login")}>{t("common.login")}</Button>
      </div>
    );
  }

  const saveInfo = async () => {
    setBusy(true);
    const r = await fetch("/api/auth/me", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const j = await r.json();
    setBusy(false);
    if (r.ok) { setMe(j.user); toast.success(t("toast.profileSaved")); }
    else toast.error(t("common.error"));
  };

  const changePass = async () => {
    if (!oldPass || !newPass) { toast.error(t("err.required")); return; }
    setBusy(true);
    const r = await fetch("/api/auth/me", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPass, newPass }),
    });
    const j = await r.json();
    setBusy(false);
    if (r.ok) { toast.success(t("prof.passChanged")); setOldPass(""); setNewPass(""); }
    else toast.error(j.error || t("common.error"));
  };

  /* حفظ رمز الإخفاء السريع لهذا المستخدم على هذا الجهاز */
  const saveQhPin = async () => {
    if (!/^\d{4,8}$/.test(qhPin)) { toast.error(t("qh.pinInvalid")); return; }
    if (qhPin !== qhPin2) { toast.error(t("qh.pinMismatch")); return; }
    setQhBusy(true);
    try {
      await saveQuickHideConfig(true, qhPin);
      setQhEnabled(true);
      setQhPin("");
      setQhPin2("");
      toast.success(t("qh.setupDone"));
    } catch {
      toast.error(t("qh.pinInvalid"));
    }
    setQhBusy(false);
  };

  const disableQh = async () => {
    setQhBusy(true);
    await saveQuickHideConfig(false);
    setQhEnabled(false);
    setQhBusy(false);
    toast.success(t("qh.disabledDone"));
  };

  /* اختبار الرمز فوراً */
  const testQh = async () => {
    const cfg = getQuickHideConfig();
    if (!cfg.enabled) return;
    setHidden(true);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-2">
        <BackButton onBack={() => navigate("home")} />
        <h1 className="text-xl sm:text-2xl font-black">{t("prof.title")}</h1>
      </div>

      <Card className="rounded-3xl">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-black overflow-hidden">
              {me.photoBase64 ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={me.photoBase64} alt={me.name} className="h-full w-full object-cover" />
              ) : me.name.charAt(0)}
            </span>
            <div className="min-w-0 space-y-1">
              <p className="font-black text-lg break-words">{me.name}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="border-primary/30 text-primary">{t(`roles.${me.role}`)}</Badge>
                {/* ★ v3.19: زمرة الدم — عرض فقط في ملفي (التعديل من الإدارة/المساعد/الأخصائي المعالج) */}
                {me.role === "client" && me.bloodType && (
                  <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 gap-1">
                    <Droplet className="h-3 w-3" aria-hidden="true" />
                    <span dir="ltr" className="font-bold tabular-nums">{me.bloodType}</span>
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground flex items-center gap-1" dir="ltr">
                  <Phone className="h-3.5 w-3.5" /> {me.phone}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-primary" /> {t("prof.myInfo")}</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
              <Button onClick={saveInfo} disabled={busy} className="h-11 sm:w-32">{t("common.save")}</Button>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> {t("prof.changePass")}</Label>
            <div className="grid sm:grid-cols-2 gap-2">
              <Input type="password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} placeholder={t("prof.oldPass")} className="h-11" />
              <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder={t("prof.newPass")} className="h-11" />
            </div>
            <Button onClick={changePass} disabled={busy} variant="outline" className="h-11">{t("common.confirm")}</Button>
          </div>

          {/* ★ v3.24: مفاتيح المرور — دخول بلا كلمة مرور من هذا الجهاز */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-primary" /> {t("pk.title")}</Label>
              {pkList.length > 0 && (
                <Badge variant="secondary" className="gap-1 text-[10px]">{pkList.length}</Badge>
              )}
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{t("pk.sub")}</p>
            {pkList.length > 0 ? (
              <div className="space-y-1.5">
                {pkList.map((p) => (
                  <div key={p.credId} className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5 text-sm">
                    <Fingerprint className="h-4 w-4 shrink-0 text-primary" />
                    <span className="font-bold">{t("pk.device")}</span>
                    <Badge variant="outline" className="rounded-full gap-1 text-[10px]">
                      {p.backedUp ? <><CloudUpload className="h-3 w-3" /> {t("pk.backedUp")}</> : <><Smartphone className="h-3 w-3" /> {t("pk.notBackedUp")}</>}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground tabular-nums" dir="ltr">
                      {(() => { try { return new Date(p.createdAt).toLocaleDateString(); } catch { return ""; } })()}
                    </span>
                    <Button variant="ghost" size="icon" className="ms-auto h-7 w-7 rounded-lg text-destructive"
                      aria-label={t("pk.delete")} onClick={() => void delPasskey(p.credId)} disabled={pkBusy}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">{t("pk.none")}</p>
            )}
            <Button variant="outline" onClick={addPasskey} disabled={pkBusy || !pkAvail}
              className="h-11 gap-1.5">
              <Plus className="h-4 w-4" /> {pkBusy ? t("pk.adding") : t("pk.add")}
            </Button>
            {!pkAvail && <p className="text-[12px] text-muted-foreground">{t("pk.unavailable")}</p>}
            <p className="text-[11px] leading-relaxed text-muted-foreground">{t("pk.note")}</p>
          </div>

          {/* الإخفاء السريع — كل مستخدم يدخل ويحفظ رمزه الخاص من هنا */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="flex items-center gap-2"><EyeOff className="h-4 w-4 text-primary" /> {t("qh.settingsTitle")}</Label>
              <Badge variant={qhEnabled ? "default" : "secondary"} className="gap-1 text-[10px]">
                <ShieldCheck className="h-3 w-3" />
                {qhEnabled ? t("qh.on") : t("qh.off")}
              </Badge>
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{t("qh.settingsNote")}</p>
            {qhEnabled ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={() => void testQh()} className="h-10 gap-1.5">
                  <EyeOff className="h-4 w-4" /> {t("qh.testNow")}
                </Button>
                <Button type="button" variant="outline" onClick={() => void disableQh()} disabled={qhBusy}
                  className="h-10 gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" /> {t("qh.disable")}
                </Button>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  type="password" inputMode="numeric" autoComplete="off" dir="ltr" maxLength={8}
                  value={qhPin} onChange={(e) => setQhPin(e.target.value.replace(/\D/g, ""))}
                  placeholder={t("qh.pin")} className="h-11 text-center tracking-[0.3em] font-bold"
                />
                <Input
                  type="password" inputMode="numeric" autoComplete="off" dir="ltr" maxLength={8}
                  value={qhPin2} onChange={(e) => setQhPin2(e.target.value.replace(/\D/g, ""))}
                  placeholder={t("qh.pinConfirm")} className="h-11 text-center tracking-[0.3em] font-bold"
                />
                <Button onClick={saveQhPin} disabled={qhBusy} className="h-11 sm:col-span-2">{t("common.save")}</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

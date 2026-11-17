"use client";
/**
 * ★ v3.24 — محلل النطق الذكي (AI Speech Analyzer) — للأخصائي فقط
 * تسجيل صوت المريض (غالباً طفل) وهو ينطق كلمة مستهدفة من بنك الكلمات العلاجية،
 * ثم تحليل فوري بثلاث طبقات: تحويل الكلام لنص (ASR) ← مقارنة حتمية للمخارج ←
 * تحليل ذكاء اصطناعي بسياق أرطوفوني يحدد الاشتباه المبدئي (لثغة/تأتأة/حذف/إبدال/تشويه)
 * وشدته وتوجيهات مقترحة. النتيجة مبدئية للتوجيه — لا تغني عن التقييم السريري المباشر.
 * تجاوب كامل: كل التحكم يتراص على الهاتف، والتسجيل بMediaRecorder (webm/mp4 حسب الجهاز).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AudioLines, Mic, Square, RotateCcw, Wand2, Copy, CheckCircle2,
  AlertTriangle, Info, Volume2, Sparkles, CircleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WORD_BANK, wordLabel, type Penta } from "@/lib/wordbank";
import type { Navigate } from "@/lib/nav";

type Result = {
  ok: boolean;
  noSpeech?: boolean;
  transcript: string;
  achieved: boolean;
  suspicion: { code: string; label: string }[];
  severity: { code: string; label: string };
  findings: string[];
  advice: string[];
  engine: string;
  targetWord: string;
};

const SEV_BADGE: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  mid: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
  high: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25",
};

export default function SpeechAnalyzer({ navigate }: { navigate: Navigate }) {
  const { t, lang } = useApp();
  const [letter, setLetter] = useState(WORD_BANK[0]?.letter || "ب");
  const [wordObj, setWordObj] = useState<Penta | null>(WORD_BANK[0]?.words[0] || null);
  const [custom, setCustom] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [recording, setRecording] = useState(false);
  const [askingMic, setAskingMic] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioURL, setAudioURL] = useState("");
  const [audioB64, setAudioB64] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const bank = WORD_BANK.find((w) => w.letter === letter) || WORD_BANK[0];

  const pickLetter = (l: string) => {
    setLetter(l);
    const entry = WORD_BANK.find((w) => w.letter === l);
    setWordObj(entry?.words[0] || null);
    setCustom("");
    resetTake();
  };
  const resetTake = () => {
    setAudioURL("");
    setAudioB64("");
    setResult(null);
    setSeconds(0);
    if (audioElRef.current) audioElRef.current.src = "";
  };

  /* مؤقّت التسجيل */
  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [recording]);

  /* ★ v3.24.2: طلب إذن الميكروفون بتشخيص شامل لكل حالة فشل — يضمن عمل التسجيل فعلياً:
     — كشف متصفحات التطبيقات (واتساب/فيسبوك/إنستغرام/تيليجرام داخل WebView) التي قد تمنح
       إذناً لكن لا تمرره لـ getUserMedia → توجيه بفتح الموقع في Chrome/Safari
     — فحص حالة الإذن عبر Permissions API قبل الطلب (denied/granted/prompt)
     — رسالة حسب اسم الخطأ الفعلي + الاسم التقني في الوصف لتشخيص فوري من الجهاز */
  const startRec = async () => {
    setResult(null);
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const inAppWebView = /\bwv\b|\bFBAN\b|\bFBAV\b|\bInstagram\b|\bTikTok\b|\bTelegram\b|\bSnapchat\b|\bLinkedInApp\b/i.test(ua);
    /* ★ v3.24.3: حماية iOS PWA — داخل تطبيق الموقع المثبت على الآيفون لا يمنح WKWebView
       الميكروفون وقد يُغلق التطبيق مباشرة عند الاستدعاء؛ نوجّه المستخدم لـ Safari فوراً
       بدل استدعاء getUserMedia الذي يعمل بشكل سليم في متصفح الآيفون */
    const isIOSPWA = /iP(hone|ad|od)/i.test(ua)
      && ((typeof navigator !== "undefined" && (navigator as { standalone?: boolean }).standalone === true)
        || (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)")?.matches === true));
    if (isIOSPWA) {
      toast.error(t("sa.micIOSPWA"), { duration: 12000 });
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      toast.error(t("sa.micHttps"), { duration: 8000 });
      return;
    }
    if (inAppWebView) {
      toast.error(t("sa.micWebView"), { duration: 12000 });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error(t("sa.micUnsupported"), { duration: 8000 });
      return;
    }
    /* فحص حالة الإذن أولاً — الإذن المرفوض مسبقاً يجعل getUserMedia يفشل فوراً */
    try {
      const perm = await navigator.permissions?.query?.({ name: "microphone" as PermissionName });
      if (perm?.state === "denied") {
        toast.error(t("sa.micDenied"), { description: t("sa.micDeniedHint"), duration: 10000 });
        return;
      }
    } catch { /* متصفح بلا استعلام إذن — ننتقل للطلب المباشر */ }

    setAskingMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      let rec: MediaRecorder;
      try {
        rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      } catch {
        rec = new MediaRecorder(stream); /* بعض الأجهزة ترفض خيارات الملف — الافتراضي يكفي */
      }
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        if (audioURL) URL.revokeObjectURL(audioURL);
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
        const buf = await blob.arrayBuffer();
        /* base64 — بتقسيم لدفاتر لتجنب حدود String.apply */
        const bytes = new Uint8Array(buf);
        let bin = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        setAudioB64(btoa(bin));
        stream.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
      };
      recRef.current = rec;
      rec.start();
      setSeconds(0);
      setRecording(true);
    } catch (e) {
      const name = String((e as { name?: string })?.name || "");
      const detail = `${name || "Error"}: ${String((e as { message?: string })?.message || "").slice(0, 90)}`;
      if (name === "NotAllowedError" || name === "SecurityError") {
        toast.error(t("sa.micDenied"), { description: t("sa.micDeniedHint"), duration: 10000 });
      } else if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") {
        toast.error(t("sa.micNotFound"), { duration: 8000 });
      } else if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError") {
        toast.error(t("sa.micBusy"), { duration: 8000 });
      } else if (name === "TypeError") {
        toast.error(t("sa.micUnsupported"), { description: detail, duration: 9000 });
      } else {
        toast.error(t("sa.micDenied"), { description: detail, duration: 10000 });
      }
    }
    setAskingMic(false);
  };
  const stopRec = () => {
    try { recRef.current?.stop(); } catch {}
    setRecording(false);
  };

  /* الكلمة العلاجية المرجعية عربية دائماً (مرجع ASR والمقارنة) — والعرض بلغة الواجهة */
  const effectiveWord = custom.trim() || wordObj?.ar || "";
  const effectiveDisplay = custom.trim() || (wordObj ? wordLabel(wordObj, lang) : "");
  const effectiveLetter = custom.trim() ? custom.trim().charAt(0) : letter;
  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const analyze = async () => {
    if (!effectiveWord) { toast.error(t("err.required")); return; }
    if (!audioB64) { toast.error(t("sa.noSpeech")); return; }
    setAnalyzing(true);
    setResult(null);
    try {
      const r = await fetch("/api/speech-analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: audioB64,
          targetWord: effectiveWord,
          targetDisplay: effectiveDisplay,
          targetLetter: effectiveLetter,
          lang,
          age: age === "" ? null : Number(age),
          gender: gender || null,
        }),
      });
      const j = await r.json();
      if (r.ok) {
        if (j.noSpeech) toast.error(t("sa.noSpeech"));
        else toast.success(t("sa.okTitle"));
        setResult(j);
      } else toast.error(j.error || t("sa.error"));
    } catch {
      toast.error(t("err.conn"));
    }
    setAnalyzing(false);
  };

  const copyResult = useCallback(async () => {
    if (!result) return;
    const text = [
      `${t("sa.title")} — ${t("sa.target")}: ${result.targetWord}`,
      `${t("sa.transcript")}: ${result.transcript}`,
      `${t("sa.suspicion")}: ${result.suspicion.map((s) => s.label).join("، ")}`,
      `${t("sa.severity")}: ${result.severity.label}`,
      ...result.findings.map((f) => `• ${f}`),
      ...result.advice.map((a) => `→ ${a}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("sa.copied"));
    } catch {
      toast.error(t("common.error"));
    }
  }, [result, t]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 min-w-0">
        <BackButton onBack={() => navigate("home")} />
        <h1 className="text-xl sm:text-2xl font-black break-words">{t("sa.title")}</h1>
      </div>

      <p className="rounded-xl border border-primary/15 bg-primary/[0.05] px-4 py-2.5 text-sm leading-relaxed text-primary">
        {t("sa.sub")}
      </p>

      {/* ═══ بنك الكلمات العلاجية ═══ */}
      <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
        <CardContent className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-black text-base sm:text-lg">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            {t("sa.wordBank")}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {WORD_BANK.map((w) => {
              const shown = lang === "ar" ? w.letter : (w.letterLabel[lang] || w.letter);
              return (
                <button key={w.letter} type="button" onClick={() => pickLetter(w.letter)}
                  aria-label={`${t("sa.targetLetter")} ${w.letter}`}
                  className={cn(
                    "flex min-h-10 flex-col items-center justify-center rounded-xl border px-2 py-1 text-base font-black leading-none transition-all",
                    letter === w.letter
                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "bg-card text-foreground/80 hover:border-primary/40 hover:bg-primary/5"
                  )}>
                  <span>{shown}</span>
                  {lang !== "ar" && <span className="mt-0.5 text-[9px] font-bold opacity-60">{w.letter}</span>}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-primary" /> {t("sa.target")}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {bank.words.map((w) => (
                  <button key={w.ar} type="button"
                    onClick={() => { setWordObj(w); setCustom(""); resetTake(); }}
                    className={cn(
                      "flex min-w-14 flex-col items-center rounded-full border px-3 py-1.5 transition-all",
                      wordObj?.ar === w.ar && !custom
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    )}>
                    <span className="text-sm font-bold leading-tight">{wordLabel(w, lang)}</span>
                    {lang !== "ar" && <span className="text-[9.5px] leading-tight opacity-70">{w.ar}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">{t("sa.custom")}</Label>
              <Input value={custom} onChange={(e) => { setCustom(e.target.value); resetTake(); }}
                placeholder={wordObj ? wordLabel(wordObj, lang) : ""} className="h-11 min-w-0" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("sa.targetLetter")}: <span className="font-black text-primary" dir="auto">
              {lang === "ar" ? effectiveLetter : `${bank.letterLabel[lang] || effectiveLetter} / ${effectiveLetter}`}
            </span>
            <span className="mx-1.5">·</span>
            {t("sa.target")}: <span className="font-black text-primary" dir="auto">{effectiveDisplay}</span>
            {lang !== "ar" && effectiveWord && effectiveWord !== effectiveDisplay && (
              <span className="ms-1 text-[10px] opacity-70">({effectiveWord})</span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* ═══ التسجيل ═══ */}
      <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
        <CardContent className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-black text-base sm:text-lg">
            <span className={cn(
              "flex h-10 w-10 items-center justify-center rounded-2xl",
              recording ? "bg-rose-500/10 text-rose-600" : "bg-primary/10 text-primary"
            )}>
              <AudioLines className={cn("h-5 w-5", recording && "animate-pulse")} />
            </span>
            {recording ? t("sa.recording") : t("sa.record")}
          </h2>
          {/* سياق الحالة (اختياري) */}
          <div className="grid grid-cols-1 gap-2 rounded-2xl border bg-card/50 p-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("sa.patientAge")}</Label>
              <Input type="number" min={1} max={120} value={age}
                onChange={(e) => setAge(e.target.value)} className="h-10 tabular-nums" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("sa.patientGender")}</Label>
              <Select value={gender || "none"} onValueChange={(v) => setGender(v === "none" ? "" : v)}>
                <SelectTrigger className="h-10" aria-label={t("sa.patientGender")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="male">{t("client.male")}</SelectItem>
                  <SelectItem value="female">{t("client.female")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* أزرار التسجيل */}
          <div className="flex flex-wrap items-center gap-2">
            {!recording ? (
              <Button onClick={startRec} disabled={analyzing || askingMic}
                className="h-12 gap-2 rounded-xl text-base shadow-lg shadow-primary/20">
                <Mic className="h-5 w-5" /> {askingMic ? t("sa.micAsking") : audioB64 ? t("sa.rerecord") : t("sa.record")}
              </Button>
            ) : (
              <Button onClick={stopRec} variant="destructive" className="h-12 gap-2 rounded-xl text-base">
                <Square className="h-4 w-4" /> {t("sa.stop")}
              </Button>
            )}
            {recording && (
              <span className="flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1.5 text-sm font-black tabular-nums text-rose-600" dir="ltr">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
                {mmss}
              </span>
            )}
            {audioURL && !recording && (
              <audio ref={audioElRef} src={audioURL} controls className="h-10 max-w-full" preload="metadata" />
            )}
          </div>
          <Button onClick={analyze} disabled={analyzing || recording || !audioB64 || !effectiveWord}
            className="h-12 w-full gap-2 rounded-xl text-base shadow-lg shadow-primary/20">
            <Wand2 className={cn("h-5 w-5", analyzing && "animate-pulse")} />
            {analyzing ? t("sa.analyzing") : t("sa.analyze")}
          </Button>
        </CardContent>
      </Card>

      {/* ═══ النتيجة ═══ */}
      {result && result.ok && (
        <Card className="ait-card overflow-hidden rounded-3xl shadow-sm">
          <CardContent className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-black text-base sm:text-lg">
              <span className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl",
                result.achieved ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
              )}>
                {result.achieved ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              </span>
              {result.achieved ? t("sa.achieved") : result.suspicion.some((s) => s.code !== "none") ? t("sa.partial") : t("sa.missed")}
            </h2>
            <div className="rounded-xl border bg-card/60 p-3 text-sm">
              <p className="text-xs text-muted-foreground">{t("sa.transcript")}</p>
              <p className="mt-0.5 font-bold break-words">{result.transcript || "—"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {result.suspicion.map((s) => (
                <Badge key={s.code} variant="outline" className={cn(
                  "rounded-full gap-1",
                  s.code === "none" ? SEV_BADGE.low : SEV_BADGE.mid
                )}>
                  {t(`sa.dis.${s.code}`) === `sa.dis.${s.code}` ? s.label : t(`sa.dis.${s.code}`)}
                </Badge>
              ))}
              <Badge variant="outline" className={cn("rounded-full", SEV_BADGE[result.severity.code])}>
                {t("sa.severity")}: {t(`sa.sev.${result.severity.code}`) === `sa.sev.${result.severity.code}` ? result.severity.label : t(`sa.sev.${result.severity.code}`)}
              </Badge>
            </div>
            {result.findings.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-sm font-black">{t("sa.findings")}</p>
                <ul className="space-y-1">
                  {result.findings.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm leading-relaxed text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                      <span className="break-words">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.advice.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-sm font-black">{t("sa.advice")}</p>
                <ul className="space-y-1">
                  {result.advice.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm leading-relaxed text-emerald-700 dark:text-emerald-400">
                      <Volume2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="break-words">{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={copyResult} className="gap-1.5 rounded-full text-xs">
                <Copy className="h-3.5 w-3.5" /> {t("sa.copy")}
              </Button>
              <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <CircleAlert className="h-3.5 w-3.5 shrink-0" /> {t("sa.disclaimer")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

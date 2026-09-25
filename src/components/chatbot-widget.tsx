"use client";
/**
 * المساعد الذكي (v3.9.0) — ودجت عائم بأسئلة وأجوبة فورية
 * ★ v3.9.0:
 *  - زر إغلاق (×) دائم بجانب البوت — يُخفي الودجت كلياً من الواجهة لبقية الجلسة
 *    (نفس نمط زر واتساب تماماً) — ويعود في زيارة قادمة
 *  - النافذة بارتفاع كامل مرن: الأجوبة تأخذ كل المساحة المتاحة (flex-1) مع تمرير،
 *    والأسئلة السريعة في شريط مضغوط — لا تضيق مساحة الأجوبة أبداً
 *  - متجاوبة تماماً: عرض/ارتفاع آمنان لا يتجاوزان إطار الشاشة على الحاسوب والجوال
 *  - إجابات بخمس لغات + إرسال لغة الواجهة للخادم — يعمل حتى بلا إنترنت (وضع عدم الاتصال)
 *  ★ v3.10: أزرار الأسئلة السريعة ترسل «نية» مباشرة (intent) — الإجابة الصحيحة
 *    حرفياً بكل اللغات بلا تخمين، ومحرك النص الحر أقوى بأولويات ومرادفات موسعة
 */
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Bot, X, SendHorizonal, Sparkles } from "lucide-react";

type Msg = {
  from: "me" | "bot";
  text: string;
  link?: string;
  linkLabel?: string;
};

/** اختيار نص الخادم حسب لغة الواجهة مع سقوط تلقائي */
function pickReply(r: Record<string, unknown>, lang: string): string {
  const chain =
    lang === "tr" ? ["textTr", "textFr", "textEn", "text"]
    : lang === "es" ? ["textEs", "textFr", "textEn", "text"]
    : lang === "fr" ? ["textFr", "textEn", "text"]
    : lang === "en" ? ["textEn", "textFr", "text"]
    : ["text", "textFr", "textEn"];
  for (const k of chain) {
    const v = String(r[k] ?? "").trim();
    if (v) return v;
  }
  return "";
}
function pickLabel(r: Record<string, unknown>, lang: string): string {
  const chain =
    lang === "tr" ? ["linkLabelTr", "linkLabelFr", "linkLabelEn", "linkLabel"]
    : lang === "es" ? ["linkLabelEs", "linkLabelFr", "linkLabelEn", "linkLabel"]
    : lang === "fr" ? ["linkLabelFr", "linkLabelEn", "linkLabel"]
    : lang === "en" ? ["linkLabelEn", "linkLabelFr", "linkLabel"]
    : ["linkLabel", "linkLabelFr", "linkLabelEn"];
  for (const k of chain) {
    const v = String(r[k] ?? "").trim();
    if (v) return v;
  }
  return "";
}

/** ★ v3.10: الأسئلة السريعة ترسل النية (intent) مع النص — الإجابة الصحيحة حرفياً بأي لغة */
const QUICK: { id: string; key: string }[] = [
  { id: "booking", key: "bot.q1" },
  { id: "price", key: "bot.q2" },
  { id: "remote", key: "bot.q3" },
  { id: "address", key: "bot.q4" },
  { id: "password", key: "bot.q5" },
  { id: "hours", key: "bot.q6" },
];
const BOT_DISMISS_KEY = "ait_bot_dismissed";

export default function ChatbotWidget() {
  const { t, lang, navigate, hidden } = useApp();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* حالة الإخفاء تُقرأ بعد الإقلاع (تفادي اختلاف الترميز بين الخادم والعميل) */
  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(BOT_DISMISS_KEY) === "1");
    } catch {}
  }, []);

  const greet = t("bot.welcome");

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{ from: "bot", text: greet }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  const send = async (text?: string, intent?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || typing) return;
    setInput("");
    setMsgs((m) => [...m, { from: "me", text: msg }]);
    setTyping(true);
    try {
      const r = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, lang, ...(intent ? { intent } : {}) }),
      });
      const j = await r.json().catch(() => null);
      const reply = j?.reply as Record<string, unknown> | null;
      setMsgs((m) => [
        ...m,
        reply
          ? {
              from: "bot",
              text: pickReply(reply, lang) || "…",
              link: typeof reply.link === "string" ? reply.link : undefined,
              linkLabel: pickLabel(reply, lang),
            }
          : { from: "bot", text: t("bot.noReply") },
      ]);
    } catch {
      setMsgs((m) => [...m, { from: "bot", text: t("bot.noReply") }]);
    } finally {
      setTyping(false);
    }
  };

  if (hidden || dismissed) return null;

  return (
    <div className="relative flex items-center gap-1.5">
      {/* زر البوت */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("bot.title")}
        title={t("bot.title")}
        className={cn(
          "flex h-13 w-13 md:h-14 md:w-14 rounded-full shadow-xl shadow-primary/25",
          "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
          "flex items-center justify-center transition-transform active:scale-95 hover:scale-105"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
        {!open && <span className="absolute -top-0.5 -end-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-background" />}
      </button>

      {/* زر الإغلاق (×) الدائم بجانب البوت — يخفي الودجت كلياً لبقية الجلسة (نمط واتساب) */}
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setDismissed(true);
          try {
            sessionStorage.setItem(BOT_DISMISS_KEY, "1");
          } catch {}
        }}
        aria-label={t("bot.dismiss")}
        title={t("bot.dismiss")}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-muted-foreground shadow-md ring-1 ring-border transition-all hover:bg-destructive hover:text-white hover:rotate-90 active:scale-90"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {open && (
        <Card className="absolute z-50 bottom-full mb-3 end-0 flex flex-col overflow-hidden rounded-3xl border shadow-2xl w-[min(24rem,calc(100vw-2rem))] h-[min(36rem,calc(100dvh-11rem))]">
          {/* رأس */}
          <div className="bg-gradient-to-r from-primary to-primary/85 text-primary-foreground p-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
              <Bot className="h-5.5 w-5.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-black text-sm leading-tight">{t("bot.title")}</p>
              <p className="text-[11px] opacity-85 leading-tight">{t("bot.status")}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-primary-foreground hover:bg-white/15" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* الرسائل — تأخذ كل المساحة المتاحة (flex-1) مع تمرير داخلي */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2.5 bg-muted/30">
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                  m.from === "me"
                    ? "bg-primary text-primary-foreground rounded-ee-md"
                    : "bg-card border rounded-es-md shadow-sm"
                )}>
                  <p className="whitespace-pre-line">{m.text}</p>
                  {m.link && m.linkLabel && (
                    <Button
                      size="sm"
                      className="mt-2 h-8 rounded-full gap-1 text-xs"
                      onClick={() => { setOpen(false); navigate(m.link!); }}
                    >
                      <Sparkles className="h-3 w-3" />
                      {m.linkLabel}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-card border rounded-2xl rounded-es-md px-4 py-3 flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* أسئلة سريعة — شريط مضغوط بسقف ثابت لا يبتلع مساحة الأجوبة
              ★ v3.10: كل زر يرسل نويته مباشرة — الإجابة الصحيحة مضمونة بكل اللغات */}
          <div className="shrink-0 max-h-[5.2rem] overflow-y-auto px-3 pt-2 flex gap-1.5 flex-wrap bg-background">
            {QUICK.map((q) => (
              <button
                key={q.key}
                type="button"
                onClick={() => send(t(q.key), q.id)}
                className="text-[11px] font-semibold rounded-full border bg-muted/50 px-2.5 py-1 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition"
              >
                {t(q.key)}
              </button>
            ))}
          </div>

          {/* الإدخال — ثابت أسفل النافذة */}
          <div className="shrink-0 p-3 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={t("bot.placeholder")}
              className="flex-1 h-10 rounded-full border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40 min-w-0"
            />
            <Button size="icon" className="h-10 w-10 rounded-full shrink-0" onClick={() => send()} disabled={!input.trim() || typing}>
              <SendHorizonal className="h-4 w-4 rtl:-scale-x-100" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

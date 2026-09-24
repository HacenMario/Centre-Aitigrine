"use client";
/**
 * المساعد الذكي (v3.8.1) — ودجت عائم بأسئلة وأجوبة فورية
 * ★ v3.8.1:
 *  - زر إغلاق (×) بجانب زر البوت عند فتح النافذة — نفس نمط زر واتساب
 *  - لا يتراكب مع زر واتساب أو «العودة للأعلى»: يُرتكز داخل حزمة الأزرار العائمة (app-shell)
 *  - إجابات بخمس لغات + أسئلة سريعة أكثر (6) + إرسال لغة الواجهة للخادم
 *  - لوحة المحادثة تُفتح إلى الأعلى بعرض آمن لا يتجاوز إطار الشاشة في الجوال
 * — يُخفى تلقائياً في وضع الإخفاء السريع — يعمل دائماً، حتى بلا إنترنت (وضع عدم الاتصال)
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

const QUICK_KEYS = ["bot.q1", "bot.q2", "bot.q3", "bot.q4", "bot.q5", "bot.q6"];

export default function ChatbotWidget() {
  const { t, lang, navigate, hidden } = useApp();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || typing) return;
    setInput("");
    setMsgs((m) => [...m, { from: "me", text: msg }]);
    setTyping(true);
    try {
      const r = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, lang }),
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

  if (hidden) return null;

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

      {/* زر الإغلاق (×) بجانب البوت — نفس نمط زر واتساب */}
      {open && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t("common.close")}
          title={t("common.close")}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-muted-foreground shadow-md ring-1 ring-border transition-all hover:bg-destructive hover:text-white hover:rotate-90 active:scale-90"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <Card className="absolute z-50 bottom-full mb-3 end-0 w-[min(22rem,calc(100vw-2rem))] rounded-3xl shadow-2xl border overflow-hidden">
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

          {/* الرسائل */}
          <div ref={scrollRef} className="p-3 space-y-2.5 max-h-[45dvh] md:max-h-[55dvh] overflow-y-auto bg-muted/30">
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

          {/* أسئلة سريعة */}
          <div className="px-3 pt-2 flex gap-1.5 flex-wrap bg-background">
            {QUICK_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => send(t(k))}
                className="text-[11px] font-semibold rounded-full border bg-muted/50 px-2.5 py-1 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition"
              >
                {t(k)}
              </button>
            ))}
          </div>

          {/* الإدخال */}
          <div className="p-3 flex items-center gap-2">
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

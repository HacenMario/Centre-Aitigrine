"use client";
/**
 * v3.21.0 — أزرار «نشر على انستغرام» و «نشر على فايسبوك»
 * ─────────────────────────────────────────────────────────────
 * الهدف: يمكّن المستخدمين من نشر كتاب/مقال/تكوين/إعلان أعجبهم مع أصحابهم ومتابعيهم.
 *
 * انستغرام (لا يملك رابط مشاركة ويب مباشر — المنطق الاحترافي المعتمد عالمياً):
 *   1) توليد صورة بمقاس انستغرام 1080×1350 (4:5) محلياً في المتصفح (Canvas):
 *      شعار المركز + نوع العنصر + صورته + عنوانه + نبذته + رابط الموقع المباشر.
 *   2) على الهاتف: زر «مشاركة مباشرة» عبر Web Share API — تُفتح ورقة مشاركة النظام
 *      فتُرسل الصورة والنص إلى انستغرام بلمسة واحدة (ستوري/منشور/رسالة).
 *   3) أينما لا يتوفر ذلك: تحميل الصورة + نسخ المنشور (العنوان والنبذة والرابط والوسوم)
 *      ثم فتح انستغرام — ثلاث خطوات موجهة داخل النافذة.
 *   الرابط في كل الحالات يفتح العنصر نفسه مباشرة (?view=…&id=…).
 *
 * فايسبوك: يملك مشاركة ويب رسمية — نافذة sharer.php مع quote، ومعاينة غنية
 *   تُبنى من معلومات og الخادمية (page.tsx) فيظهر العنوان والنبذة والصورة تلقائياً.
 *
 * ★ مكوّن معزول تماماً: لا يقرأ ولا يعدّل أي حالة خارجية — يُستخدم في البطاقات الأربعة.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Download, Copy, ExternalLink, Loader2, RefreshCw, Share2, Link2, Check } from "lucide-react";
import { toast } from "sonner";
import { FacebookGlyph, InstagramGlyph } from "@/components/social-icons";
import { cn } from "@/lib/utils";

export type ShareKind = "article" | "ebook" | "course" | "ad";

export type ShareTarget = {
  kind: ShareKind;
  id: string;
  /** العنوان بلغة المستخدم الحالية */
  title: string;
  /** نبذة قصيرة بلغة المستخدم (اختياري) */
  summary?: string;
  /** غلاف/صورة العنصر — data URL أو /api/media/… (نفس الأصل ⇒ Canvas آمن) */
  image?: string;
};

const VIEW_OF: Record<ShareKind, string> = {
  article: "articles",
  ebook: "ebooks",
  course: "courses",
  ad: "ads",
};

/** رابط العنصر المباشر — يفتح العنصر نفسه فوراً (استهلاك viewId في كل صفحة) */
export function itemShareUrl(kind: ShareKind, id: string): string {
  try {
    return `${window.location.origin}/?view=${VIEW_OF[kind]}&id=${id}`;
  } catch {
    return `/?view=${VIEW_OF[kind]}&id=${id}`;
  }
}

/** وسم العلامة ثابت — عربي + لاتيني يليق بكل اللغات */
const HASHTAGS = "#مركز_آيت_تقرين #AitTegrine";

function clip(s: string, max: number): string {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

const RTL_RE = /[\u0600-\u06FF]/;

/* ═══════════════════ محرك صورة انستغرام (Canvas) ═══════════════════ */

const W = 1080;
const H = 1350;
const BRAND = "#0d7a6f";

type Ctx2D = CanvasRenderingContext2D;

/** لفّ نص على أسطر بحد أقصى — مع بنقطتين في نهاية آخر سطر إذا قُطع */
function wrap(ctx: Ctx2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) {
    /* هل بقيت كلمات؟ أضف … لآخر سطر */
    const consumed = lines.join(" ").length;
    if (consumed < (text || "").replace(/\s+/g, " ").trim().length) {
      let last = lines[maxLines - 1];
      while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 1) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number) {
  /* ★ arcTo يتشوه بشكل عملاق إن كان نصف القطر أكبر من نصف ضلعي المستطيل —
     نحصره دائماً داخل الحدود (شارة الـpill تستخدم 999 لشكل دائري) */
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** رسم صورة بغطاء cover داخل مستطيل بحواف دائرية */
function drawCover(ctx: Ctx2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number) {
  roundRect(ctx, x, y, w, h, r);
  ctx.save();
  ctx.clip();
  const ir = img.width / img.height;
  const br = w / h;
  let sw = img.width, sh = img.height, sx = 0, sy = 0;
  if (ir > br) {
    sw = img.height * br;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / br;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/** انتظار خط الموقع داخل Canvas (يُرسم بكايرو كما في الواجهة) */
async function ensureFonts(): Promise<void> {
  try {
    if (typeof document !== "undefined" && document.fonts) {
      await Promise.race([
        Promise.all([
          document.fonts.load('900 64px Cairo'),
          document.fonts.load('700 44px Cairo'),
          document.fonts.load('600 34px Cairo'),
        ]),
        new Promise((res) => setTimeout(res, 900)),
      ]);
    }
  } catch {}
}

const KIND_EMOJI: Record<ShareKind, string> = { article: "📰", ebook: "📚", course: "🎓", ad: "📣" };

/**
 * توليد صورة المشاركة 1080×1350 — كل النصوص بلغة المستخدم الحالية
 * ترجع dataURL للعرض + Blob للتحميل/المشاركة، أو null عند تعذر الرسم
 */
async function renderShareImage(
  target: ShareTarget,
  texts: { siteName: string; kindLabel: string; cta: string; url: string }
): Promise<{ dataUrl: string; blob: Blob } | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  await ensureFonts();

  /* ── الخلفية: تدرج فاتح بلمسة العلامة ── */
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#FBFDFC");
  bg.addColorStop(1, "#E9F4F1");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  /* هالة علوية بلون العلامة */
  const glow = ctx.createRadialGradient(W / 2, -120, 40, W / 2, -120, 720);
  glow.addColorStop(0, "rgba(13,122,111,0.14)");
  glow.addColorStop(1, "rgba(13,122,111,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const rtl = RTL_RE.test(texts.siteName) || RTL_RE.test(target.title);
  const MX = 64; /* هامش جانبي */

  /* ── الرأس: الشعار + اسم المركز ── */
  let topY = 96;
  const logo = await loadImage("/logo.png");
  const logoSize = 84;
  if (logo) {
    roundRect(ctx, rtl ? W - MX - logoSize : MX, topY - logoSize / 2, logoSize, logoSize, 20);
    ctx.save();
    ctx.clip();
    /* خلفية بيضاء خلف الشعار (الشعار قد يكون شفافاً) */
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(rtl ? W - MX - logoSize : MX, topY - logoSize / 2, logoSize, logoSize);
    const lr = Math.min(logo.width, logo.height);
    ctx.drawImage(
      logo,
      (logo.width - lr) / 2, (logo.height - lr) / 2, lr, lr,
      rtl ? W - MX - logoSize : MX, topY - logoSize / 2, logoSize, logoSize
    );
    ctx.restore();
  }
  ctx.fillStyle = BRAND;
  ctx.font = "900 46px Cairo, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = rtl ? "right" : "left";
  const nameX = rtl ? W - MX - (logo ? logoSize + 24 : 0) : MX + (logo ? logoSize + 24 : 0);
  ctx.fillText(texts.siteName, nameX, topY);

  /* ── شارة نوع العنصر ── */
  const pillY = 196;
  ctx.font = "700 34px Cairo, sans-serif";
  const kw = ctx.measureText(texts.kindLabel).width;
  const padX = 30, pillW = kw + padX * 2, pillH = 64;
  const pillX = rtl ? W - MX - pillW : MX;
  ctx.fillStyle = BRAND;
  roundRect(ctx, pillX, pillY, pillW, pillH, 999);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(texts.kindLabel, pillX + pillW / 2, pillY + pillH / 2 + 2);

  /* ── صورة العنصر (cover داخل إطار دائري) ── */
  const imgY = pillY + pillH + 34;
  const imgH = 560;
  const cover = target.image ? await loadImage(target.image) : null;
  if (cover) {
    drawCover(ctx, cover, MX, imgY, W - MX * 2, imgH, 32);
    /* إطار خفيف */
    ctx.strokeStyle = "rgba(13,122,111,0.18)";
    ctx.lineWidth = 2;
    roundRect(ctx, MX, imgY, W - MX * 2, imgH, 32);
    ctx.stroke();
  } else {
    /* بلا صورة: لوحة متدرجة + رمز النوع */
    const g2 = ctx.createLinearGradient(MX, imgY, W - MX, imgY + imgH);
    g2.addColorStop(0, "#0d7a6f");
    g2.addColorStop(1, "#14958a");
    ctx.fillStyle = g2;
    roundRect(ctx, MX, imgY, W - MX * 2, imgH, 32);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.font = "200px Cairo, sans-serif";
    ctx.fillText(KIND_EMOJI[target.kind], W / 2, imgY + imgH / 2);
  }

  /* ── العنوان ── */
  let ty = imgY + imgH + 66;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = rtl ? "right" : "left";
  const tx = rtl ? W - MX : MX;
  ctx.font = "900 58px Cairo, sans-serif";
  ctx.fillStyle = "#101828";
  const titleLines = wrap(ctx, target.title, W - MX * 2, 3);
  for (const line of titleLines) {
    ctx.fillText(line, tx, ty);
    ty += 74;
  }

  /* ── النبذة ── */
  if (target.summary) {
    ty += 12;
    ctx.font = "600 36px Cairo, sans-serif";
    ctx.fillStyle = "#475467";
    const sumLines = wrap(ctx, target.summary, W - MX * 2, 3);
    for (const line of sumLines) {
      ctx.fillText(line, tx, ty);
      ty += 52;
    }
  }

  /* ── الشريط السفلي: الدعوة + الرابط ── */
  const fy = H - 176;
  ctx.fillStyle = BRAND;
  roundRect(ctx, MX, fy, W - MX * 2, 112, 28);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 36px Cairo, sans-serif";
  ctx.fillText(texts.cta, W / 2, fy + 46);
  ctx.font = "700 31px Cairo, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  const urlShort = texts.url.replace(/^https?:\/\//, "");
  ctx.fillText(urlShort.length > 52 ? `${urlShort.slice(0, 51)}…` : urlShort, W / 2, fy + 88);

  /* ── التصدير ── */
  try {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.92)
    );
    if (!blob) return null;
    return { dataUrl, blob };
  } catch {
    return null;
  }
}

/* ═══════════════════ نسخة المنشور ═══════════════════ */

function buildCaption(target: ShareTarget, url: string): string {
  const parts = [`📌 ${target.title}`];
  if (target.summary) parts.push("", clip(target.summary, 200));
  parts.push("", `🔗 ${url}`, "", HASHTAGS);
  return parts.join("\n");
}

/* ═══════════════════ المكوّن ═══════════════════ */

export default function ShareButtons({ target, className }: { target: ShareTarget; className?: string }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [shot, setShot] = useState<{ dataUrl: string; blob: Blob } | null>(null);
  const [copied, setCopied] = useState(false);
  const urlRef = useRef("");

  const url = itemShareUrl(target.kind, target.id);
  urlRef.current = url;
  const caption = buildCaption(target, url);

  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(
    target.summary ? `${target.title} — ${clip(target.summary, 140)}` : target.title
  )}`;

  const generate = useCallback(async () => {
    if (shot) return;
    setBusy(true);
    setFailed(false);
    const out = await renderShareImage(target, {
      siteName: t("app.name"),
      kindLabel: t(`shr.kind.${target.kind}`),
      cta: t("shr.imageCta"),
      url,
    });
    setBusy(false);
    if (out) setShot(out);
    else setFailed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, t, url, shot]);

  /* عند فتح النافذة: جهّز الصورة فوراً (المشاركة المباشرة تحتاجها جاهزة داخل لمسة المستخدم) */
  useEffect(() => {
    if (open) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    setOpen(false);
    /* إبقاء الصورة محفوظة لإعادة الفتح السريع — لا إعادة توليد */
  };

  const file = shot ? new File([shot.blob], `ait-tegrine-${target.kind}.jpg`, { type: "image/jpeg" }) : null;
  const canDirect = !!file && typeof navigator !== "undefined" && !!navigator.canShare && !!navigator.share &&
    (() => { try { return navigator.canShare({ files: [file] }); } catch { return false; } })();

  const directShare = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: caption });
    } catch {
      /* المستخدم ألغى ورقة المشاركة — لا رسالة */
    }
  };

  const download = () => {
    if (!shot) return;
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(shot.blob);
      a.download = `ait-tegrine-${target.kind}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast.success(t("shr.downloaded"));
    } catch {
      toast.error(t("shr.failImage"));
    }
  };

  const copyPost = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(caption);
      } else {
        const ta = document.createElement("textarea");
        ta.value = caption;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success(t("shr.copied"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <>
      <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
        {/* فايسبوك — رابط مشاركة رسمي في تبويب جديد (لا يُحجب أبداً بكونه تنقلاً حقيقياً) */}
        <a
          href={fbHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("shr.facebook")}
          title={t("shr.facebook")}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#1877F2] px-3 text-xs font-black text-white shadow-sm transition-all hover:scale-[1.04] hover:bg-[#1465d8] active:scale-95"
        >
          <FacebookGlyph className="h-3.5 w-3.5" />
          <span>{t("shr.facebook")}</span>
        </a>
        {/* انستغرام — نافذة تجهيز الصورة بمقاس انستغرام + مشاركة موجهة */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("shr.instagram")}
          title={t("shr.instagram")}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#962FBF] px-3 text-xs font-black text-white shadow-sm transition-all hover:scale-[1.04] hover:brightness-105 active:scale-95"
        >
          <InstagramGlyph className="h-3.5 w-3.5" />
          <span>{t("shr.instagram")}</span>
        </button>
      </div>

      {/* نافذة النشر على انستغرام */}
      <Dialog open={open} onOpenChange={(v) => !v && close()}>
        <DialogContent className="max-w-md max-h-[92dvh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-start">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#962FBF] text-white shadow-sm">
                <InstagramGlyph className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 break-words whitespace-normal">{t("shr.title")}</span>
            </DialogTitle>
            <DialogDescription className="text-start leading-relaxed">
              {t("shr.desc")}
            </DialogDescription>
          </DialogHeader>

          {busy ? (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-semibold">{t("shr.preparing")}</p>
            </div>
          ) : failed || !shot ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-center text-sm font-semibold text-muted-foreground">{t("shr.failImage")}</p>
              <Button variant="outline" onClick={() => { setShot(null); setFailed(false); setTimeout(() => void generate(), 0); }} className="gap-2 rounded-xl">
                <RefreshCw className="h-4 w-4" /> {t("common.retry")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* معاينة الصورة بمقاس انستغرام */}
              <div className="space-y-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shot.dataUrl} alt={t("shr.title")} className="w-full rounded-2xl border shadow-sm" />
                <p className="text-center text-[11px] font-semibold text-muted-foreground" dir="ltr">
                  {t("shr.imageReady")}
                </p>
              </div>

              {/* نص المنشور الجاهز */}
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-black text-foreground/80">
                  <Share2 className="h-3.5 w-3.5 text-primary" /> {t("shr.captionLabel")}
                </p>
                <div className="rounded-xl border bg-muted/40 p-2.5">
                  <p dir="auto" className="max-h-28 overflow-y-auto whitespace-pre-line break-words text-xs leading-relaxed text-foreground/85">
                    {caption}
                  </p>
                </div>
              </div>

              {/* المشاركة المباشرة — الهاتف فقط (ورقة مشاركة النظام ⇒ انستغرام بلمسة واحدة) */}
              {canDirect && (
                <Button
                  onClick={directShare}
                  className="h-12 w-full gap-2 rounded-xl bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#962FBF] text-base font-black text-white shadow-md transition-transform hover:scale-[1.01]"
                >
                  <Share2 className="h-5 w-5" /> {t("shr.directShare")}
                </Button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={download} className="h-10 gap-1.5 rounded-xl text-xs font-bold">
                  <Download className="h-4 w-4" /> {t("shr.downloadImage")}
                </Button>
                <Button variant="outline" onClick={copyPost} className="h-10 gap-1.5 rounded-xl text-xs font-bold">
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? t("shr.copiedShort") : t("shr.copyPost")}
                </Button>
              </div>

              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border bg-card text-xs font-bold text-foreground transition-colors hover:bg-muted"
              >
                <InstagramGlyph className="h-4 w-4 text-[#D62976]" />
                {t("shr.openInstagram")}
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>

              {/* الخطوات الموجهة — تظهر حين لا تتوفر المشاركة المباشرة */}
              {!canDirect && (
                <ol className="space-y-1.5 rounded-xl bg-primary/5 border border-primary/15 p-3 text-xs leading-relaxed text-foreground/85">
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-black text-primary">1</span>
                    <span className="min-w-0">{t("shr.step1")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-black text-primary">2</span>
                    <span className="min-w-0 flex items-center gap-1">{t("shr.step2")} <Link2 className="h-3 w-3 text-primary" /></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-black text-primary">3</span>
                    <span className="min-w-0">{t("shr.step3")}</span>
                  </li>
                </ol>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

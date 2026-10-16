"use client";
/**
 * v3.21.0 / v3.21.1 — أزرار «نشر على انستغرام» و «نشر على فايسبوك»
 * ─────────────────────────────────────────────────────────────
 * الهدف: يمكّن المستخدمين من نشر كتاب/مقال/تكوين/إعلان أعجبهم مع أصحابهم ومتابعيهم.
 * ★ v3.21.1: الزران للإدارة والمساعد فقط — يختفيان ذاتياً عن غيرهما.
 *
 * انستغرام (لا يملك رابط مشاركة ويب مباشر — المنطق الاحترافي المعتمد عالمياً):
 *   1) توليد صورة بمقاس انستغرام 1080×1350 (4:5) محلياً في المتصفح (Canvas):
 *      شعار المركز واسمه بحجم واضح + شارة نوع العنصر بجانبها المؤلف/المكوِّن بصورته
 *      + صورة العنصر + العنوان فقط + «اقرأ المزيد على موقعنا» و أسفلها 🔗 دومين الموقع.
 *      ★ كل نصوص الصورة بلغة الواجهة الحالية — وتُولَّد من جديد عند كل تغيير للغة.
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
  /** ★ v3.21.1: اسم المؤلف/المكوِّن — يظهر في صورة انستغرام بجانب شارة النوع مع صورته */
  author?: string;
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
const HASHTAGS = "#مركز_آيت_تقرين #AitTegrineCenter";

/** ★ v3.21.1: دومين الموقع الرسمي — يظهر في أسفل الصورة المولّدة تحت عبارة الدعوة */
const SITE_DOMAIN = "centreaitigrine.com";

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
 * توليد صورة المشاركة 1080×1350 — كل النصوص بلغة الواجهة الحالية
 * ★ v3.21.1: شعار واسم المركز بحجم أوضح + شارة النوع مع المؤلف بصورته
 *   + العنوان فقط دون التفاصيل + «اقرأ المزيد على موقعنا» يليها 🔗 SITE_DOMAIN.
 * ترجع dataURL للعرض + Blob للتحميل/المشاركة، أو null عند تعذر الرسم
 */
async function renderShareImage(
  target: ShareTarget,
  texts: {
    siteName: string;
    kindLabel: string;
    cta: string;
    /** «بقلم/بتأطير {name}» جاهزة بالاسم — فارغة إن لا مؤلف (الإعلانات) */
    byLine: string;
    /** صورة المؤلف data URL — فارغة ⇒ يُرسم حرف الاسم الأول بدلها */
    authorPhoto: string;
  }
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

  /* ── الرأس: شعار كبير + اسم المركز بحجم واضح (★ v3.21.1) ── */
  const topY = 124; /* المركز العمودي للشعار واسم المركز */
  const logo = await loadImage("/logo.png");
  const logoSize = 132;
  if (logo) {
    roundRect(ctx, rtl ? W - MX - logoSize : MX, topY - logoSize / 2, logoSize, logoSize, 28);
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
  /* اسم المركز — يتقلص تلقائياً إن كان طويلاً كي لا يُقطع */
  const nameGap = 28;
  const nameAvail = W - MX * 2 - (logo ? logoSize + nameGap : 0);
  let nameFs = 58;
  ctx.font = `900 ${nameFs}px Cairo, sans-serif`;
  while (ctx.measureText(texts.siteName).width > nameAvail && nameFs > 34) {
    nameFs -= 2;
    ctx.font = `900 ${nameFs}px Cairo, sans-serif`;
  }
  ctx.fillStyle = BRAND;
  ctx.textBaseline = "middle";
  ctx.textAlign = rtl ? "right" : "left";
  const nameX = rtl ? W - MX - (logo ? logoSize + nameGap : 0) : MX + (logo ? logoSize + nameGap : 0);
  ctx.fillText(texts.siteName, nameX, topY);

  /* ── شارة النوع + المؤلف بصورته بجانبها (★ v3.21.1) ── */
  const rowY = 226;
  const rowH = 72;
  ctx.font = "700 36px Cairo, sans-serif";
  const kw = ctx.measureText(texts.kindLabel).width;
  const padX = 32, pillW = kw + padX * 2, pillH = rowH;
  const pillX = rtl ? W - MX - pillW : MX;
  ctx.fillStyle = BRAND;
  roundRect(ctx, pillX, rowY, pillW, pillH, 999);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(texts.kindLabel, pillX + pillW / 2, rowY + rowH / 2 + 2);

  /* المؤلف: صورته في دائرة بجانب الشارة + عبارة «بقلم/بتأطير فلان» بلغة الواجهة */
  if (texts.byLine) {
    const AV = rowH;
    const avX = rtl ? pillX - 22 - AV : pillX + pillW + 22;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avX + AV / 2, rowY + rowH / 2, AV / 2, 0, Math.PI * 2);
    ctx.clip();
    const avImg = texts.authorPhoto ? await loadImage(texts.authorPhoto) : null;
    if (avImg) {
      /* صورة المؤلف تغطي الدائرة كاملة */
      const ir = avImg.width / avImg.height;
      let sw = avImg.width, sh = avImg.height, sx = 0, sy = 0;
      if (ir > 1) {
        sw = avImg.height;
        sx = (avImg.width - sw) / 2;
      } else {
        sh = avImg.width;
        sy = (avImg.height - sh) / 2;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(avX, rowY, AV, AV);
      ctx.drawImage(avImg, sx, sy, sw, sh, avX, rowY, AV, AV);
    } else {
      /* بلا صورة: دائرة بلون العلامة وحرف الاسم الأول */
      ctx.fillStyle = BRAND;
      ctx.fillRect(avX, rowY, AV, AV);
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 40px Cairo, sans-serif";
      const initial = Array.from((target.author || "").trim())[0] || "•";
      ctx.textAlign = "center";
      ctx.fillText(initial, avX + AV / 2, rowY + rowH / 2 + 3);
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(13,122,111,0.30)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(avX + AV / 2, rowY + rowH / 2, AV / 2 - 1.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = "700 36px Cairo, sans-serif";
    ctx.fillStyle = "#344054";
    ctx.textBaseline = "middle";
    ctx.textAlign = rtl ? "right" : "left";
    const tX = rtl ? avX - 18 : avX + AV + 18;
    const tAvail = rtl ? tX - MX : W - MX - tX;
    let line = texts.byLine;
    if (ctx.measureText(line).width > tAvail) {
      while (line.length > 1 && ctx.measureText(`${line}…`).width > tAvail) line = line.slice(0, -1);
      line = `${line}…`;
    }
    ctx.fillText(line, tX, rowY + rowH / 2);
  }

  /* ── صورة العنصر (cover داخل إطار دائري) ── */
  const imgY = rowY + rowH + 44;
  const imgH = 550;
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

  /* ── العنوان فقط دون التفاصيل (★ v3.21.1) — بحجم أوضح ويتمركز عمودياً في فراغه ── */
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = rtl ? "right" : "left";
  const tx = rtl ? W - MX : MX;
  ctx.font = "900 62px Cairo, sans-serif";
  ctx.fillStyle = "#101828";
  const titleLines = wrap(ctx, target.title, W - MX * 2, 3);
  const lh = 76;
  let ty = imgY + imgH + 78 + Math.floor(((3 - titleLines.length) * lh) / 2);
  for (const line of titleLines) {
    ctx.fillText(line, tx, ty);
    ty += lh;
  }

  /* ── الشريط السفلي: الدعوة + أسفلها 🔗 دومين الموقع الرسمي (★ v3.21.1) ── */
  const fy = H - 176;
  ctx.fillStyle = BRAND;
  roundRect(ctx, MX, fy, W - MX * 2, 112, 28);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 36px Cairo, sans-serif";
  ctx.fillText(texts.cta, W / 2, fy + 46);
  /* الإيموجي مع دومين الموقع الرسمي — خطوط الإيموجي احتياطاً لكل الأنظمة */
  ctx.font = '700 32px Cairo, "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText(`🔗 ${SITE_DOMAIN}`, W / 2, fy + 89);

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

/* ═══════════════════ المؤلف/المكوِّن ═══════════════════ */

/**
 * ★ v3.21.1: اسم وصورة المؤلف/المكوِّن من الخادم — للعناصر المنشورة فقط.
 * الصورة غير متاحة في بيانات البطاقة (تُحفظ في حساب المستخدم) — تُجلب لحظة التوليد فقط.
 * صمت تام عند أي خطأ: يُرسم حرف الاسم الأول بدل الصورة.
 */
async function fetchAuthor(kind: ShareKind, id: string): Promise<{ name: string; photo: string }> {
  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 3500);
    const r = await fetch(`/api/share-author?view=${VIEW_OF[kind]}&id=${id}`, { signal: ctrl.signal });
    clearTimeout(tm);
    if (!r.ok) return { name: "", photo: "" };
    const j = (await r.json()) as { name?: string; photo?: string };
    return {
      name: typeof j?.name === "string" ? j.name : "",
      photo: typeof j?.photo === "string" ? j.photo : "",
    };
  } catch {
    return { name: "", photo: "" };
  }
}

/* ═══════════════════ المكوّن ═══════════════════ */

export default function ShareButtons({ target, className }: { target: ShareTarget; className?: string }) {
  const { t, me, lang } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [shot, setShot] = useState<{ dataUrl: string; blob: Blob } | null>(null);
  const [copied, setCopied] = useState(false);
  const urlRef = useRef("");
  const shotLang = useRef<string>("");

  const url = itemShareUrl(target.kind, target.id);
  urlRef.current = url;
  const caption = buildCaption(target, url);

  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(
    target.summary ? `${target.title} — ${clip(target.summary, 140)}` : target.title
  )}`;

  const generate = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    try {
      /* اسم وصورة المؤلف/المكوِّن — تُجلب لحظة التوليد فقط (★ v3.21.1) */
      const auth = await fetchAuthor(target.kind, target.id);
      const name = (target.author || auth.name || "").trim();
      const byLine =
        target.kind === "ad" || !name
          ? ""
          : target.kind === "course"
            ? t("shr.by.trainer", { name })
            : t("shr.by.author", { name });
      const out = await renderShareImage(target, {
        siteName: t("app.name"),
        kindLabel: t(`shr.kind.${target.kind}`),
        cta: t("shr.imageCta"),
        byLine,
        authorPhoto: auth.photo,
      });
      if (out) setShot(out);
      else setFailed(true);
    } catch {
      setFailed(true);
    }
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, t]);

  /* عند فتح النافذة: تُولَّد الصورة بلغة الواجهة الحالية —
     ★ v3.21.1: تُعاد التوليد تلقائياً عند كل تغيير للغة (كانت تُخبّأ بالعربية دائماً)،
     وتُعاد الاستخدام فوراً ما دامت بنفس اللغة */
  useEffect(() => {
    if (!open) return;
    if (shot && shotLang.current === lang) return;
    shotLang.current = lang;
    setShot(null);
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lang]);

  /* ★ v3.21.1: الزران للإدارة والمساعد فقط — يختفيان ذاتياً عن أي دور آخر والزوار */
  const isStaff = !!me && (me.role === "admin" || me.role === "assistant");
  if (!isStaff) return null;

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

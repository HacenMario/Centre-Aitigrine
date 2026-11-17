"use client";
/**
 * ★ v3.25 — قارئ الكتاب التفاعلي (PDF Flipbook) — تجربة quranflash داخل الموقع
 * • كتاب مفتوح: صفحتان متجاورتان على الشاشات الكبيرة وصفحة واحدة على الهاتف
 * • تقليب واقعي: حركة 3D نحو الكعب + ظل متدرج، سحب أفقي باللمس، أسهم لوحة المفاتيح
 * • العلامة الحمراء: رِبْط أحمر على رأس الصفحة المحفوظة — نقرة تعيدك إليها من أي مكان
 * • استكمال القراءة: آخر صفحة تُحفظ (خادمياً للمسجلين ومحلياً للزوار) ويُفتح عليها القارئ
 * • Zoom in/out بأزرار: إعادة رسم بدقة أعلى حتى 3× — الرسم عبر pdf.js عامل Worker محلي
 * • pdf.js من حزمة pdfjs-dist المضمّنة + Worker وخطوط قياسية من public — بلا CDN خارجي
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import {
  X, ZoomIn, ZoomOut, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight,
  Loader2, CircleAlert, BookOpenText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* أنواع pdf.js الدنيا — الاستيراد ديناميكي كسول فلا يثقل الحزمة الرئيسية */
type PdfViewport = { width: number; height: number };
type PdfPage = {
  getViewport: (o: { scale: number }) => PdfViewport;
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => {
    promise: Promise<void>; cancel: () => void;
  };
};
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage>; destroy: () => Promise<void> };
type PdfModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (o: { url: string; standardFontDataUrl?: string }) => {
    promise: Promise<PdfDoc>;
    onProgress: ((d: { loaded?: number; total?: number }) => void) | null;
  };
};

const ZOOMS = [0.6, 0.8, 1, 1.25, 1.5, 1.9, 2.4, 3];
const MAX_PAGE = 9999;

type Err = "" | "password" | "load";

export default function PdfFlipbook({
  ebookId, url, title, direction, onClose,
}: {
  ebookId: string;
  url: string;
  title: string;
  direction: "rtl" | "ltr";
  onClose: () => void;
}) {
  const { t, me } = useApp();
  const rtl = direction === "rtl";

  const [numPages, setNumPages] = useState(0);
  const [base, setBase] = useState(1); /* أول صفحة في المزدوج (فردية دائماً) — أو الصفحة الحالية على الهاتف */
  const [zoomIdx, setZoomIdx] = useState(2); /* ZOOMS[2] = 1 */
  const [bookmark, setBookmark] = useState(0);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState<Err>("");
  const [single, setSingle] = useState(false); /* وضع الصفحة الواحدة (الهاتف) */
  const [flipKey, setFlipKey] = useState(0); /* مفتاح إعادة تشغيل حركة التقليب */
  const [flipDir, setFlipDir] = useState<1 | -1>(1); /* اتجاه الحركة */

  const docRef = useRef<PdfDoc | null>(null);
  const leftRef = useRef<HTMLCanvasElement | null>(null);
  const rightRef = useRef<HTMLCanvasElement | null>(null);
  const singleRef = useRef<HTMLCanvasElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const genRef = useRef(0); /* جيل الرسم — يُلغي نتائج الرسوم القديمة */
  const tasksRef = useRef<{ cancel: () => void }[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseRef = useRef(1);
  const bookmarkRef = useRef(0);
  const dirtyRef = useRef(false);
  const touchX = useRef(0);
  const zoomRef = useRef(2);

  baseRef.current = base;
  bookmarkRef.current = bookmark;
  zoomRef.current = zoomIdx;

  /* أرقام الصفحات المعروضة حسب الاتجاه والوضع */
  const spread = !single;
  const cur = base;
  const nxt = spread ? base + 1 : base;
  const leftPage = spread ? (rtl ? nxt : cur) : 0;
  const rightPage = spread ? (rtl ? cur : nxt) : 0;

  /* ── الحفظ: خادمي للمسجلين + محلي للجميع ── */
  const lsKey = `ebpg:${ebookId}`;
  const saveNow = useCallback(() => {
    const payload = { lastPage: Math.max(1, baseRef.current), bookmark: bookmarkRef.current };
    try { localStorage.setItem(lsKey, JSON.stringify(payload)); } catch {}
    if (!me) return;
    fetch(`/api/ebooks/${ebookId}/progress`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), keepalive: true,
    }).catch(() => {});
  }, [ebookId, lsKey, me]);

  const saveSoon = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveNow(); dirtyRef.current = false; }, 1200);
  }, [saveNow]);

  /* ── الرسم: الصفحات المعروضة بدقة الجهاز × الزوم ── */
  const renderAll = useCallback(async () => {
    const doc = docRef.current;
    if (!doc) return;
    const gen = ++genRef.current;
    for (const task of tasksRef.current) { try { task.cancel(); } catch {} }
    tasksRef.current = [];

    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const area = areaRef.current;
    const areaW = area ? area.clientWidth : 900;
    const areaH = area ? area.clientHeight : 600;
    const slots: { n: number; cv: HTMLCanvasElement | null }[] = single
      ? [{ n: cur, cv: singleRef.current }]
      : [
          { n: leftPage, cv: leftRef.current },
          { n: rightPage, cv: rightRef.current },
        ];
    const live = slots.filter((s) => s.n >= 1 && s.n <= doc.numPages && s.cv);
    if (!live.length) return;

    /* مقياس الأساس: ملاءمة العرض — صفحة واحدة كامل المساحة، مزدوج نصفها لكل صفحة */
    try {
      const p0 = await doc.getPage(live[0].n);
      if (gen !== genRef.current) return;
      const v0 = p0.getViewport({ scale: 1 });
      const cols = single ? 1 : 2;
      const fit = Math.min((areaW * 0.92) / cols / v0.width, (areaH * 0.9) / v0.height);
      const scale = Math.max(0.1, fit * ZOOMS[zoomRef.current] * dpr);

      for (const s of live) {
        const page = await doc.getPage(s.n);
        if (gen !== genRef.current) return;
        const vp = page.getViewport({ scale });
        const cv = s.cv as HTMLCanvasElement;
        const ctx = cv.getContext("2d");
        if (!ctx) continue;
        cv.width = Math.max(1, Math.floor(vp.width));
        cv.height = Math.max(1, Math.floor(vp.height));
        const task = page.render({ canvasContext: ctx, viewport: vp });
        tasksRef.current.push(task);
        await task.promise;
        if (gen !== genRef.current) return;
        cv.style.width = `${Math.floor(vp.width / dpr)}px`;
        cv.style.height = `${Math.floor(vp.height / dpr)}px`;
      }
    } catch (e) {
      /* إلغاء الرسم لصالح جيل أحدث ليس خطأ */
      const msg = String((e as Error)?.message || "");
      if (gen === genRef.current && !/cancel/i.test(msg)) console.error("flipbook render:", msg.slice(0, 120));
    }
  }, [cur, leftPage, rightPage, single]);

  /* ── التحميل الأولي: pdf.js + التقدم المحفوظ ── */
  useEffect(() => {
    let alive = true;
    let doc: PdfDoc | null = null;
    (async () => {
      try {
        const pdfjs = (await import("pdfjs-dist")) as unknown as PdfModule;
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({ url, standardFontDataUrl: "/pdf-fonts/" });
        task.onProgress = (d) => {
          if (alive && d.total) setPct(Math.min(99, Math.round((d.loaded || 0) / d.total * 100)));
        };
        doc = await task.promise;
        if (!alive) { doc.destroy().catch(() => {}); return; }
        docRef.current = doc;
        setNumPages(Math.min(doc.numPages, MAX_PAGE));

        /* استكمال القراءة — خادمي للمسجلين ثم محلي للجميع */
        let lastPage = 1;
        let bm = 0;
        try {
          const raw = localStorage.getItem(`ebpg:${ebookId}`);
          if (raw) { const j = JSON.parse(raw); lastPage = Number(j.lastPage) || 1; bm = Number(j.bookmark) || 0; }
        } catch {}
        if (me) {
          try {
            const r = await fetch(`/api/ebooks/${ebookId}/progress`, { cache: "no-store" });
            if (r.ok) {
              const j = await r.json();
              if ((j.lastPage || 0) >= lastPage) lastPage = Number(j.lastPage) || 1;
              if (j.bookmark) bm = Number(j.bookmark) || 0;
            }
          } catch {}
        }
        if (!alive) return;
        const start = Math.min(Math.max(1, lastPage), doc.numPages);
        setBase(spread ? start : start);
        setBookmark(Math.min(bm, doc.numPages));
        if (start > 1) toast.success(t("eb.readerResume", { n: start }), { duration: 4000 });
        setPct(100);
      } catch (e) {
        if (!alive) return;
        const name = String((e as Error)?.name || "");
        setErr(name.includes("Password") ? "password" : "load");
      }
    })();
    return () => {
      alive = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirtyRef.current) saveNow();
      for (const task of tasksRef.current) { try { task.cancel(); } catch {} }
      docRef.current?.destroy().catch(() => {});
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ebookId, url]);

  /* وضع الصفحة الواحدة على الهاتف — إعادة الرسم عند تغير المقاس */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setSingle(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    const onResize = () => { renderAll(); };
    const deb = () => { clearTimeout((window as unknown as { __ebRz?: ReturnType<typeof setTimeout> }).__ebRz); (window as unknown as { __ebRz?: ReturnType<typeof setTimeout> }).__ebRz = setTimeout(onResize, 250); };
    window.addEventListener("resize", deb);
    return () => { mq.removeEventListener("change", apply); window.removeEventListener("resize", deb); };
  }, [renderAll]);

  /* الرسم عند تغير الصفحات/الزوم/الوضع */
  useEffect(() => { if (numPages) renderAll(); }, [numPages, cur, zoomIdx, single, renderAll]);

  /* قفل تمرير الصفحة خلف القارئ */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* التنقل */
  const go = useCallback((target: number, dirHint: 1 | -1 = 1) => {
    const doc = docRef.current;
    if (!doc) return;
    const max = doc.numPages;
    const b = spread ? target : target;
    const clamped = Math.min(Math.max(1, b), max);
    if (clamped === baseRef.current) return;
    setFlipDir(dirHint);
    setFlipKey((k) => k + 1);
    setBase(clamped);
    saveSoon();
  }, [saveSoon, spread]);

  const next = useCallback(() => {
    const doc = docRef.current; if (!doc) return;
    const step = spread ? 2 : 1;
    go(Math.min(baseRef.current + step, doc.numPages), 1);
  }, [go, spread]);
  const prev = useCallback(() => {
    const step = spread ? 2 : 1;
    go(Math.max(baseRef.current - step, 1), -1);
  }, [go, spread]);

  /* لوحة المفاتيح — الأسهم تحترم اتجاه الكتاب */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      const fwd = rtl ? "ArrowLeft" : "ArrowRight";
      const back = rtl ? "ArrowRight" : "ArrowLeft";
      if (e.key === fwd) next();
      else if (e.key === back) prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose, rtl]);

  /* العلامة الحمراء */
  const toggleBookmark = useCallback(() => {
    const doc = docRef.current; if (!doc) return;
    const at = Math.min(baseRef.current, doc.numPages);
    if (bookmarkRef.current === at) {
      setBookmark(0); toast.success(t("eb.bookmarkCleared"));
    } else {
      setBookmark(at); toast.success(t("eb.bookmarkSaved", { n: at }));
    }
    saveSoon();
  }, [saveSoon, t]);

  /* سحب أفقي باللمس */
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0]?.clientX || 0; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = (e.changedTouches[0]?.clientX || 0) - touchX.current;
    if (Math.abs(dx) < 48) return;
    /* كتاب عربي: السحب لليسار = التقدم (كقلب الورق الفعلي) */
    const fwd = rtl ? dx < 0 : dx > 0;
    if (fwd) next(); else prev();
  };

  const zoomIn = () => setZoomIdx((i) => Math.min(ZOOMS.length - 1, i + 1));
  const zoomOut = () => setZoomIdx((i) => Math.max(0, i - 1));
  const bookmarkHere = bookmark > 0 && (bookmark === leftPage || bookmark === rightPage || (single && bookmark === cur));
  const percent = numPages ? Math.round(((base - 1) / Math.max(1, numPages - 1)) * 100) : 0;

  const Slot = ({ n, cvRef, side }: { n: number; cvRef: React.RefObject<HTMLCanvasElement | null>; side: "l" | "r" }) => (
    <div className={cn("relative flex shrink-0 items-center justify-center", side === "l" ? "justify-end" : "justify-start")}>
      {n >= 1 && n <= numPages ? (
        <>
          <canvas ref={cvRef} className="max-h-full rounded-e-sm rounded-s-sm bg-white shadow-[0_10px_40px_rgba(0,0,0,0.45)]" />
          {/* العلامة الحمراء — رِبْط على رأس الصفحة المحفوظة */}
          {bookmarkHere && bookmark === n && (
            <button
              type="button"
              onClick={() => { go(bookmark, bookmark >= base ? 1 : -1); toast.info(t("eb.bookmarkJump", { n: bookmark })); }}
              aria-label={t("eb.bookmarkJump", { n: bookmark })}
              title={t("eb.bookmarkJump", { n: bookmark })}
              className={cn(
                "absolute top-0 z-20 h-16 w-7 shadow-md transition-transform hover:scale-105",
                side === "l" ? "left-0" : "right-0"
              )}
              style={{
                background: "linear-gradient(180deg, #e11d48 0%, #be123c 100%)",
                clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%)",
              }}
            />
          )}
        </>
      ) : (
        <div className="h-full w-full max-w-[40px]" /> /* فراغ جانب الكعب */
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-stone-950/97 backdrop-blur-sm" dir="ltr">
      <style>{`
        @keyframes ebFlip { 0% { transform: perspective(1400px) rotateY(var(--eb-rot)) translateX(var(--eb-shift)); opacity:.45; }
          60% { opacity: 1; } 100% { transform: perspective(1400px) rotateY(0deg) translateX(0); opacity: 1; } }
        .eb-flip { animation: ebFlip .42s cubic-bezier(.22,.8,.3,1) both; }
        @media (prefers-reduced-motion: reduce) { .eb-flip { animation: none; } }
        .eb-spine { background: linear-gradient(90deg, rgba(0,0,0,.22), rgba(0,0,0,.05) 45%, rgba(0,0,0,.05) 55%, rgba(0,0,0,.22)); }
      `}</style>

      {/* شريط الأدوات العلوي */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-white/10 bg-stone-900/90 px-2 py-2 text-white sm:px-4">
        <BookOpenText className="hidden h-5 w-5 shrink-0 text-primary sm:block" />
        <p className="min-w-0 flex-1 truncate text-sm font-bold sm:text-base">{title}</p>
        <span className="hidden shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold tabular-nums sm:block">
          {numPages ? `${cur}${spread && nxt <= numPages ? `–${nxt}` : ""} / ${numPages}` : "…"}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={zoomOut} disabled={zoomIdx === 0 || !numPages}
            className="h-9 w-9 text-white hover:bg-white/10" aria-label={t("eb.zoomOut")} title={t("eb.zoomOut")}>
            <ZoomOut className="h-4.5 w-4.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={zoomIn} disabled={zoomIdx === ZOOMS.length - 1 || !numPages}
            className="h-9 w-9 text-white hover:bg-white/10" aria-label={t("eb.zoomIn")} title={t("eb.zoomIn")}>
            <ZoomIn className="h-4.5 w-4.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleBookmark} disabled={!numPages}
            className={cn("h-9 w-9 hover:bg-white/10", bookmarkHere ? "text-rose-400" : "text-white")}
            aria-label={bookmarkHere ? t("eb.bookmarkRemove") : t("eb.bookmarkAdd")}
            title={bookmarkHere ? t("eb.bookmarkRemove") : t("eb.bookmarkAdd")}>
            {bookmarkHere ? <BookmarkCheck className="h-4.5 w-4.5" /> : <Bookmark className="h-4.5 w-4.5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { saveNow(); onClose(); }}
            className="h-9 w-9 text-white hover:bg-destructive/60" aria-label={t("common.close")} title={t("common.close")}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* منطقة الكتاب */}
      <div ref={areaRef} className="relative min-h-0 flex-1 overflow-auto" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {!numPages && !err && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-white/80">
            <Loader2 className="h-9 w-9 animate-spin text-primary" />
            <p className="text-sm font-bold">{t("eb.readerLoading")} {pct > 0 ? `${pct}%` : ""}</p>
          </div>
        )}
        {err && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <CircleAlert className="h-12 w-12 text-destructive" />
            <p className="text-sm font-bold text-white/90">{err === "password" ? t("eb.readerPassword") : t("eb.readerError")}</p>
            <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl">{t("common.retry")}</Button>
          </div>
        )}
        {numPages > 0 && (
          <div
            key={flipKey}
            className={cn("eb-flip mx-auto flex h-full w-full items-stretch justify-center gap-0 p-3 sm:p-5", flipDir === 1 ? "" : "")}
            style={flipDir === 1
              ? ({ "--eb-rot": rtl ? "9deg" : "-9deg", "--eb-shift": rtl ? "-14px" : "14px" } as React.CSSProperties)
              : ({ "--eb-rot": rtl ? "-9deg" : "9deg", "--eb-shift": rtl ? "14px" : "-14px" } as React.CSSProperties)}
          >
            {single ? (
              <div className="relative flex h-full items-center justify-center">
                <canvas ref={singleRef} className="max-h-full max-w-full rounded-sm bg-white shadow-[0_10px_40px_rgba(0,0,0,0.45)]" />
                {bookmarkHere && bookmark === cur && (
                  <button type="button" onClick={() => toast.info(t("eb.bookmarkJump", { n: bookmark }))}
                    aria-label={t("eb.bookmarkJump", { n: bookmark })}
                    className={cn("absolute top-0 z-20 h-16 w-7 shadow-md", rtl ? "right-0" : "left-0")}
                    style={{ background: "linear-gradient(180deg, #e11d48 0%, #be123c 100%)", clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%)" }} />
                )}
              </div>
            ) : (
              <div className={cn("flex h-full items-stretch", rtl ? "flex-row" : "flex-row")}>
                <Slot n={leftPage} cvRef={leftRef} side="l" />
                <div className="eb-spine w-[3px] shrink-0" />
                <Slot n={rightPage} cvRef={rightRef} side="r" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* شريط التنقل السفلي */}
      {numPages > 0 && (
        <div className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-stone-900/90 px-2 py-2 text-white sm:px-4">
          <Button variant="ghost" size="icon" onClick={prev} disabled={base <= 1}
            className="h-10 w-10 shrink-0 text-white hover:bg-white/10" aria-label={t("eb.readerPrev")} title={t("eb.readerPrev")}>
            {rtl ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              type="range" min={1} max={numPages} value={Math.min(base, numPages)}
              onChange={(e) => go(Number(e.target.value), Number(e.target.value) >= baseRef.current ? 1 : -1)}
              aria-label={t("eb.readerPage")}
              className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-rose-500"
            />
            <span className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-xs font-bold tabular-nums sm:hidden">
              {cur}/{numPages}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={next}
            disabled={spread ? base + 1 >= numPages : base >= numPages}
            className="h-10 w-10 shrink-0 text-white hover:bg-white/10" aria-label={t("eb.readerNext")} title={t("eb.readerNext")}>
            {rtl ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";
/**
 * الكتب الإلكترونية — v3.20
 * • للجميع: العنوان + النبذة + الغلاف (+ السعر)
 * • ★ v3.20: المجاني يظهر محتواه لجميع المستخدمين — والمدفوع يظهر عنوانه وغلافه
 *   ونبذته فقط مع زر شراء يصل طلب فوراً لحساب الإدارة (إشعار + نافذة بالصوت)
 * • ★ v3.20: رابط Google Drive قابل للضغط يظهر للمستحقين (PDF منظّم بالصور والجداول)
 * • القراءة داخل الموقع فقط — أسطر إجابات تفاعلية يحفظها العميل
 * • الإجابات تظهر للإدارة وللأخصائي المعالج فقط
 * • ★ v3.25: قارئ الكتاب التفاعلي — PDF مرفوع من الإدارة يُقرأ داخل الموقع بتجربة كتاب حقيقي:
 *   قلب صفحات ثلاثي الأبعاد (أسلوب quranflash)، علامة حمراء على الصفحة المحفوظة،
 *   استكمال القراءة من نفس الصفحة، وزر Zoom in/out — لكل مستخدم تقدمه الخاص
 * • الإدارة والمساعد يضيفان/يعدلان/يعطلان — والحذف للإدارة
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import ShareButtons from "@/components/share-buttons";
import BackButton from "@/components/back-button";
import { CardsSkeleton } from "@/components/brand-skeleton";
import ImageInput from "@/components/image-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BookOpenText, Plus, Pencil, Trash2, Power, PenLine, Lock, ArrowRight, ArrowLeft, ShieldCheck,
  MessagesSquare, X, ExternalLink, ShoppingCart, Wallet, CircleAlert, Check, Clock3, FileText,
} from "lucide-react";
import { SmartSearch, Chip } from "@/components/smart-search";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TriInput, TriTextarea, triFrom, flattenTri, pickTri, TRI3 } from "@/components/tri-input";
import FullImage from "@/components/full-image";
import PdfFlipbook from "@/components/pdf-flipbook";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Pagination from "@/components/pagination";
import { WhatsAppGlyph } from "@/components/whatsapp-button";
import { cn } from "@/lib/utils";
import type { Navigate } from "@/lib/nav";

const PAGE_SIZE = 9;

type Block = { type: "text" | "answer"; text: string; lines: number };
type Ebook = {
  _id: string; title: string; titleFr?: string; titleEn?: string;
  summary: string; summaryFr?: string; summaryEn?: string;
  author: string; coverBase64: string; blocks: Block[]; active: boolean;
  /** ★ v3.20 */
  price?: number; driveLink?: string; driveHas?: boolean;
  /** ★ v3.25: وجود PDF مدمج (الرابط لا يُرسل في القائمة حفظاً للأمان) + اتجاه التقليب */
  pdfHas?: boolean; pdfUrl?: string; direction?: "rtl" | "ltr";
  myOrder?: "pending" | "accepted" | "paid" | null;
};

export default function Ebooks({ navigate }: { navigate: Navigate }) {
  const { t, me, lang, settings, viewId } = useApp();
  const isStaff = me?.role === "admin" || me?.role === "assistant";
  /* ★ v3.21.2: صلاحية النشر (زرّا انستغرام/فايسبوك) تشمل الأخصائي والمكوِّن — دون لوحات الإدارة */
  const canShare = !!me && (isStaff || me.role === "specialist" || me.role === "trainer");
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState<Ebook | null>(null);
  /* ★ v3.25: القارئ التفاعلي في مستوى الصفحة — خارج نافذة Radix (pointer-events:none على الجسم
     ما دامت النافذة مفتوحة كانت ستُعطل النقر داخل القارئ) */
  const [flipping, setFlipping] = useState<Ebook | null>(null);
  const [editing, setEditing] = useState<Partial<Ebook> | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [buying, setBuying] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/ebooks${isStaff ? "?all=1" : ""}`, { cache: "no-store" });
      const j = await r.json();
      setEbooks(j.ebooks || []);
    } catch {}
    setLoading(false);
  }, [isStaff]);

  useEffect(() => { load(); }, [load]);
  /* ★ v3.26: البحث الذكي + تصفية اتجاه الكتاب (عربي RTL / لاتيني LTR) */
  const [query, setQuery] = useState("");
  const [dirF, setDirF] = useState<"all" | "rtl" | "ltr">("all");
  const shownEbooks = ebooks.filter((e) => {
    if (dirF !== "all" && (e.direction || "rtl") !== dirF) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const fields = [e.title, e.titleFr, e.titleEn, e.summary, e.summaryFr, e.summaryEn, e.author, e.authorFr, e.authorEn];
    return fields.map((x) => String(x || "")).join(" ").toLowerCase().includes(q);
  });
  useEffect(() => { setPage(1); }, [query, dirF, ebooks.length]);

  /* ★ v3.21: الرابط المنشور يفتح الكتاب نفسه مباشرة — ?view=ebooks&id=…
     (القارئ يجلب المحتوى الكامل بالمعرف بنفسه، فالفتح من القائمة أو الجلب الفردي كافٍ) */
  const deepDone = useRef(false);
  useEffect(() => {
    if (!viewId || deepDone.current || loading) return;
    deepDone.current = true;
    const found = ebooks.find((e) => e._id === viewId);
    if (found) {
      setReading(found);
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/ebooks/${viewId}`, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (j.ebook) setReading(j.ebook);
        }
      } catch {}
    })();
  }, [viewId, ebooks, loading]);

  /* بطاقة الكتاب بلغة المستخدم */
  const titleOf = (e: Ebook) => pickTri(e as unknown as Record<string, unknown>, "title", lang) || e.title;
  const summaryOf = (e: Ebook) => pickTri(e as unknown as Record<string, unknown>, "summary", lang);

  /* ترقيم الصفحات الاحترافي */
  const pageCount = Math.max(1, Math.ceil(shownEbooks.length / PAGE_SIZE));
  const pageItems = shownEbooks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleActive = async (e: Ebook) => {
    const r = await fetch(`/api/ebooks/${e._id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !e.active }),
    });
    if (r.ok) { toast.success(e.active ? t("common.inactive") : t("common.active")); load(); }
  };

  /* ★ v3.20: طلب شراء كتاب مدفوع — يصل للإدارة فوراً (إشعار + نافذة بالصوت) */
  const buy = async (e: Ebook) => {
    if (!me) {
      toast.info(t("eb.loginToBuy"), { duration: 6000 });
      navigate("login", "client");
      return;
    }
    if (me.role !== "client") {
      toast.info(t("eb.clientOnlyBuy"), { duration: 5000 });
      return;
    }
    setBuying(e._id);
    try {
      const r = await fetch("/api/ebook-orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ebookId: e._id }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok) {
        toast.success(t("eb.orderSent"), { duration: 8000 });
        load();
      } else {
        toast.error(j?.error || t("common.error"), { duration: 6000 });
      }
    } catch {
      toast.error(t("err.conn"));
    }
    setBuying("");
  };

  const waNum = (settings?.whatsapp || settings?.phone || "").replace(/[^\d]/g, "");
  const waHref = (e: Ebook) =>
    `https://wa.me/${waNum}?text=${encodeURIComponent(`${t("ord.waMsg")} «${titleOf(e)}» — ${e.price || 0} ${t("eb.dzd")}`)}`;

  /* شارة السعر على البطاقة */
  const priceBadge = (e: Ebook) =>
    (e.price || 0) > 0 ? (
      <Badge className="border-0 bg-amber-100 text-amber-900 hover:bg-amber-100 gap-1 shadow">
        <Wallet className="h-3 w-3" /> {e.price} {t("eb.dzd")}
      </Badge>
    ) : (
      <Badge className="border-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 gap-1 shadow">
        <Check className="h-3 w-3" /> {t("eb.free")}
      </Badge>
    );

  /* شارة حالة طلبي على البطاقة */
  const orderChip = (e: Ebook) => {
    if (!e.myOrder) return null;
    if (e.myOrder === "pending")
      return (
        <Badge className="border-0 bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-50 gap-1">
          <Clock3 className="h-3 w-3" /> {t("eb.orderPending")}
        </Badge>
      );
    if (e.myOrder === "accepted")
      return (
        <Badge className="border-0 bg-sky-50 text-sky-700 ring-1 ring-sky-200 hover:bg-sky-50 gap-1">
          <CircleAlert className="h-3 w-3" /> {t("eb.orderAccepted")}
        </Badge>
      );
    return (
      <Badge className="border-0 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 gap-1">
        <Check className="h-3 w-3" /> {t("eb.orderPaid")}
      </Badge>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <BackButton onBack={() => navigate("home")} />
          <h1 className="text-xl sm:text-2xl font-black">{t("nav.ebooks")}</h1>
        </div>
        {isStaff && (
          <Button onClick={() => setEditing({ title: "", summary: "", author: "", coverBase64: "", blocks: [], active: true, price: 0, driveLink: "", pdfUrl: "", direction: "rtl" })}
            className="gap-2 rounded-xl shadow-md shadow-primary/20">
            <Plus className="h-4.5 w-4.5" /> {t("eb.newEbook")}
          </Button>
        )}
      </div>

      {!me && (
        <p className="flex items-center gap-2 rounded-xl bg-primary/6 border border-primary/15 px-4 py-2.5 text-sm text-primary">
          <Lock className="h-4 w-4 shrink-0" />
          {t("eb.loginHint")}
        </p>
      )}

      {/* ★ v3.26: البحث الذكي + تصفية الاتجاه */}
      {!loading && ebooks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <SmartSearch value={query} onChange={setQuery} placeholder={t("common.searchPh")} />
          <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label={t("eb.direction")}>
            <Chip active={dirF === "all"} onClick={() => setDirF("all")}>{t("common.all")}</Chip>
            <Chip active={dirF === "rtl"} onClick={() => setDirF("rtl")}>{t("eb.dirRtl")}</Chip>
            <Chip active={dirF === "ltr"} onClick={() => setDirF("ltr")}>{t("eb.dirLtr")}</Chip>
          </div>
        </div>
      )}

      {loading ? (
        <CardsSkeleton count={3} />
      ) : shownEbooks.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-14 text-center text-muted-foreground">
            {t("eb.noEbooks")}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* بطاقات أكبر تُظهر الغلاف جيداً مع كل التفاصيل — بلا نقصان في النص */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((e) => (
              <Card key={e._id} className={cn("overflow-hidden rounded-3xl shadow-sm hover:shadow-lg transition-all group flex flex-col", !e.active && "opacity-60")}>
                <button type="button" className="block w-full text-start flex-1 flex flex-col" onClick={() => setReading(e)}>
                  <div className="relative h-56 sm:h-64 bg-muted/30">
                    {e.coverBase64 ? (
                      <FullImage src={e.coverBase64} alt={titleOf(e)} className="h-56 w-full sm:h-64" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/15 to-accent/15 text-4xl"><BookOpenText className="h-14 w-14 text-primary/50" /></span>
                    )}
                    <div className="absolute top-3 end-3 flex flex-col items-end gap-1.5">
                      {priceBadge(e)}
                      {(e.price || 0) === 0 && (
                        <Badge className="bg-background/90 text-primary border-0 shadow gap-1">
                          <Lock className="h-3 w-3" /> {t("eb.readOnlyInSite")}
                        </Badge>
                      )}
                      {e.pdfHas && (
                        <Badge className="bg-background/90 text-rose-600 border-0 shadow gap-1">
                          <FileText className="h-3 w-3" /> {t("eb.pdfBadge")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardContent className="flex-1 space-y-2 p-5">
                    <h3 className="font-black leading-snug break-words whitespace-normal">{titleOf(e)}</h3>
                    {summaryOf(e) && (
                      <p className="text-sm text-muted-foreground leading-relaxed break-words whitespace-pre-line">{summaryOf(e)}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                      {e.author && (
                        <span className="font-semibold">✍ {e.author}</span>
                      )}
                      {e.blocks?.length > 0 && (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 font-semibold">
                          {e.blocks.length} {t("eb.sections")}
                        </span>
                      )}
                      {orderChip(e)}
                    </div>
                  </CardContent>
                </button>
                {/* ★ v3.21/3.21.1: نشر الكتاب على انستغرام/فايسبوك — ★ v3.21.2: يشمل الأخصائي والمكوِّن */}
                {canShare && (
                  <CardContent className="border-t px-3 py-2">
                    <ShareButtons
                      target={{
                        kind: "ebook",
                        id: e._id,
                        title: titleOf(e),
                        summary: summaryOf(e) || "",
                        image: e.coverBase64 || "",
                        author: e.author || "",
                      }}
                    />
                  </CardContent>
                )}
                {/* ★ v3.20: شريط الفعل — شراء/واتساب/فتح Drive حسب الحالة */}
                {(e.price || 0) > 0 && !isStaff && (
                  <CardContent className="border-t bg-muted/20 px-4 py-3">
                    {e.myOrder === "paid" ? (
                      <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                        <Check className="h-4 w-4" /> {t("eb.unlockedHint")}
                      </p>
                    ) : e.myOrder === "accepted" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-bold text-sky-700">{t("eb.contactWaHint")}</p>
                        {waNum && (
                          <a href={waHref(e)} target="_blank" rel="noopener noreferrer"
                            className="flex h-9 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-xs font-bold text-white transition-transform hover:scale-[1.03]" dir="ltr">
                            <WhatsAppGlyph className="h-4 w-4" /> WhatsApp
                          </a>
                        )}
                      </div>
                    ) : e.myOrder === "pending" ? (
                      <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700">{t("eb.pendingHint")}</p>
                    ) : (
                      <Button onClick={() => buy(e)} disabled={buying === e._id}
                        className="h-11 w-full gap-2 rounded-xl text-sm font-bold shadow-md shadow-primary/20">
                        <ShoppingCart className="h-4.5 w-4.5" />
                        {buying === e._id ? t("common.saving") : t("eb.buy")}
                      </Button>
                    )}
                  </CardContent>
                )}
                {isStaff && (
                  <CardContent className="flex items-center gap-1 border-t py-2 px-2 flex-wrap">
                    <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={() => setEditing(e)}>
                      <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={() => toggleActive(e)}>
                      <Power className="h-3.5 w-3.5" /> {e.active ? t("common.deactivate") : t("common.activate")}
                    </Button>
                    {me?.role === "admin" && (
                      <Button size="icon" variant="ghost" className="ms-auto h-8 w-8 text-destructive" onClick={() => setDelId(e._id)} aria-label={t("common.delete")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
          <Pagination page={page} pageCount={pageCount} onPage={setPage} total={shownEbooks.length} pageSize={PAGE_SIZE} />
        </>
      )}

      {/* القارئ الداخلي */}
      {reading && (
        <EbookReader ebook={reading} onClose={() => { setReading(null); load(); }} buy={buy} waHref={waHref}
          onOpenFlip={(bk) => { setReading(null); setFlipping(bk); }} />
      )}

      {/* ★ v3.25: القارئ التفاعلي — طبقة ملء الشاشة مستقلة، وإغلاقه يعيد نافذة الكتاب */}
      {flipping && flipping.pdfUrl && (
        <PdfFlipbook ebookId={flipping._id} url={flipping.pdfUrl} title={titleOf(flipping) || flipping.title}
          direction={flipping.direction || "rtl"}
          onClose={() => { const bk = flipping; setFlipping(null); if (bk) setReading(bk); }} />
      )}

      {/* المحرر الإداري */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-start">{editing?._id ? t("common.edit") : t("eb.newEbook")}</DialogTitle>
            <DialogDescription className="text-start flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {t("eb.addedByAdmin")} — {t("eb.readOnlyInSite")}
            </DialogDescription>
          </DialogHeader>
          <EbookEditor ebook={editing} onChange={setEditing} onDone={() => { setEditing(null); load(); }} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                const r = await fetch(`/api/ebooks/${delId}`, { method: "DELETE" });
                if (r.ok) { toast.success(t("toast.ebookDeleted")); setDelId(null); load(); }
              }}>
              {t("common.yes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ───────────────── القارئ — داخل الموقع فقط ───────────────── */
function EbookReader({
  ebook, onClose, buy, waHref, onOpenFlip,
}: {
  ebook: Ebook;
  onClose: () => void;
  buy: (e: Ebook) => void;
  waHref: (e: Ebook) => string;
  onOpenFlip: (b: Ebook) => void;
}) {
  const { t, me, lang, settings } = useApp();
  const isClient = me?.role === "client";
  const isStaff = me?.role === "admin" || me?.role === "assistant";
  const isSpec = me?.role === "specialist";
  const [book, setBook] = useState<Ebook>(ebook);
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [staffAnswers, setStaffAnswers] = useState<{ clientId: string; clientName: string; answers: Record<string, string> }[]>([]);
  const [answersVisible, setAnswersVisible] = useState(false);
  /** ★ v3.2: إجابات كل عميل منفصلة — اختيار عميل يعرض إجاباته وحدها في مواقعها */
  const [viewClientId, setViewClientId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dir = document.documentElement.getAttribute("dir");
  const NavIcon = dir === "rtl" ? ArrowRight : ArrowLeft;
  const viewClient = staffAnswers.find((sa) => sa.clientId === viewClientId) || null;
  const waNum = (settings?.whatsapp || settings?.phone || "").replace(/[^\d]/g, "");

  /* ★ v3.20: جلب الكتاب منفرداً — الخادم يطبق قواعد الوصول (مجاني/مدفوع/مفعّل) */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/ebooks/${ebook._id}`, { cache: "no-store" });
        if (!alive) return;
        if (r.ok) {
          const j = await r.json();
          setBook({ ...ebook, ...j.ebook, blocks: j.ebook.blocks || [] });
          setUnlocked(!!j.unlocked);
          if (j.ebook.answersVisible || j.answersVisible) {
            setAnswersVisible(!!j.answersVisible);
            setStaffAnswers(j.answersList || []);
          }
        } else {
          /* زائر غير مسجل: 401 — تعريف فقط من بطاقة القائمة */
          setUnlocked(false);
        }
      } catch {
        if (alive) setUnlocked(false);
      }
    })();
    return () => { alive = false; };
  }, [ebook._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!me || !unlocked || !isClient) return;
    (async () => {
      const r = await fetch(`/api/ebooks/${ebook._id}/answers`);
      if (r.ok) { const j = await r.json(); setAnswers(j.answers || {}); }
    })();
  }, [ebook._id, me, isClient, unlocked]);

  const saveAnswers = async () => {
    setBusy(true);
    const r = await fetch(`/api/ebooks/${ebook._id}/answers`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    setBusy(false);
    if (r.ok) toast.success(t("eb.answersSaved"));
    else toast.error(t("common.error"));
  };

  let answerIdx = 0;
  const answeredCount = (sa: { answers: Record<string, string> }) =>
    Object.values(sa.answers).filter((v) => v && v.trim()).length;

  const title = pickTri(book as unknown as Record<string, unknown>, "title", lang) || book.title;
  const summary = pickTri(book as unknown as Record<string, unknown>, "summary", lang);
  const isPaid = (book.price || 0) > 0;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      {/* v3.6: showCloseButton=false — زر الإغلاق المدمج كان يغطي زر الرجوع؛
          الآن زرا «رجوع» و «إغلاق» مستقلان جنباً إلى جنب في رأس القارئ — لا تداخل أبداً */}
      <DialogContent showCloseButton={false} className="max-w-3xl max-h-[92dvh] overflow-y-auto rounded-3xl select-none">
        {/* رأس القارئ — سطر العنوان وسطر الأزرار منفصلان: لا تداخل بين النصوص والأزرار */}
        <DialogHeader className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 pb-3 pt-1 backdrop-blur border-b">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-start break-words whitespace-normal leading-relaxed">{title}</DialogTitle>
              <DialogDescription className="text-start mt-1 flex flex-wrap items-center gap-2">
                {isPaid ? priceTag(book.price || 0, t) : (
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 shrink-0 text-primary" />
                    {t("eb.readOnlyInSite")}
                  </span>
                )}
              </DialogDescription>
            </div>
            {/* زرا الرجوع والإغلاق — مجموعة أزرار متماسكة في سطر واحد */}
            <div className="flex shrink-0 items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5 rounded-full">
                <NavIcon className="h-4 w-4" />
                <span className="hidden min-[420px]:inline">{t("common.back")}</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onClose}
                aria-label={t("common.close")}
                title={t("common.close")}
                className="h-9 w-9 shrink-0 rounded-full border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-4.5 w-4.5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ★ v3.20: كتاب مدفوع لم يُفعّل بعد — تعريف + شراء/متابعة الطلب */}
        {unlocked === false && (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="h-52 w-full shrink-0 overflow-hidden rounded-2xl bg-muted/30 sm:w-40">
                {book.coverBase64 ? (
                  <FullImage src={book.coverBase64} alt={title} className="h-52 w-full sm:h-52" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center"><BookOpenText className="h-12 w-12 text-primary/40" /></span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                {book.author && <p className="text-sm text-muted-foreground">✍ {book.author}</p>}
                {summary && <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line break-words">{summary}</p>}
                {isPaid && priceTag(book.price || 0, t, "lg")}
                {!me && (
                  <p className="flex items-center gap-2 rounded-xl bg-primary/6 border border-primary/15 px-3 py-2 text-xs text-primary">
                    <Lock className="h-3.5 w-3.5 shrink-0" /> {t("eb.loginToRead")}
                  </p>
                )}
                {me && isClient && book.myOrder !== "paid" && (
                  <div className="space-y-2">
                    {book.myOrder === "accepted" ? (
                      <>
                        <p className="flex items-center gap-2 rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 text-xs font-bold text-sky-800">
                          <CircleAlert className="h-3.5 w-3.5 shrink-0" /> {t("eb.contactWaHint")}
                        </p>
                        {waNum && (
                          <a href={waHref(book)} target="_blank" rel="noopener noreferrer"
                            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-bold text-white transition-transform hover:scale-[1.02]" dir="ltr">
                            <WhatsAppGlyph className="h-5 w-5" /> WhatsApp
                          </a>
                        )}
                      </>
                    ) : book.myOrder === "pending" ? (
                      <p className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-bold text-amber-800">
                        <Clock3 className="h-3.5 w-3.5 shrink-0" /> {t("eb.pendingHint")}
                      </p>
                    ) : (
                      <Button onClick={() => buy(book)} className="h-12 w-full gap-2 rounded-xl text-sm font-bold shadow-md shadow-primary/20">
                        <ShoppingCart className="h-4.5 w-4.5" /> {t("eb.buy")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ★ v3.20: المستحق — زر رابط Google Drive قابل للضغط أعلى المحتوى */}
        {unlocked && book.driveLink && (
          <a
            href={book.driveLink}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className="flex items-center gap-2 rounded-2xl border-2 border-primary/25 bg-primary/[0.04] px-4 py-3 transition-colors hover:bg-primary/[0.08]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpenText className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-primary">{t("eb.driveOpen")}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{book.driveLink}</span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
          </a>
        )}

        {/* ★ v3.25: المستحق وملف PDF مدمج — زر فتح القارئ التفاعلي (تجربة الكتاب الحقيقي) */}
        {unlocked && book.pdfUrl && (
          <Button onClick={() => onOpenFlip(book)}
            className="h-12 w-full gap-2 rounded-xl text-sm font-bold shadow-md shadow-primary/20">
            <BookOpenText className="h-5 w-5" /> {t("eb.readerOpen")}
          </Button>
        )}

        {/* المحتوى — للمستحق فقط */}
        {unlocked && (
          <>
            {/* ★ عرض إجابات عميل محدد — الإدارة والأخصائي */}
            {viewClient && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-primary/30 bg-primary/[0.05] px-4 py-3">
                <p className="font-black text-sm text-primary flex items-center gap-2">
                  <MessagesSquare className="h-4 w-4" />
                  {t("eb.answersOf", { name: viewClient.clientName })}
                </p>
                <Button size="sm" variant="outline" onClick={() => setViewClientId(null)} className="gap-1.5 rounded-full">
                  <BookOpenText className="h-4 w-4" /> {t("eb.viewBookOnly")}
                </Button>
              </div>
            )}

            <div className="space-y-6 pb-4">
              {book.author && <p className="text-sm text-muted-foreground">✍ {book.author}</p>}
              {(book.blocks || []).map((b, i) => {
                if (b.type === "text") {
                  return (
                    <p key={i} className="text-[0.95rem] leading-loose whitespace-pre-wrap text-foreground/90">
                      {b.text}
                    </p>
                  );
                }
                const myKey = String(i);
                const label = `${t("eb.myAnswer")} ${++answerIdx}`;

                /* عرض إجابات العميل المختار — مدمجة في مواقعها داخل الكتاب */
                if (viewClient) {
                  const val = (viewClient.answers[myKey] || "").trim();
                  return (
                    <div key={i} className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/[0.03] p-4 space-y-2">
                      <Label className="flex items-center gap-2 text-primary">
                        <PenLine className="h-4 w-4" /> {label}
                      </Label>
                      <p className="whitespace-pre-wrap rounded-xl bg-background p-3 text-sm leading-relaxed ring-1 ring-border min-h-10">
                        {val || "—"}
                      </p>
                    </div>
                  );
                }

                return (
                  <div key={i} className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/[0.03] p-4 space-y-2">
                    <Label className="flex items-center gap-2 text-primary">
                      <PenLine className="h-4 w-4" /> {label}
                    </Label>
                    {isClient ? (
                      <Textarea
                        value={answers[myKey] || ""}
                        onChange={(e) => setAnswers({ ...answers, [myKey]: e.target.value })}
                        rows={Math.max(2, b.lines)}
                        placeholder={t("eb.writeHere")}
                        className="bg-background"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("eb.linesCount", { n: b.lines })}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* حفظ إجابات العميل */}
              {isClient && (book.blocks || []).some((b) => b.type === "answer") && (
                <div className="space-y-2">
                  <Button onClick={saveAnswers} disabled={busy} className="w-full h-12 rounded-xl text-base">
                    {busy ? t("common.saving") : t("eb.saveAnswers")}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    {t("eb.answersPrivate")}
                  </p>
                </div>
              )}

              {/* ★ الإجابات للإدارة والأخصائي المعالج — كل عميل في بطاقة مستقلة */}
              {!viewClient && answersVisible && (isStaff || isSpec) && (
                <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
                  <p className="font-bold text-sm flex items-center gap-2">
                    <MessagesSquare className="h-4 w-4 text-primary" /> {t("eb.clientsAnswers")}
                  </p>
                  {staffAnswers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("eb.noAnsweredYet")}</p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">{t("eb.pickClient")}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {staffAnswers.map((sa) => (
                          <button
                            key={sa.clientId}
                            type="button"
                            onClick={() => setViewClientId(sa.clientId)}
                            className="flex items-center justify-between gap-2 rounded-xl bg-background p-3 text-start ring-1 ring-border transition-all hover:ring-primary/50 hover:shadow-md"
                          >
                            <span className="min-w-0">
                              <span className="block break-words whitespace-normal font-bold text-sm leading-snug">{sa.clientName}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {t("eb.answeredCount", { n: answeredCount(sa) })}
                              </span>
                            </span>
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <NavIcon className="h-4 w-4 rtl:-scale-x-100" />
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** شارة السعر — دينار جزائري بلغة الواجهة */
function priceTag(price: number, t: (k: string) => string, size: "sm" | "lg" = "sm") {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full bg-amber-100 font-black text-amber-900",
      size === "lg" ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-xs"
    )}>
      <Wallet className={size === "lg" ? "h-4 w-4" : "h-3 w-3"} />
      {price} {t("eb.dzd")}
    </span>
  );
}

/* ───────────────── المحرر الإداري ───────────────── */
function EbookEditor({ ebook, onChange, onDone }: { ebook: Partial<Ebook> | null; onChange: (e: Partial<Ebook> | null) => void; onDone: () => void }) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState<Partial<Ebook> | null>(ebook);
  /* ★ v3.25: رفع ملف PDF إلى GridFS — القارئ التفاعلي يقرأه داخل الموقع */
  const [pdfBusy, setPdfBusy] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const pickPdf = async (f: File) => {
    setPdfBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/media", { method: "POST", body: fd });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.url) {
        upd({ pdfUrl: String(j.url) });
        toast.success(t("eb.pdfUploaded"));
      } else toast.error(j?.error || t("common.error"), { duration: 6000 });
    } catch {
      toast.error(t("err.conn"));
    }
    setPdfBusy(false);
  };

  /* ★ v3.20: تعديل كتاب موجود = جلب كامل أولاً (القائمة خالية من blocks عمداً) */
  useEffect(() => {
    setFull(ebook);
    if (!ebook?._id) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/ebooks/${ebook._id}`, { cache: "no-store" });
        if (r.ok && alive) {
          const j = await r.json();
          setFull({ ...ebook, ...j.ebook, blocks: j.ebook.blocks || [] });
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, [ebook?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const e = full;
  const upd = (patch: Partial<Ebook>) => {
    setFull({ ...e, ...patch });
    onChange({ ...e, ...patch });
  };
  const updBlock = (i: number, patch: Partial<Block>) =>
    upd({ blocks: (e?.blocks || []).map((b, k) => (k === i ? { ...b, ...patch } : b)) });

  const isPaid = (e?.price || 0) > 0;

  const save = async () => {
    if (!e?.title?.trim()) { toast.error(t("err.required")); return; }
    setBusy(true);
    const isNew = !e._id;
    const r = await fetch(isNew ? "/api/ebooks" : `/api/ebooks/${e._id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(e),
    });
    setBusy(false);
    if (r.ok) { toast.success(t("toast.ebookSaved")); onDone(); }
    else {
      const j = await r.json().catch(() => null);
      toast.error(j?.error || t("common.error"));
    }
  };

  return (
    <div className="space-y-4">
      <TriInput langs={TRI3}
        label={t("common.title")}
        value={triFrom(e as Record<string, unknown>, "title")}
        onChange={(v) => upd({ ...flattenTri("title", v) } as Partial<Ebook>)}
      />
      <div className="grid sm:grid-cols-2 gap-3">
        <TriTextarea langs={TRI3}
          label={t("eb.summary")}
          value={triFrom(e as Record<string, unknown>, "summary")}
          onChange={(v) => upd({ ...flattenTri("summary", v) } as Partial<Ebook>)}
          rows={2}
        />
        <div className="space-y-2">
          <Label>{t("acc.title")}</Label>
          <Input value={e?.author || ""} onChange={(ev) => upd({ author: ev.target.value })} className="h-11" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("eb.cover")}</Label>
        <ImageInput value={e?.coverBase64 || ""} onChange={(v) => upd({ coverBase64: v })} />
      </div>

      {/* ★ v3.25: ملف PDF للقارئ التفاعلي — يُرفع إلى وسائط المركز ويُقرأ داخل الموقع */}
      <div className="space-y-2 rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
        <Label className="flex items-center gap-1.5 text-primary">
          <FileText className="h-4 w-4" /> {t("eb.pdfUpload")}
        </Label>
        <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" className="hidden"
          onChange={(ev) => { const f = ev.target.files?.[0]; if (f) pickPdf(f); ev.target.value = ""; }} />
        {e?.pdfUrl ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl bg-background px-3 py-2 text-xs font-bold ring-1 ring-border">
              <FileText className="h-3.5 w-3.5 shrink-0 text-rose-600" />
              <span className="truncate" dir="ltr">{e.pdfUrl.split("/").pop()}</span>
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => pdfInputRef.current?.click()}
              disabled={pdfBusy} className="gap-1.5 rounded-xl">{t("eb.pdfReplace")}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => upd({ pdfUrl: "" })}
              className="gap-1.5 rounded-xl text-destructive hover:text-destructive">{t("eb.pdfRemove")}</Button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => pdfInputRef.current?.click()}
            disabled={pdfBusy} className="h-11 w-full gap-2 rounded-xl border-dashed border-primary/40 text-primary">
            {pdfBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("eb.pdfUploading")}</> : <><FileText className="h-4 w-4" /> {t("eb.pdfPick")}</>}
          </Button>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("eb.direction")}</Label>
            <Select value={e?.direction || "rtl"} onValueChange={(v) => upd({ direction: v as "rtl" | "ltr" })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rtl">{t("eb.dirRtl")}</SelectItem>
                <SelectItem value="ltr">{t("eb.dirLtr")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="flex items-end pb-1 text-xs leading-relaxed text-muted-foreground">{t("eb.pdfHint")}</p>
        </div>
      </div>

      {/* ★ v3.20: السعر — مجاني/مدفوع بالدينار الجزائري */}
      <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
        <label className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-bold"><Wallet className="h-4 w-4 text-amber-600" /> {t("eb.pricing")}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{t("eb.pricingHint")}</span>
          </span>
          <Switch checked={isPaid} onCheckedChange={(v) => upd({ price: v ? Math.max(1, e?.price || 0) : 0 })} />
        </label>
        {isPaid && (
          <div className="space-y-1.5">
            <Label htmlFor="eb-price">{t("eb.priceLabel")} *</Label>
            <div className="flex items-center gap-2">
              <Input id="eb-price" type="number" min={1} max={999999} inputMode="numeric" dir="ltr"
                value={e?.price || ""} onChange={(ev) => upd({ price: Math.max(0, Math.round(Number(ev.target.value) || 0)) })}
                className="h-11 text-center text-lg font-bold tracking-wider" />
              <span className="shrink-0 rounded-xl bg-amber-100 px-3 py-2 text-sm font-black text-amber-900">{t("eb.dzd")}</span>
            </div>
          </div>
        )}
        {/* ★ v3.20: رابط Google Drive — قابل للضغط للمستحقين */}
        <div className="space-y-1.5">
          <Label htmlFor="eb-drive" className="flex items-center gap-1.5"><ExternalLink className="h-3.5 w-3.5 text-primary" /> {t("eb.driveLabel")}</Label>
          <Input id="eb-drive" dir="ltr" inputMode="url" placeholder="https://drive.google.com/…"
            value={e?.driveLink || ""} onChange={(ev) => upd({ driveLink: ev.target.value })} className="h-11 text-sm" />
          <p className="text-xs leading-relaxed text-muted-foreground">{t("eb.driveHelp")}</p>
          {e?.driveLink && !/^https?:\/\/\S+$/i.test(e.driveLink) && (
            <p className="text-xs font-bold text-destructive">{t("eb.driveInvalid")}</p>
          )}
        </div>
      </div>

      {/* الكتل: نص / أسطر إجابة */}
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label>{t("eb.content")}</Label>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" className="gap-1.5"
              onClick={() => upd({ blocks: [...(e?.blocks || []), { type: "text", text: "", lines: 1 }] })}>
              <Plus className="h-4 w-4" /> {t("eb.addText")}
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-1.5 border-dashed border-primary/40 text-primary"
              onClick={() => upd({ blocks: [...(e?.blocks || []), { type: "answer", text: "", lines: 2 }] })}>
              <PenLine className="h-4 w-4" /> {t("eb.addAnswer")}
            </Button>
          </div>
        </div>
        {(e?.blocks || []).map((b, i) => (
          <div key={i} className={cn(
            "rounded-2xl border p-3 space-y-2",
            b.type === "answer" ? "border-primary/30 bg-primary/[0.03]" : "bg-muted/20"
          )}>
            <div className="flex items-center gap-2">
              <Badge variant={b.type === "answer" ? "default" : "secondary"} className="shrink-0">
                {b.type === "answer" ? t("eb.addAnswer") : t("eb.addText")}
              </Badge>
              {b.type === "answer" && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {t("eb.answerLines")}
                  <Input type="number" min={1} max={10} value={b.lines} onChange={(ev) => updBlock(i, { lines: Number(ev.target.value) })}
                    className="h-8 w-16 text-center" />
                </div>
              )}
              <button type="button" onClick={() => upd({ blocks: (e?.blocks || []).filter((_, k) => k !== i) })}
                className="ms-auto flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10" aria-label={t("common.delete")}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {b.type === "text" && (
              <Textarea value={b.text} onChange={(ev) => updBlock(i, { text: ev.target.value })} rows={3} placeholder={t("eb.blockText")} />
            )}
          </div>
        ))}
        {isPaid && (
          <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs leading-relaxed text-amber-800">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t("eb.paidContentHint")}
          </p>
        )}
      </div>

      <label className="flex items-center justify-between rounded-xl border p-3">
        <span className="text-sm font-semibold">{t("common.active")}</span>
        <Switch checked={e?.active !== false} onCheckedChange={(v) => upd({ active: v })} />
      </label>
      <Button onClick={save} disabled={busy} className="w-full h-12 rounded-xl text-base">
        {busy ? t("common.saving") : t("common.save")}
      </Button>
    </div>
  );
}

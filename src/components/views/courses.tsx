"use client";
/**
 * التكوينات v2 — نمط طمأنينة
 * بطاقات ثلاثية اللغة (عربي/فرنسي/إنجليزي) + شريط تقدم المقاعد وعددها المتبقي
 * الإدارة: إضافة/تعديل/حذف/تفعيل بحقول ثلاثية اللغة — منطق أوقات الحصص
 */
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import BackButton from "@/components/back-button";
import { PageSkeleton } from "@/components/brand-skeleton";
import ImageInput from "@/components/image-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import { Plus, Pencil, Trash2, Power, CalendarDays, Clock, UserRound, Images, X, MoveHorizontal, UsersRound, CircleCheckBig } from "lucide-react";
import { toast } from "sonner";
import { TriInput, TriTextarea, flattenTri, pickTri, triFrom, triName, TRI3 } from "@/components/tri-input";
import FullImage from "@/components/full-image";
import ScrollRow from "@/components/scroll-row";
import Pagination from "@/components/pagination";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/client-api";
import type { TriCat } from "@/lib/app-context";
import type { Navigate } from "@/lib/nav";

const PAGE_SIZE = 9;

type Session = { title: string; date: string; start: string; end: string };
type Course = {
  _id: string;
  title: string; titleFr?: string; titleEn?: string;
  description: string; descriptionFr?: string; descriptionEn?: string;
  category: string; trainerName: string; trainerId?: string | null; trainerRole?: string;
  price: number; capacity: number; enrolledCount?: number; enrolledByMe?: boolean;
  coverBase64: string; images: string[]; sessions: Session[]; active: boolean;
};
const EMPTY: Partial<Course> = { title: "", description: "", category: "", trainerName: "", price: 0, capacity: 0, coverBase64: "", images: [], sessions: [], active: true };
/** ★ v3.11: المكوِّنون والأخصائيون — يُعبّئون قائمة «المكوِّن» في نافذة إنشاء/تعديل التكوين */
type SpecOption = { _id: string; name: string; title?: string; kind: "specialist" | "trainer" };

export default function Courses({ navigate }: { navigate: Navigate }) {
  const { t, lang, me, settings } = useApp();
  const isStaff = me?.role === "admin" || me?.role === "assistant";
  const [courses, setCourses] = useState<Course[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Course> | null>(null);
  const [details, setDetails] = useState<Course | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  /* v3.6: قائمة أخصائيي المركز لاختيار المكوّن بدل الكتابة الحرة */
  const [specList, setSpecList] = useState<SpecOption[]>([]);

  const titleOf = (c: Course) =>
    (pickTri(c as unknown as Record<string, unknown>, "title", lang) || c.title);
  const descOf = (c: Course) =>
    (pickTri(c as unknown as Record<string, unknown>, "description", lang) || c.description);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/courses${isStaff ? "?all=1" : ""}`, { cache: "no-store" });
      const j = await r.json();
      setCourses(j.courses || []);
    } catch {}
    setLoading(false);
  }, [isStaff]);

  useEffect(() => { load(); }, [load]);

  /* ★ v3.11: جلب أخصائيي المركز + المكوِّنين النشطين — للإدارة فقط (تظهر القائمة في نافذة التكوين) */
  useEffect(() => {
    if (!isStaff) return;
    (async () => {
      try {
        const [rs, rt] = await Promise.all([
          fetch("/api/specialists", { cache: "no-store" }),
          fetch("/api/accounts?role=trainer", { cache: "no-store" }),
        ]);
        const js = await rs.json().catch(() => ({}));
        const jt = await rt.json().catch(() => ({}));
        const specs: SpecOption[] = (js.specialists || []).map(
          (s: { _id: string; name: string; title?: string }) => ({
            _id: String(s._id),
            name: s.name,
            title: s.title || "",
            kind: "specialist" as const,
          })
        );
        const trainers: SpecOption[] = (jt.users || [])
          .filter((u: { active?: boolean }) => u.active !== false)
          .map((u: { _id: string; name: string; title?: string }) => ({
            _id: String(u._id),
            name: u.name,
            title: u.title || "",
            kind: "trainer" as const,
          }));
        setSpecList([...trainers, ...specs]);
      } catch {}
    })();
  }, [isStaff]);

  const toggleActive = async (c: Course) => {
    const r = await fetch(`/api/courses/${c._id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    if (r.ok) { toast.success(t(c.active ? "toast.courseDeactivated" : "toast.courseActivated")); load(); }
  };

  /* التسجيل في التكوين — عميل مسجل: مرة واحدة + تحديث المقاعد فوراً (نمط طمأنينة) */
  const enroll = async (c: Course) => {
    if (!me) { toast.info(t("common.login")); navigate("login"); return; }
    if (me.role !== "client") { toast.info(t("crs.enrollClientsOnly")); return; }
    if (c.enrolledByMe) return;
    if (c.capacity > 0 && (c.enrolledCount || 0) >= c.capacity) {
      toast.error(t("crs.full"));
      return;
    }
    setEnrolling(c._id);
    try {
      const r = await fetch(`/api/courses/${c._id}`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-auth-token": getToken() || "" },
      });
      const j = await r.json();
      if (r.ok) {
        toast.success(t("crs.enrollDone"));
        setCourses((prev) =>
          prev.map((x) =>
            x._id === c._id ? { ...x, enrolledByMe: true, enrolledCount: (x.enrolledCount || 0) + 1 } : x
          )
        );
      } else {
        toast.error(j.error || t("common.error"));
      }
    } catch {
      toast.error(t("err.conn"));
    }
    setEnrolling(null);
  };

  const cats = (settings?.options?.courseCategories || []) as TriCat[];
  /* v3.5: التصنيفات ثلاثية اللغة — التخزين بالنص العربي والعرض بلغة المستخدم */
  const catLabel = (value: string): string => {
    if (!value) return "";
    const hit = cats.find((c) => c.ar === value);
    if (!hit) return value;
    return triName(hit, lang);
  };
  const fmtPrice = (n: number) => `${n.toLocaleString(lang === "ar" ? "ar-DZ" : "fr-DZ")} ${lang === "ar" ? "دج" : "DA"}`;

  /* ترقيم الصفحات الاحترافي */
  const pageCount = Math.max(1, Math.ceil(courses.length / PAGE_SIZE));
  const pageItems = courses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [courses.length]);

  /* شريط تقدم المقاعد — نمط طمأنينة */
  const SeatsBar = ({ c }: { c: Course }) => {
    if (c.capacity <= 0) return null;
    const enrolled = c.enrolledCount || 0;
    const pct = Math.min(100, Math.round((enrolled / c.capacity) * 100));
    const left = Math.max(0, c.capacity - enrolled);
    const full = left === 0;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
          <span className={cn("flex items-center gap-1", full ? "text-destructive" : "text-muted-foreground")}>
            <UsersRound className="h-3 w-3" />
            {enrolled}/{c.capacity} {t("crs.enrolled")}
          </span>
          {full ? (
            <span className="text-destructive">{t("crs.fullBadge")}</span>
          ) : (
            <span className="text-primary">{t("crs.seatsLeft", { count: left })}</span>
          )}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", full ? "bg-destructive" : pct >= 75 ? "bg-amber-500" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <BackButton onBack={() => navigate("home")} />
          <h1 className="text-xl sm:text-2xl font-black">{t("nav.courses")}</h1>
        </div>
        {isStaff && (
          <Button onClick={() => setEditing({ ...EMPTY })} className="gap-2 rounded-xl shadow-md shadow-primary/20">
            <Plus className="h-4.5 w-4.5" /> {t("crs.newCourse")}
          </Button>
        )}
      </div>

      {loading ? (
        <PageSkeleton kind="cards" count={6} label={t("common.loading")} />
      ) : courses.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="py-14 text-center text-muted-foreground">{t("landing.noCourses")}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((c) => (
            <Card key={c._id} className={cn("flex flex-col overflow-hidden rounded-3xl shadow-sm hover:shadow-lg transition-all", !c.active && "opacity-60")}>
              <button type="button" className="block w-full text-start" onClick={() => setDetails(c)}>
                <div className="relative h-40">
                  {c.coverBase64 ? (
                    <FullImage src={c.coverBase64} alt={titleOf(c)} className="h-40 w-full" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/15 to-accent/15 text-4xl">🎓</span>
                  )}
                  {c.sessions?.length > 0 && (
                    <Badge className="absolute top-3 end-3 bg-background/90 text-primary border-0 shadow">
                      {c.sessions.length} {t("crs.sessions")}
                    </Badge>
                  )}
                  {c.enrolledByMe && (
                    <Badge className="absolute top-3 start-3 bg-emerald-500 text-white border-0 shadow gap-1">
                      <CircleCheckBig className="h-3 w-3" /> {t("crs.enrolledBadge")}
                    </Badge>
                  )}
                </div>
                <CardContent className="space-y-2.5 p-5">
                  <h3 className="font-bold leading-snug break-words whitespace-normal">{titleOf(c)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed break-words whitespace-pre-line">{descOf(c)}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {c.category && <Badge variant="outline" className="break-words whitespace-normal">{catLabel(c.category)}</Badge>}
                    {c.trainerName && (
                      <span className="flex items-center gap-1">
                        <UserRound className="h-3 w-3" />
                        {c.trainerName}
                        {c.trainerRole === "trainer" && <span className="opacity-60">· {t("roles.trainer")}</span>}
                      </span>
                    )}
                    {c.price > 0 && <span className="font-bold text-primary">{fmtPrice(c.price)}</span>}
                  </div>
                  <SeatsBar c={c} />
                </CardContent>
              </button>
              <CardContent className="mt-auto flex items-center gap-1 border-t py-2 px-3 flex-wrap">
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => setDetails(c)}>
                  {t("common.details")}
                </Button>
                {isStaff && (
                  <>
                    <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={() => setEditing(c)}>
                      <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={() => toggleActive(c)}>
                      <Power className="h-3.5 w-3.5" /> {c.active ? t("common.deactivate") : t("common.activate")}
                    </Button>
                    {me?.role === "admin" && (
                      <Button size="icon" variant="ghost" className="ms-auto h-8 w-8 text-destructive" onClick={() => setDelId(c._id)} aria-label={t("common.delete")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Pagination page={page} pageCount={pageCount} onPage={setPage} total={courses.length} pageSize={PAGE_SIZE} />

      {/* ── نافذة التفاصيل: صور + برنامج الحصص + مقاعد ── */}
      <Dialog open={!!details} onOpenChange={(v) => !v && setDetails(null)}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-start break-words whitespace-normal">{details && titleOf(details)}</DialogTitle>
            <DialogDescription className="text-start">
              {details?.trainerName} {details?.price ? `· ${fmtPrice(details.price)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {details && descOf(details) && (
              <p className="text-sm leading-loose whitespace-pre-wrap">{descOf(details)}</p>
            )}
            {details && <SeatsBar c={details} />}
            {/* معرض الصور — تمرير لمسي */}
            {(details?.images?.length || 0) > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-bold flex items-center gap-2">
                  <Images className="h-4 w-4 text-primary" /> {t("crs.images")}
                </p>
                <ScrollRow trackClassName="[scrollbar-width:thin]">
                  {details!.images.map((img, i) => (
                    <FullImage key={i} src={img} alt={`${titleOf(details!)} ${i + 1}`}
                      className="h-44 w-[70%] sm:w-64 shrink-0 snap-center" rounded="rounded-2xl" />
                  ))}
                </ScrollRow>
              </div>
            )}
            {/* برنامج الحصص */}
            <div className="space-y-2">
              <p className="text-sm font-bold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> {t("crs.sessionPlan")}
              </p>
              {(details?.sessions?.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground">{t("crs.noSessions")}</p>
              ) : (
                <div className="space-y-2">
                  {details!.sessions.map((s, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-muted/30 px-4 py-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-black text-primary">{i + 1}</span>
                      <span className="font-semibold text-sm min-w-0 flex-1 break-words">{s.title || `${t("crs.session")} ${i + 1}`}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1" dir="ltr">
                        <CalendarDays className="h-3.5 w-3.5" /> {s.date}
                      </span>
                      <span className="text-xs text-primary font-bold flex items-center gap-1" dir="ltr">
                        <Clock className="h-3.5 w-3.5" /> {s.start} — {s.end}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* زر التسجيل — يختفي للإدارة، ومُعطّل إن اكتملت المقاعد أو سجّل مسبقاً */}
            {!isStaff && details && (
              <Button
                onClick={() => enroll(details)}
                disabled={enrolling === details._id || details.enrolledByMe || (details.capacity > 0 && (details.enrolledCount || 0) >= details.capacity)}
                className={cn("w-full h-12 rounded-xl text-base", details.enrolledByMe && "bg-emerald-600 hover:bg-emerald-600")}
              >
                {details.enrolledByMe ? (
                  <><CircleCheckBig className="h-5 w-5" /> {t("crs.enrolledBadge")}</>
                ) : enrolling === details._id ? (
                  t("common.loading")
                ) : details.capacity > 0 && (details.enrolledCount || 0) >= details.capacity ? (
                  t("crs.full")
                ) : (
                  t("crs.enroll")
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── نافذة الإضافة/التعديل — حقول ثلاثية اللغة ── */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-start">{editing?._id ? t("crs.editCourse") : t("crs.newCourse")}</DialogTitle>
            <DialogDescription className="text-start">{t("crs.triNote")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <TriInput langs={TRI3}
                label={t("common.title")}
                value={triFrom(editing as Record<string, unknown>, "title")}
                onChange={(v) => setEditing({ ...editing, ...flattenTri("title", v) })}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("common.category")}</Label>
                {cats.length ? (
                  <Select value={editing?.category || ""} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{cats.map((c) => <SelectItem key={c.ar} value={c.ar}>{triName(c, lang)}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input value={editing?.category || ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="h-11" />
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("crs.trainer")}</Label>
                {/* ★ v3.11: المكوِّن/الأخصائي يُختار من قائمة حسابات المركز — بربط مباشر trainerId
                    (الاسم القديم الحر المحفوظ سابقاً يبقى خياراً محفوظاً) */}
                <Select
                  value={editing?.trainerId || (editing?.trainerName ? `name:${editing.trainerName}` : "__none__")}
                  onValueChange={(v) => {
                    if (v === "__none__") return setEditing({ ...editing, trainerId: null, trainerName: "" });
                    if (v.startsWith("name:"))
                      return setEditing({ ...editing, trainerId: null, trainerName: v.slice(5) });
                    const picked = specList.find((s) => s._id === v);
                    setEditing({ ...editing, trainerId: v, trainerName: picked?.name || "" });
                  }}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={t("crs.trainerPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("crs.trainerNone")}</SelectItem>
                    {specList.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.kind === "trainer" ? `🎓 ${s.name}` : s.title ? `${s.name} — ${s.title}` : s.name}
                        {s.kind === "trainer" ? ` (${t("roles.trainer")})` : ""}
                      </SelectItem>
                    ))}
                    {/* اسم قديم محفوظ سابقاً بلا حساب مرتبط — يظهر كخيار للحفاظ عليه */}
                    {editing?.trainerName && !editing?.trainerId && !specList.some((s) => s.name === editing.trainerName) && (
                      <SelectItem value={`name:${editing.trainerName}`}>{editing.trainerName}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{t("crs.trainerHint")}</p>
              </div>
            </div>
            <div className="space-y-2">
              <TriTextarea langs={TRI3}
                label={t("common.description")}
                value={triFrom(editing as Record<string, unknown>, "description")}
                onChange={(v) => setEditing({ ...editing, ...flattenTri("description", v) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("common.price")}</Label>
                <Input type="number" min={0} value={editing?.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>{t("crs.capacity")}</Label>
                <Input type="number" min={0} value={editing?.capacity ?? 0} onChange={(e) => setEditing({ ...editing, capacity: Number(e.target.value) })} className="h-11" />
                <p className="text-[11px] text-muted-foreground">{t("crs.capacityHint")}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("common.uploadImage")}</Label>
              <ImageInput value={editing?.coverBase64 || ""} onChange={(v) => setEditing({ ...editing, coverBase64: v })} />
            </div>

            {/* صور التكوين — متعددة */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Images className="h-4 w-4 text-primary" /> {t("crs.images")}</Label>
              <CourseImages images={editing?.images || []} onChange={(v) => setEditing({ ...editing, images: v })} />
            </div>

            <Separator />

            {/* الحصص — منطق أوقات جديد */}
            <CourseSessions sessions={editing?.sessions || []} onChange={(v) => setEditing({ ...editing, sessions: v })} />

            <label className="flex items-center justify-between rounded-xl border p-3">
              <span className="text-sm font-semibold">{t("common.active")}</span>
              <Switch checked={editing?.active !== false} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
            </label>
            <SaveButton editing={editing} onDone={() => { setEditing(null); load(); }} />
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
                const r = await fetch(`/api/courses/${delId}`, { method: "DELETE" });
                if (r.ok) { toast.success(t("toast.courseDeleted")); setDelId(null); load(); }
              }}>
              {t("common.yes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* صور متعددة قابلة للترتيب */
function CourseImages({ images, onChange }: { images: string[]; onChange: (v: string[]) => void }) {
  const { t } = useApp();
  const move = (i: number, d: number) => {
    const n = [...images];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={`${t("crs.image")} ${i + 1}`} className="h-20 w-full rounded-xl object-cover ring-1 ring-border" />
              <button type="button" onClick={() => onChange(images.filter((_, k) => k !== i))}
                className="absolute -top-1.5 -end-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow">
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="absolute bottom-1 inset-x-1 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => move(i, -1)} className="rounded bg-background/90 p-0.5 shadow" aria-label={t("crs.moveRight")}>
                  <MoveHorizontal className="h-3.5 w-3.5 rotate-90" />
                </button>
                <button type="button" onClick={() => move(i, 1)} className="rounded bg-background/90 p-0.5 shadow" aria-label={t("crs.moveLeft")}>
                  <MoveHorizontal className="h-3.5 w-3.5 rotate-90" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <AddImage onAdd={(v) => onChange([...images, v])} />
    </div>
  );
}

function AddImage({ onAdd }: { onAdd: (v: string) => void }) {
  const { t } = useApp();
  return <ImageInput value="" onChange={onAdd} label={t("crs.addImage")} />;
}

/* محرر الحصص */
function CourseSessions({ sessions, onChange }: { sessions: Session[]; onChange: (v: Session[]) => void }) {
  const { t } = useApp();
  const add = () => onChange([...sessions, { title: "", date: "", start: "09:00", end: "10:00" }]);
  const upd = (i: number, patch: Partial<Session>) =>
    onChange(sessions.map((s, k) => (k === i ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> {t("crs.sessions")}</Label>
        <Button type="button" size="sm" variant="outline" onClick={add} className="gap-1.5">
          <Plus className="h-4 w-4" /> {t("crs.addSession")}
        </Button>
      </div>
      {sessions.length === 0 && <p className="text-sm text-muted-foreground">{t("crs.noSessions")}</p>}
      <div className="space-y-2">
        {sessions.map((s, i) => (
          <div key={i} className="rounded-2xl border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">{i + 1}</span>
              <Input value={s.title} onChange={(e) => upd(i, { title: e.target.value })}
                placeholder={t("crs.sessionTitle")} className="h-9 flex-1" />
              <button type="button" onClick={() => onChange(sessions.filter((_, k) => k !== i))}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10" aria-label={t("common.delete")}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">{t("common.date")}</span>
                <Input type="date" value={s.date} onChange={(e) => upd(i, { date: e.target.value })} className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">{t("crs.start")}</span>
                <Input type="time" value={s.start} onChange={(e) => upd(i, { start: e.target.value })} className="h-9 text-xs" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">{t("crs.end")}</span>
                <Input type="time" value={s.end} onChange={(e) => upd(i, { end: e.target.value })} className="h-9 text-xs" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SaveButton({ editing, onDone }: { editing: Partial<Course> | null; onDone: () => void }) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      disabled={busy}
      className="w-full h-12 rounded-xl text-base"
      onClick={async () => {
        if (!editing?.title?.trim()) { toast.error(t("err.required")); return; }
        setBusy(true);
        const isNew = !editing._id;
        const r = await fetch(isNew ? "/api/courses" : `/api/courses/${editing._id}`, {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing),
        });
        setBusy(false);
        if (r.ok) { toast.success(t("toast.courseSaved")); onDone(); }
        else toast.error(t("common.error"));
      }}
    >
      {busy ? t("common.saving") : t("common.save")}
    </Button>
  );
}
